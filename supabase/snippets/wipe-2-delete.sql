-- ============================================================
--  WIPE, PART 2 of 2 — IRREVERSIBLE.
--
--  Deletes every shop, product, order and account. There is no
--  point-in-time recovery on the free plan; nothing here can be
--  undone. Run wipe-1-inspect.sql first and read what it says.
--
--  BEFORE RUNNING:
--   • Storage → product-images → delete the folders. Do it FIRST.
--     Once the rows go, the image and receipt paths go with them and
--     the files remain in the bucket with nothing pointing at them.
--   • The last statement signs you out. Getting back in needs a magic
--     link, and the built-in sender allows 2 per hour — so check the
--     clock, or you will be locked out of your own fresh start.
--
--  WHAT SURVIVES: the schema, its RLS policies, grants and functions;
--  the domain, certificates, environment variables and deployment.
--  This empties the database, it does not drop it. Signing up
--  afterwards creates the first shop straight away.
-- ============================================================

begin;

-- One statement for all seven tables: cascade follows every foreign key,
-- so ordering between them cannot be got wrong. `restart identity` resets
-- the per-shop order counter, so the first order of the new shop is #0001
-- rather than continuing from the old sequence.
truncate table
  public.order_items,
  public.orders,
  public.scan_events,
  public.product_variants,
  public.products,
  public.categories,
  public.shops
restart identity cascade;

commit;

-- Accounts last: shops.owner_id references auth.users, so the rows above
-- have to be gone before these can be. This is the statement that ends
-- your session.
delete from auth.users;

-- Should be four zeros. If anything is non-zero, stop and say so.
select
  (select count(*) from public.shops)    as shops,
  (select count(*) from public.products) as products,
  (select count(*) from public.orders)   as orders,
  (select count(*) from auth.users)      as users;
