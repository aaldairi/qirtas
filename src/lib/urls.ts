import { siteUrl } from "@/lib/env";

/**
 * The QR destination for a product. This string is printed on shelf labels,
 * so it must stay stable for the life of the product — only the site origin
 * and the two ids compose it.
 */
export function productUrl(slug: string, productId: string): string {
  return `${siteUrl()}/s/${slug}/p/${productId}`;
}

export function storeUrl(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

export function orderUrl(token: string): string {
  return `${siteUrl()}/order/${token}`;
}
