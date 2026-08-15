import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { getProduct, getShopBySlug } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { VISITOR_COOKIE } from "@/proxy";

import { BuyPanel } from "./BuyPanel";

export async function generateMetadata(props: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) return { title: "Qirtas" };

  const product = await getProduct(shop.id, id);
  if (!product) return { title: shop.name };

  return {
    title: `${product.name} · ${shop.name}`,
    description: product.description ?? undefined,
  };
}

/** One scan per visitor per product per day; the unique index does the rest. */
async function recordScan(shopId: string, productId: string, visitor: string) {
  const db = createAdminClient();
  await db
    .from("scan_events")
    .insert({ shop_id: shopId, product_id: productId, visitor });
}

export default async function ProductPage(props: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const lang = await getLang();
  const d = t(lang);
  const product = await getProduct(shop.id, id);

  // Read before after(): Server Components may not call request APIs like
  // cookies() inside an after() callback.
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;

  if (!product || !product.active) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Icon name="search_off" size={32} className="text-mute-5" />
        <p className="text-lg font-medium">{d.shop.notFound}</p>
        <p className="max-w-[300px] text-[13px] leading-[1.6] text-mute-2 text-pretty">
          {d.shop.notFoundSub}
        </p>
        <Link href={`/s/${slug}`} className="btn btn-ink mt-3">
          {d.shop.browseStore}
        </Link>
      </div>
    );
  }

  // Counted after the response is sent: a customer standing in the shop
  // should never wait on analytics, and a failed insert must not break the
  // page their camera just opened.
  if (visitor) {
    after(async () => {
      try {
        await recordScan(shop.id, product.id, visitor);
      } catch {
        // Duplicate scan for today, or a transient DB blip. Neither matters.
      }
    });
  }

  const out = product.track_stock && product.stock <= 0;
  const variants = product.product_variants ?? [];

  return (
    <div className="grid gap-7 py-7 md:grid-cols-2 md:gap-9">
      <ProductImage
        path={product.image_path}
        alt={product.name}
        className="aspect-square w-full rounded-[20px] border border-line"
      />

      <div className="flex flex-col gap-4">
        {product.categories?.name ? (
          <span className="label">{product.categories.name}</span>
        ) : null}

        <h1 className="text-[25px] font-medium leading-[1.2] tracking-[-0.03em] text-pretty">
          {product.name}
        </h1>

        <div className="flex items-baseline gap-2">
          <span className="num text-[23px] font-medium">
            {money(product.price)}
          </span>
          <span className="font-mono text-xs text-mute-2">BHD</span>
          <span
            className={`num ms-auto font-mono text-[11px] ${
              out ? "text-bad" : "text-mute-2"
            }`}
          >
            {out
              ? d.common.outOfStock
              : product.track_stock
                ? `${product.stock} ${d.common.inStock}`
                : ""}
          </span>
        </div>

        {product.description ? (
          <p className="text-[13px] leading-[1.65] text-mute text-pretty">
            {product.description}
          </p>
        ) : null}

        <BuyPanel
          lang={lang}
          slug={slug}
          productId={product.id}
          variants={variants.map((v) => ({ label: v.label, qty: v.qty }))}
          maxQty={product.track_stock ? product.stock : 999}
          outOfStock={out}
        />

        <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-soft p-3.5">
          <Icon name="storefront" size={20} className="text-mute-2" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-xs font-medium">{shop.name}</span>
            <span className="font-mono text-[10px] leading-[1.3] text-mute-2">
              {shop.pickup_on && shop.delivery_on
                ? lang === "ar"
                  ? "استلام أو توصيل"
                  : "Pickup or delivery"
                : shop.delivery_on
                  ? d.shop.delivery
                  : d.shop.pickup}
            </span>
          </span>
          <Link
            href={`/s/${slug}`}
            className="shrink-0 text-[11px] font-medium text-brand"
          >
            {d.shop.browseStore}
          </Link>
        </div>
      </div>
    </div>
  );
}
