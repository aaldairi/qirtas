"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireShop } from "@/lib/data";
import { fils } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const variantSchema = z.object({
  label: z.string().trim().min(1).max(40),
  qty: z.number().int().min(0).max(100000),
});

const productSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "needName").max(120),
  sku: z.string().trim().max(40).nullable(),
  category_id: z.string().uuid().nullable(),
  price: z.number().min(0).max(1000000),
  stock: z.number().int().min(0).max(1000000),
  track_stock: z.boolean(),
  description: z.string().trim().max(2000).nullable(),
  variants: z.array(variantSchema).max(30),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(raw: ProductInput): Promise<ProductResult> {
  const { shop } = await requireShop();

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message || "invalid" };
  }
  const input = parsed.data;

  const db = createAdminClient();
  const row = {
    shop_id: shop.id,
    name: input.name,
    sku: input.sku?.trim() || null,
    category_id: input.category_id,
    price: fils(input.price),
    stock: input.stock,
    track_stock: input.track_stock,
    description: input.description?.trim() || null,
  };

  let productId = input.id;

  if (productId) {
    // Scoping the update by shop_id is what stops one owner editing another's
    // catalogue by guessing a uuid.
    const { data, error } = await db
      .from("products")
      .update(row)
      .eq("id", productId)
      .eq("shop_id", shop.id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: mapError(error) };
    if (!data) return { ok: false, error: "notFound" };
  } else {
    const { data, error } = await db
      .from("products")
      .insert(row)
      .select("id")
      .single();

    if (error) return { ok: false, error: mapError(error) };
    productId = data.id;
  }

  // Variants are small and fully owner-authored: replacing the set is
  // simpler and more predictable than diffing it.
  await db.from("product_variants").delete().eq("product_id", productId);

  if (input.variants.length) {
    const { error } = await db.from("product_variants").insert(
      input.variants.map((v, i) => ({
        product_id: productId,
        label: v.label,
        qty: v.qty,
        sort: i,
      })),
    );
    if (error) return { ok: false, error: "somethingWrong" };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");

  return { ok: true, id: productId! };
}

function mapError(error: { code?: string }): string {
  if (error.code === "23505") return "skuTaken";
  return "somethingWrong";
}

export async function deleteProduct(
  productId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop();

  const db = createAdminClient();

  // Clean up the stored photo so deleted products don't leave orphaned files.
  const { data: existing } = await db
    .from("products")
    .select("image_path")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (error) return { ok: false };

  if (existing?.image_path) {
    await db.storage.from("product-images").remove([existing.image_path]);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return { ok: true };
}

export async function uploadProductImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { shop } = await requireShop();

  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "invalid" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "imageTooBig" };
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "imageBadType" };
  }

  const db = createAdminClient();

  const { data: product } = await db
    .from("products")
    .select("id, image_path")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!product) return { ok: false, error: "notFound" };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${shop.id}/${productId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return { ok: false, error: "somethingWrong" };

  await db.from("products").update({ image_path: path }).eq("id", productId);

  if (product.image_path && product.image_path !== path) {
    await db.storage.from("product-images").remove([product.image_path]);
  }

  const { data: pub } = db.storage.from("product-images").getPublicUrl(path);

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");

  return { ok: true, url: pub.publicUrl };
}

export async function removeProductImage(
  productId: string,
): Promise<{ ok: boolean }> {
  const { shop } = await requireShop();
  const db = createAdminClient();

  const { data: product } = await db
    .from("products")
    .select("image_path")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!product) return { ok: false };

  await db.from("products").update({ image_path: null }).eq("id", productId);
  if (product.image_path) {
    await db.storage.from("product-images").remove([product.image_path]);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return { ok: true };
}

export async function createCategory(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false }> {
  const { shop } = await requireShop();
  const clean = name.trim().slice(0, 40);
  if (!clean) return { ok: false };

  const db = createAdminClient();
  const { data, error } = await db
    .from("categories")
    .insert({ shop_id: shop.id, name: clean })
    .select("id, name")
    .single();

  if (error) return { ok: false };

  revalidatePath("/dashboard", "layout");
  return { ok: true, id: data.id, name: data.name };
}
