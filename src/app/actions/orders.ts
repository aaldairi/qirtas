"use server";

import { revalidatePath } from "next/cache";

import { requireShop } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";

export async function decideOrder(
  orderId: string,
  decision: "PAID" | "REJECTED",
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop();
  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("id, status, order_items(product_id, qty)")
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!order) return { ok: false };

  const current = order.status as OrderStatus;
  // Only undecided orders can be decided; re-clicking must not double-refund.
  if (current !== "REVIEW" && current !== "PENDING") return { ok: false };

  const { error } = await db
    .from("orders")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .in("status", ["REVIEW", "PENDING"]);

  if (error) return { ok: false };

  if (decision === "REJECTED") {
    // Put the held stock back on the shelf. adjust_stock is a no-op for
    // products the shop doesn't track.
    const items = (order.order_items ?? []) as {
      product_id: string | null;
      qty: number;
    }[];

    await Promise.all(
      items
        .filter((item) => item.product_id)
        .map((item) =>
          db.rpc("adjust_stock", {
            p_product: item.product_id,
            p_delta: item.qty,
          }),
        ),
    );
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return { ok: true };
}

/**
 * Receipts live in a private bucket. The owner gets a short-lived signed URL
 * so payment evidence is never sitting on a guessable public path.
 */
export async function getReceiptUrl(
  orderId: string,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const { shop } = await requireShop();
  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("receipt_path")
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!order?.receipt_path) return { ok: false };

  const { data, error } = await db.storage
    .from("receipts")
    .createSignedUrl(order.receipt_path, 60 * 10);

  if (error || !data) return { ok: false };
  return { ok: true, url: data.signedUrl };
}
