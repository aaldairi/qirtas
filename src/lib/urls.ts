import { siteUrl } from "@/lib/env";

/**
 * The QR destination for a product. This string is printed on shelf labels,
 * so it must stay stable for the life of the product — only the site origin
 * and the two ids compose it.
 */
export type ScanSource = "qr" | "nfc";

/**
 * Pass `via` when the URL is being burned into something physical, so the
 * shop can tell a scanned code from a tapped tag. Plain links omit it and
 * are recorded as "link".
 */
export function productUrl(
  slug: string,
  productId: string,
  via?: ScanSource,
): string {
  const base = `${siteUrl()}/s/${slug}/p/${productId}`;
  return via ? `${base}?via=${via}` : base;
}

export function storeUrl(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

export function orderUrl(token: string): string {
  return `${siteUrl()}/order/${token}`;
}
