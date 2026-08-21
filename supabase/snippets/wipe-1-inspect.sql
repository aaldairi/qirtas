-- ============================================================
--  WIPE, PART 1 of 2 — READ ONLY. Nothing here deletes anything.
--
--  Run this first in the Supabase SQL editor and read the output.
--  Part 2 is irreversible and there is no point-in-time recovery
--  on the free plan, so this exists to make the blast radius
--  something you saw rather than something you assumed.
-- ============================================================

-- 1. How much of everything there is.
select
  (select count(*) from public.shops)            as shops,
  (select count(*) from public.categories)       as categories,
  (select count(*) from public.products)         as products,
  (select count(*) from public.product_variants) as variants,
  (select count(*) from public.orders)           as orders,
  (select count(*) from public.order_items)      as order_items,
  (select count(*) from public.scan_events)      as scans,
  (select count(*) from auth.users)              as users;

-- 2. Which shops die, who owns them, how much is in them.
select s.name, s.slug, u.email as owner,
       count(p.id)::int as products
  from public.shops s
  left join auth.users u on u.id = s.owner_id
  left join public.products p on p.shop_id = s.id
 group by s.name, s.slug, u.email
 order by s.name;

-- 3. Every order that would be destroyed.
--
--    An order in 'review' is a payment somebody submitted and is still
--    waiting on. Deleting it takes the customer's name, phone and the
--    receipt path with it, leaving no way to fulfil or refund.
--    Read this before running part 2, not after.
select o.code, o.status, o.total,
       o.customer_name, o.customer_phone,
       o.receipt_path, o.created_at
  from public.orders o
 order by o.created_at;

-- 4. Accounts, and whether anyone has actually used them.
select u.email, u.created_at, u.last_sign_in_at,
       (select count(*) from public.shops s where s.owner_id = u.id) as shops
  from auth.users u
 order by u.created_at;
