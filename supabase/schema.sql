-- Qirtas / قِرطاس — QR shop system
-- Multi-tenant schema. Run once in the Supabase SQL editor.
-- Money is BHD: numeric(12,3) throughout (1 dinar = 1000 fils).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- shops

create table if not exists public.shops (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  slug           text not null unique,
  owner_name     text,
  plan           text not null default 'starter'
                 check (plan in ('starter','growth','stores')),
  -- payment methods the shop accepts; customers pay the shop directly
  iban_on        boolean not null default true,
  iban_value     text,
  wallet_on      boolean not null default false,
  wallet_value   text,
  cash_on        boolean not null default true,
  cash_value     text,
  pickup_on      boolean not null default true,
  delivery_on    boolean not null default false,
  delivery_fee   numeric(12,3) not null default 0,
  whatsapp       text,
  order_seq      integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops(owner_id);

-- slug rules: lowercase alnum + dashes, 3..40 chars
alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops add constraint shops_slug_format
  check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');

-- ----------------------------------------------------------- categories

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  name       text not null,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_shop_idx on public.categories(shop_id, sort);

-- ------------------------------------------------------------- products

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  sku          text,
  price        numeric(12,3) not null check (price >= 0),
  stock        integer not null default 0 check (stock >= 0),
  track_stock  boolean not null default true,
  description  text,
  image_path   text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_shop_idx on public.products(shop_id, created_at desc);
create unique index if not exists products_shop_sku_idx
  on public.products(shop_id, lower(sku)) where sku is not null and sku <> '';

-- --------------------------------------------------------------variants

create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label      text not null,
  qty        integer not null default 0 check (qty >= 0),
  sort       integer not null default 0
);

create index if not exists variants_product_idx on public.product_variants(product_id, sort);

-- ---------------------------------------------------------------- scans

-- one row per real scan of a product QR; powers the SCANS stat honestly
create table if not exists public.scan_events (
  id         bigserial primary key,
  shop_id    uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  visitor    text,
  -- Stamped at insert rather than derived in the index: casting a timestamptz
  -- to date depends on the session TimeZone, so it isn't IMMUTABLE and can't
  -- be indexed. A plain defaulted column pins the day in UTC.
  scan_day   date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now()
);

alter table public.scan_events
  add column if not exists scan_day date not null
  default (timezone('utc', now()))::date;

create index if not exists scans_shop_idx on public.scan_events(shop_id, created_at desc);
create index if not exists scans_product_idx on public.scan_events(product_id);
-- one scan counted per visitor per product per day
create unique index if not exists scans_dedupe_idx
  on public.scan_events(product_id, visitor, scan_day)
  where visitor is not null;

-- --------------------------------------------------------------- orders

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  code            text not null,
  public_token    uuid not null default gen_random_uuid(),
  customer_name   text not null,
  customer_phone  text not null,
  fulfilment      text not null default 'pickup' check (fulfilment in ('pickup','delivery')),
  delivery_fee    numeric(12,3) not null default 0,
  payment_method  text not null check (payment_method in ('iban','wallet','cash')),
  payment_detail  text,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','REVIEW','PAID','REJECTED')),
  subtotal        numeric(12,3) not null default 0,
  total           numeric(12,3) not null default 0,
  receipt_path    text,
  receipt_name    text,
  receipt_size    integer,
  receipt_at      timestamptz,
  decided_at      timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);

create unique index if not exists orders_shop_code_idx on public.orders(shop_id, code);
create unique index if not exists orders_token_idx on public.orders(public_token);
create index if not exists orders_shop_created_idx on public.orders(shop_id, created_at desc);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  name          text not null,          -- snapshot: survives product edits/deletes
  variant_label text,
  qty           integer not null check (qty > 0),
  unit_price    numeric(12,3) not null check (unit_price >= 0),
  line_total    numeric(12,3) not null check (line_total >= 0)
);

create index if not exists order_items_order_idx on public.order_items(order_id);

-- ------------------------------------------------------------ functions

-- Atomically allocate the next per-shop order number: #0001, #0002, ...
create or replace function public.next_order_code(p_shop uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.shops
     set order_seq = order_seq + 1
   where id = p_shop
  returning order_seq into n;

  if n is null then
    raise exception 'shop % not found', p_shop;
  end if;

  return '#' || lpad(n::text, 4, '0');
end;
$$;

-- Stock moves through these two functions only, so concurrent checkouts can't
-- read-modify-write over each other and oversell the last item on the shelf.
create or replace function public.adjust_stock(p_product uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  result integer;
begin
  update public.products
     set stock = greatest(0, stock + p_delta)
   where id = p_product
     and track_stock
  returning stock into result;

  return result;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- row level security
--
-- Writes and privileged reads all go through the server (service role) which
-- checks ownership in application code. These policies are the second lock:
-- an anon key alone can only read the public storefront surface.

alter table public.shops            enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.scan_events      enable row level security;

drop policy if exists shops_public_read on public.shops;
create policy shops_public_read on public.shops
  for select using (true);

drop policy if exists shops_owner_write on public.shops;
create policy shops_owner_write on public.shops
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select using (true);

drop policy if exists categories_owner_write on public.categories;
create policy categories_owner_write on public.categories
  for all using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (active);

drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products
  for all using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_id and p.active));

drop policy if exists variants_owner_write on public.product_variants;
create policy variants_owner_write on public.product_variants
  for all using (exists (
        select 1 from public.products p join public.shops s on s.id = p.shop_id
         where p.id = product_id and s.owner_id = auth.uid()))
  with check (exists (
        select 1 from public.products p join public.shops s on s.id = p.shop_id
         where p.id = product_id and s.owner_id = auth.uid()));

-- Orders carry customer PII: never readable with the anon key. The storefront
-- reads a single order server-side via its unguessable public_token.
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists orders_owner_write on public.orders;
create policy orders_owner_write on public.orders
  for update using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items
  for select using (exists (
        select 1 from public.orders o join public.shops s on s.id = o.shop_id
         where o.id = order_id and s.owner_id = auth.uid()));

drop policy if exists scans_owner_read on public.scan_events;
create policy scans_owner_read on public.scan_events
  for select using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- ------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880,
      allowed_mime_types = array['image/png','image/jpeg','image/webp'];

-- Receipts are payment evidence: private bucket, served only via signed URLs
-- to the shop owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','application/pdf'];

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

-- --------------------------------------------------------------- grants
--
-- Explicit rather than relying on a project's default privileges, so this
-- file produces the same result on hosted Supabase, a local CLI stack, or a
-- plain Postgres.
--
-- The app reads and writes exclusively through the service role, with
-- ownership enforced in application code. anon and authenticated get SELECT
-- only, on the storefront tables only — the policies above then decide which
-- rows. Orders are omitted entirely: customer names and phone numbers must
-- not be reachable with a key that ships to the browser.

grant usage on schema public to anon, authenticated, service_role;

-- Hosted Supabase projects ship default privileges that grant anon and
-- authenticated broad access to new tables in public. Strip that back first,
-- then re-grant only what the storefront needs. Without this revoke, orders
-- would be protected by RLS alone; with it, the privilege is absent too, so a
-- future policy mistake still cannot expose customer names and phone numbers.
revoke all on all tables in schema public from anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on public.shops, public.categories, public.products,
                public.product_variants
  to anon, authenticated;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
