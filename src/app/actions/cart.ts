"use server";

import { revalidatePath } from "next/cache";

import { getShopBySlug } from "@/lib/data";
import { readCart, writeCart } from "@/lib/cart";
import type { CartLine } from "@/lib/types";

function sameLine(a: CartLine, productId: string, variant: string | null) {
  return a.productId === productId && (a.variant ?? null) === variant;
}

export async function addToCart(
  slug: string,
  productId: string,
  variant: string | null,
  qty: number,
): Promise<{ ok: boolean; count: number }> {
  const shop = await getShopBySlug(slug);
  if (!shop) return { ok: false, count: 0 };

  const amount = Math.min(999, Math.max(1, Math.trunc(qty) || 1));
  const lines = await readCart(slug);
  const existing = lines.find((l) => sameLine(l, productId, variant));

  if (existing) {
    existing.qty = Math.min(999, existing.qty + amount);
  } else {
    lines.push({ productId, variant, qty: amount });
  }

  await writeCart(slug, lines);
  revalidatePath(`/s/${slug}`, "layout");

  return { ok: true, count: lines.reduce((s, l) => s + l.qty, 0) };
}

export async function setCartQty(
  slug: string,
  productId: string,
  variant: string | null,
  qty: number,
): Promise<{ ok: boolean }> {
  const lines = await readCart(slug);
  const amount = Math.trunc(qty);

  const next =
    amount <= 0
      ? lines.filter((l) => !sameLine(l, productId, variant))
      : lines.map((l) =>
          sameLine(l, productId, variant)
            ? { ...l, qty: Math.min(999, amount) }
            : l,
        );

  await writeCart(slug, next);
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true };
}

export async function removeFromCart(
  slug: string,
  productId: string,
  variant: string | null,
): Promise<{ ok: boolean }> {
  const lines = await readCart(slug);
  await writeCart(
    slug,
    lines.filter((l) => !sameLine(l, productId, variant)),
  );
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true };
}

export async function clearCart(slug: string) {
  await writeCart(slug, []);
  revalidatePath(`/s/${slug}`, "layout");
}
