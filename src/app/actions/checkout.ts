"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { priceCart, readCart, writeCart } from "@/lib/cart";
import { getShopBySlug } from "@/lib/data";
import { fils } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/lib/types";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export type PlaceResult =
  | { ok: true; token: string; code: string }
  | { ok: false; error: string };

const schema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1, "needName").max(80),
  phone: z.string().trim().min(6, "needPhone").max(32),
  fulfilment: z.enum(["pickup", "delivery"]),
  payment: z.enum(["iban", "wallet", "cash"]),
  /** Storage path of a receipt already uploaded via uploadReceipt(). */
  receiptPath: z.string().trim().max(300).nullable(),
  receiptName: z.string().trim().max(160).nullable(),
  receiptSize: z.number().int().min(0).nullable(),
});

export type PlaceInput = z.input<typeof schema>;

/**
 * Stages a receipt in storage before the order exists. The file lands under a
 * random pending/ key; placeOrder then attaches it. Unattached files are just
 * orphans in a private bucket — never publicly reachable.
 */
export async function uploadReceipt(
  formData: FormData,
): Promise<
  | { ok: true; path: string; name: string; size: number }
  | { ok: false; error: string }
> {
  const slug = String(formData.get("slug") ?? "");
  const shop = await getShopBySlug(slug);
  if (!shop) return { ok: false, error: "shopNotFound" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "invalid" };
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "imageTooBig" };
  }
  if (!RECEIPT_TYPES.includes(file.type)) {
    return { ok: false, error: "imageBadType" };
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

  const path = `${shop.id}/pending/${crypto.randomUUID()}.${ext}`;

  const db = createAdminClient();
  const { error } = await db.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: "somethingWrong" };

  return {
    ok: true,
    path,
    name: file.name.slice(0, 160) || `receipt.${ext}`,
    size: file.size,
  };
}

export async function placeOrder(raw: PlaceInput): Promise<PlaceResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "invalid" };
  }
  const input = parsed.data;

  const shop = await getShopBySlug(input.slug);
  if (!shop) return { ok: false, error: "shopNotFound" };

  // The shop must actually accept the chosen method — a customer can't opt
  // into a payment route the owner switched off.
  const accepted: Record<PaymentMethod, boolean> = {
    iban: shop.iban_on,
    wallet: shop.wallet_on,
    cash: shop.cash_on,
  };
  if (!accepted[input.payment]) return { ok: false, error: "needPayment" };

  if (input.fulfilment === "pickup" && !shop.pickup_on) {
    return { ok: false, error: "needFulfilment" };
  }
  if (input.fulfilment === "delivery" && !shop.delivery_on) {
    return { ok: false, error: "needFulfilment" };
  }

  // Transfers must come with proof; cash on pickup obviously can't.
  const needsReceipt = input.payment === "iban" || input.payment === "wallet";
  if (needsReceipt && !input.receiptPath) {
    return { ok: false, error: "needReceipt" };
  }

  const cart = await readCart(input.slug);
  const priced = await priceCart(shop, cart);

  if (priced.lines.length === 0) return { ok: false, error: "cartEmpty" };

  const db = createAdminClient();

  const { data: code, error: codeError } = await db.rpc("next_order_code", {
    p_shop: shop.id,
  });
  if (codeError || !code) return { ok: false, error: "somethingWrong" };

  const deliveryFee =
    input.fulfilment === "delivery" ? Number(shop.delivery_fee) : 0;
  const total = fils(priced.subtotal + deliveryFee);

  const paymentDetail =
    input.payment === "iban"
      ? shop.iban_value
      : input.payment === "wallet"
        ? shop.wallet_value
        : shop.cash_value;

  // A receipt attached up front means the owner has something to review now;
  // cash orders simply wait for the customer to turn up.
  const status = needsReceipt ? "REVIEW" : "PENDING";

  let receiptPath = input.receiptPath;
  if (receiptPath) {
    // Move it out of pending/ so the file is filed under its order.
    const ext = receiptPath.split(".").pop() ?? "jpg";
    const finalPath = `${shop.id}/${code.replace("#", "")}-${Date.now()}.${ext}`;
    const { error: moveError } = await db.storage
      .from("receipts")
      .move(receiptPath, finalPath);
    if (!moveError) receiptPath = finalPath;
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      shop_id: shop.id,
      code,
      customer_name: input.name,
      customer_phone: input.phone,
      fulfilment: input.fulfilment,
      delivery_fee: deliveryFee,
      payment_method: input.payment,
      payment_detail: paymentDetail,
      status,
      subtotal: priced.subtotal,
      total,
      receipt_path: receiptPath,
      receipt_name: input.receiptName,
      receipt_size: input.receiptSize,
      receipt_at: receiptPath ? new Date().toISOString() : null,
    })
    .select("id, public_token, code")
    .single();

  if (orderError || !order) return { ok: false, error: "somethingWrong" };

  const { error: itemsError } = await db.from("order_items").insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      name: l.product.name,
      variant_label: l.variant,
      qty: l.qty,
      unit_price: l.unitPrice,
      line_total: l.lineTotal,
    })),
  );

  if (itemsError) {
    // Don't leave a total with nothing under it.
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "somethingWrong" };
  }

  // Hold the stock now so two customers can't buy the same last item while
  // the shop is still reviewing the first receipt. Rejecting puts it back.
  // adjust_stock does this in one atomic UPDATE per row.
  await Promise.all(
    priced.lines
      .filter((l) => l.product.track_stock)
      .map((l) =>
        db.rpc("adjust_stock", { p_product: l.product.id, p_delta: -l.qty }),
      ),
  );

  await writeCart(input.slug, []);

  revalidatePath(`/s/${input.slug}`, "layout");
  revalidatePath("/dashboard", "layout");

  return { ok: true, token: order.public_token, code: order.code };
}
