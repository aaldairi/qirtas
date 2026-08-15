import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Icon } from "@/components/Icon";
import { priceCart, readCart } from "@/lib/cart";
import { getShopBySlug } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";

import { CheckoutFlow } from "./CheckoutFlow";

export default async function CheckoutPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const lang = await getLang();
  const d = t(lang);

  const cart = await priceCart(shop, await readCart(slug));
  if (cart.lines.length === 0) redirect(`/s/${slug}/cart`);

  return (
    <div className="flex flex-col gap-5 py-7">
      <div className="flex items-center gap-3">
        <Link
          href={`/s/${slug}/cart`}
          aria-label={d.common.back}
          className="text-mute"
        >
          <Icon name="arrow_back" size={22} className="rtl:rotate-180" />
        </Link>
        <h1 className="text-lg font-medium tracking-[-0.02em]">
          {d.shop.checkout}
        </h1>
      </div>

      <CheckoutFlow
        lang={lang}
        slug={slug}
        shop={{
          name: shop.name,
          iban_on: shop.iban_on,
          iban_value: shop.iban_value,
          wallet_on: shop.wallet_on,
          wallet_value: shop.wallet_value,
          cash_on: shop.cash_on,
          cash_value: shop.cash_value,
          pickup_on: shop.pickup_on,
          delivery_on: shop.delivery_on,
          delivery_fee: Number(shop.delivery_fee),
        }}
        subtotal={cart.subtotal}
        summary={cart.lines.map((l) => ({
          id: `${l.product.id}-${l.variant ?? ""}`,
          name: l.product.name,
          variant: l.variant,
          qty: l.qty,
          lineTotal: money(l.lineTotal),
        }))}
      />
    </div>
  );
}
