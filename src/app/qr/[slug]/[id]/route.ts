import { NextResponse } from "next/server";

import { getProduct, getShopBySlug } from "@/lib/data";
import { qrPng } from "@/lib/qr";
import { productUrl } from "@/lib/urls";

/**
 * The product's QR as a real PNG file.
 *
 * The dialog used to link straight to a data: URL, which iOS Safari refuses
 * to download — the share sheet appears and then nothing happens. Serving
 * actual bytes with Content-Disposition works on every platform, and gives
 * shops a stable image URL they can drop into a print layout.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;

  const shop = await getShopBySlug(slug);
  if (!shop) return new NextResponse("Not found", { status: 404 });

  const productId = id.replace(/\.png$/i, "");
  const product = await getProduct(shop.id, productId);
  if (!product || !product.active) {
    return new NextResponse("Not found", { status: 404 });
  }

  const png = await qrPng(productUrl(slug, product.id));
  const filename =
    (product.sku || product.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "qr";

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${filename}.png"`,
      // The code only changes if the product id or domain changes.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
