import "server-only";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { fils } from "@/lib/money";
import type { CartLine, ProductWithVariants, Shop } from "@/lib/types";

const MAX_LINES = 40;
const MAX_QTY = 999;

export function cartCookieName(slug: string) {
  return `qirtas_cart_${slug}`;
}

export async function readCart(slug: string): Promise<CartLine[]> {
  const store = await cookies();
  const raw = store.get(cartCookieName(slug))?.value;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l?.productId === "string" &&
          typeof l?.qty === "number" &&
          Number.isFinite(l.qty),
      )
      .slice(0, MAX_LINES)
      .map((l) => ({
        productId: l.productId,
        variant: typeof l.variant === "string" && l.variant ? l.variant : null,
        qty: Math.min(MAX_QTY, Math.max(1, Math.trunc(l.qty))),
      }));
  } catch {
    return [];
  }
}

export async function writeCart(slug: string, lines: CartLine[]) {
  const store = await cookies();
  const trimmed = lines.slice(0, MAX_LINES);

  if (trimmed.length === 0) {
    store.delete(cartCookieName(slug));
    return;
  }

  store.set(cartCookieName(slug), JSON.stringify(trimmed), {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    httpOnly: false,
  });
}

export type PricedLine = {
  product: ProductWithVariants;
  variant: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Clamped because the shop sold out or reduced stock since it was added. */
  clampedTo: number | null;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  /** Lines dropped because the product vanished or went inactive. */
  dropped: number;
};

/**
 * Rebuilds the cart from the database on every read. The cookie only ever
 * carries ids and quantities — prices, names and stock come from the shop's
 * own rows, so a tampered cookie can't change what anything costs.
 */
export async function priceCart(
  shop: Shop,
  lines: CartLine[],
): Promise<PricedCart> {
  if (lines.length === 0) return { lines: [], subtotal: 0, dropped: 0 };

  const db = createAdminClient();
  const ids = [...new Set(lines.map((l) => l.productId))];

  const { data } = await db
    .from("products")
    .select("*, product_variants(id, product_id, label, qty, sort)")
    .eq("shop_id", shop.id)
    .eq("active", true)
    .in("id", ids);

  const products = new Map(
    ((data ?? []) as unknown as ProductWithVariants[]).map((p) => [p.id, p]),
  );

  const priced: PricedLine[] = [];
  let dropped = 0;

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) {
      dropped += 1;
      continue;
    }

    // A variant the shop has since removed falls back to no variant rather
    // than silently selling something that no longer exists.
    const variant =
      line.variant &&
      product.product_variants?.some((v) => v.label === line.variant)
        ? line.variant
        : null;

    let qty = line.qty;
    let clampedTo: number | null = null;

    if (product.track_stock && qty > product.stock) {
      qty = product.stock;
      clampedTo = product.stock;
    }

    if (qty <= 0) {
      dropped += 1;
      continue;
    }

    const unitPrice = Number(product.price);
    priced.push({
      product,
      variant,
      qty,
      unitPrice,
      lineTotal: fils(unitPrice * qty),
      clampedTo,
    });
  }

  const subtotal = fils(priced.reduce((sum, l) => sum + l.lineTotal, 0));
  return { lines: priced, subtotal, dropped };
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
