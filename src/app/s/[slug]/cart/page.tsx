import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { priceCart, readCart } from "@/lib/cart";
import { getShopBySlug } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";

import { CartRow } from "./CartRow";

export default async function CartPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const lang = await getLang();
  const d = t(lang);

  const cart = await priceCart(shop, await readCart(slug));

  return (
    <div className="flex flex-col gap-5 py-7">
      <div className="flex items-center gap-3">
        <Link
          href={`/s/${slug}`}
          aria-label={d.common.back}
          className="text-mute"
        >
          <Icon name="arrow_back" size={22} className="rtl:rotate-180" />
        </Link>
        <h1 className="text-lg font-medium tracking-[-0.02em]">
          {d.shop.cart}
        </h1>
        {cart.lines.length > 0 ? (
          <span className="num text-xs text-mute-2">
            ({cart.lines.reduce((s, l) => s + l.qty, 0)})
          </span>
        ) : null}
      </div>

      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-2 px-6 py-16 text-center">
          <Icon name="shopping_bag" size={30} className="text-mute-5" />
          <p className="text-sm font-medium text-mute-2">{d.shop.cartEmpty}</p>
          <Link href={`/s/${slug}`} className="btn btn-ink mt-2">
            {d.shop.browseStore}
          </Link>
        </div>
      ) : (
        <>
          {cart.dropped > 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-warn-soft bg-warn-soft px-3.5 py-3 text-xs text-warn-ink">
              <Icon name="info" size={17} />
              <span>
                {lang === "ar"
                  ? "أزلنا منتجات لم تعد متاحة من سلتك."
                  : "Some items are no longer available and were removed."}
              </span>
            </p>
          ) : null}

          <ul className="flex flex-col gap-2.5">
            {cart.lines.map((line) => (
              <li
                key={`${line.product.id}-${line.variant ?? ""}`}
                className="card flex items-center gap-3.5 p-3"
              >
                <ProductImage
                  path={line.product.image_path}
                  alt={line.product.name}
                  className="h-14 w-14 shrink-0 rounded-xl"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link
                    href={`/s/${slug}/p/${line.product.id}`}
                    className="truncate text-[13px] font-medium hover:text-brand"
                  >
                    {line.product.name}
                  </Link>
                  <span className="truncate font-mono text-[10px] text-mute-2">
                    {line.variant ? `${line.variant} · ` : ""}
                    <span className="num">{money(line.unitPrice)}</span> BHD
                  </span>
                  {line.clampedTo !== null ? (
                    <span className="font-mono text-[10px] text-warn-ink">
                      {lang === "ar"
                        ? `المتاح ${line.clampedTo} فقط`
                        : `Only ${line.clampedTo} available`}
                    </span>
                  ) : null}
                  <CartRow
                    lang={lang}
                    slug={slug}
                    productId={line.product.id}
                    variant={line.variant}
                    qty={line.qty}
                  />
                </div>
                <span className="num shrink-0 text-[13px] font-medium">
                  {money(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="card flex flex-col gap-2.5 bg-soft p-4">
            <div className="flex justify-between text-xs">
              <span className="text-mute">{d.common.subtotal}</span>
              <span className="num font-medium">{money(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-mute">{d.shop.fulfilment}</span>
              <span className="text-mute-2">
                {lang === "ar" ? "يُحدد عند الدفع" : "Chosen at checkout"}
              </span>
            </div>
            <div className="h-px bg-line" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{d.common.total}</span>
              <span className="num text-[17px] font-medium">
                {money(cart.subtotal)} BHD
              </span>
            </div>
          </div>

          <Link
            href={`/s/${slug}/checkout`}
            className="btn btn-ink py-4.5 text-sm"
          >
            {d.shop.checkout}
          </Link>
        </>
      )}
    </div>
  );
}
