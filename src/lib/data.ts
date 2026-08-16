import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type {
  Category,
  Order,
  OrderWithItems,
  Product,
  ProductWithVariants,
  Shop,
} from "@/lib/types";

const PRODUCT_SELECT =
  "*, product_variants(id, product_id, label, qty, sort), categories(id, name)";

/**
 * Every dashboard route funnels through here: it resolves the signed-in user
 * to the shop they own. Nothing downstream re-checks ownership, so the
 * service-role queries below are only ever scoped to this shop id.
 */
export async function requireShop(): Promise<{ shop: Shop; email: string }> {
  const user = await getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();
  const { data, error } = await db
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) redirect("/onboarding");

  return { shop: data as Shop, email: user.email ?? "" };
}

/** Like requireShop but tolerates "no shop yet" — used by /onboarding. */
export async function getOwnShop(): Promise<Shop | null> {
  const user = await getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as Shop) ?? null;
}

// ------------------------------------------------------------------ shop

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("shops")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  return (data as Shop) ?? null;
}

export async function slugTaken(slug: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("shops")
    .select("id")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

// -------------------------------------------------------------- products

export async function listProducts(
  shopId: string,
  opts: { onlyActive?: boolean } = {},
): Promise<ProductWithVariants[]> {
  const db = createAdminClient();
  let q = db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (opts.onlyActive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as unknown as ProductWithVariants[];
  for (const p of rows) {
    p.product_variants?.sort((a, b) => a.sort - b.sort);
  }
  return rows;
}

export async function getProduct(
  shopId: string,
  productId: string,
): Promise<ProductWithVariants | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("shop_id", shopId)
    .eq("id", productId)
    .maybeSingle();

  const product = (data as unknown as ProductWithVariants) ?? null;
  product?.product_variants?.sort((a, b) => a.sort - b.sort);
  return product;
}

export async function listCategories(shopId: string): Promise<Category[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("categories")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort")
    .order("name");
  return (data ?? []) as Category[];
}

// ---------------------------------------------------------------- orders

export async function listOrders(shopId: string): Promise<OrderWithItems[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

export async function getOrderForShop(
  shopId: string,
  orderId: string,
): Promise<OrderWithItems | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("shop_id", shopId)
    .eq("id", orderId)
    .maybeSingle();
  return (data as unknown as OrderWithItems) ?? null;
}

/**
 * Customer-side order lookup. The token is an unguessable uuid handed out
 * only on the confirmation page, so it stands in for authentication.
 */
export async function getOrderByToken(
  token: string,
): Promise<{ order: OrderWithItems; shop: Shop } | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("*, order_items(*), shops(*)")
    .eq("public_token", token)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as OrderWithItems & { shops: Shop };
  const { shops, ...order } = row;
  return { order: order as OrderWithItems, shop: shops };
}

// ----------------------------------------------------------------- stats

export type DashboardStats = {
  salesToday: number;
  orderCount: number;
  pendingCount: number;
  scanCount: number;
};

export async function getStats(shopId: string): Promise<DashboardStats> {
  const db = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [paidToday, orderCount, pendingCount, scanCount] = await Promise.all([
    db
      .from("orders")
      .select("total")
      .eq("shop_id", shopId)
      .eq("status", "PAID")
      .gte("decided_at", startOfToday.toISOString()),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .in("status", ["REVIEW", "PENDING"]),
    db
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
  ]);

  const salesToday = (paidToday.data ?? []).reduce(
    (sum, row) => sum + Number((row as { total: number }).total),
    0,
  );

  return {
    salesToday,
    orderCount: orderCount.count ?? 0,
    pendingCount: pendingCount.count ?? 0,
    scanCount: scanCount.count ?? 0,
  };
}

export type ScanBreakdown = { qr: number; nfc: number; link: number };

/**
 * How customers reached products: scanned code, tapped tag, or plain link.
 * Returns zeros if the source column has not been added yet, rather than
 * failing the whole dashboard.
 */
export async function getScanBreakdown(shopId: string): Promise<ScanBreakdown> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_events")
    .select("source")
    .eq("shop_id", shopId);

  const totals: ScanBreakdown = { qr: 0, nfc: 0, link: 0 };
  if (error) return totals;

  for (const row of (data ?? []) as { source: string | null }[]) {
    const key = (row.source ?? "link") as keyof ScanBreakdown;
    if (key in totals) totals[key] += 1;
  }
  return totals;
}

/** Real scan counts per product, highest first. No synthetic numbers. */
export async function getScanCounts(
  shopId: string,
): Promise<Map<string, number>> {
  const db = createAdminClient();
  const { data } = await db
    .from("scan_events")
    .select("product_id")
    .eq("shop_id", shopId);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { product_id: string }[]) {
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
  }
  return counts;
}

export type { Order, Product, Shop };
