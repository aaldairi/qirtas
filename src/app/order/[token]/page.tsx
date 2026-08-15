import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { getOrderByToken } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";

import { CopyLink } from "./CopyLink";

export const metadata = { robots: { index: false, follow: false } };

export default async function OrderPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const lang = await getLang();
  const d = t(lang);

  const found = await getOrderByToken(token);

  if (!found) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-shell px-6 text-center">
        <Icon name="search_off" size={32} className="text-mute-5" />
        <p className="text-lg font-medium">{d.shop.orderNotFound}</p>
        <Link href="/" className="btn btn-ink mt-3">
          {d.brand}
        </Link>
      </div>
    );
  }

  const { order, shop } = found;
  const paid = order.status === "PAID";
  const rejected = order.status === "REJECTED";
  const cash = order.payment_method === "cash";

  const steps = [
    {
      icon: "check_circle",
      color: "text-ok",
      titleColor: "text-ink",
      title: d.shop.trackPlaced,
      meta: new Date(order.created_at).toLocaleString(
        lang === "ar" ? "ar-BH" : "en-GB",
        { dateStyle: "medium", timeStyle: "short" },
      ),
    },
    {
      icon: paid ? "check_circle" : rejected ? "cancel" : "hourglass_top",
      color: paid ? "text-ok" : rejected ? "text-bad" : "text-warn",
      titleColor: paid || rejected ? "text-ink" : "text-mute",
      title: paid
        ? d.shop.trackPaid
        : rejected
          ? d.shop.trackRejected
          : cash
            ? d.shop.trackWaitingCash
            : d.shop.trackReviewing,
      meta: paid
        ? d.shop.trackPaidMeta
        : rejected
          ? d.shop.trackRejectedMeta
          : cash
            ? d.shop.trackWaitingCashMeta
            : d.shop.trackReviewingMeta,
    },
    {
      icon: paid ? "storefront" : "radio_button_unchecked",
      color: paid ? "text-ink" : "text-line-5",
      titleColor: paid ? "text-ink" : "text-mute-4",
      title: order.fulfilment === "pickup" ? d.shop.pickup : d.shop.delivery,
      meta:
        order.fulfilment === "pickup"
          ? d.shop.trackPickupMeta
          : d.shop.trackDeliveryMeta,
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-[560px] items-center gap-3 px-4 sm:px-6">
          <Link
            href={`/s/${shop.slug}`}
            className="flex min-w-0 items-center gap-2.5"
          >
            <Icon name="storefront" size={22} />
            <span className="truncate text-base font-medium">{shop.name}</span>
          </Link>
          <LangToggle
            lang={lang}
            label={lang === "ar" ? "EN" : "ع"}
            iconSize={16}
            className="ms-auto rounded-full px-2.5 py-2 text-[11px] font-medium text-mute"
          />
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center gap-5 px-4 py-9 sm:px-6"
      >
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            rejected ? "bg-bad-soft" : paid ? "bg-ok-soft" : "bg-warn-soft"
          }`}
        >
          <Icon
            name={rejected ? "cancel" : paid ? "verified" : "check_circle"}
            size={34}
            className={
              rejected ? "text-bad" : paid ? "text-ok" : "text-warn-ink"
            }
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-center text-2xl font-medium leading-[1.2] tracking-[-0.03em]">
            {paid
              ? d.shop.trackPaid
              : rejected
                ? d.shop.trackRejected
                : d.shop.doneTitle}
          </h1>
          <p className="text-center text-[13px] leading-[1.6] text-mute text-pretty">
            {paid
              ? d.shop.trackPaidMeta
              : rejected
                ? d.shop.trackRejectedMeta
                : d.shop.doneSub}
          </p>
        </div>

        {/* ------------------------------------------------------- order */}
        <div className="card w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-4 px-4 py-3.5">
            <span className="font-mono text-[11px] text-mute-2">
              {d.shop.orderNo}
            </span>
            <span className="num text-sm font-medium">{order.code}</span>
          </div>

          {order.order_items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-line-4 px-4 py-3"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-medium">
                  {item.name}
                </span>
                <span className="font-mono text-[10px] text-mute-2">
                  {item.variant_label ? `${item.variant_label} · ` : ""}
                  <span className="num">×{item.qty}</span>
                </span>
              </span>
              <span className="num text-xs">{money(item.line_total)}</span>
            </div>
          ))}

          {Number(order.delivery_fee) > 0 ? (
            <div className="flex items-center justify-between border-b border-line-4 px-4 py-3">
              <span className="text-xs text-mute">{d.shop.delivery}</span>
              <span className="num text-xs">{money(order.delivery_fee)}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between bg-soft px-4 py-3.5">
            <span className="text-[13px] font-medium">{d.common.total}</span>
            <span className="num text-[15px] font-medium">
              {money(order.total)} BHD
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------ status */}
        <ol className="flex w-full flex-col gap-3.5">
          {steps.map((s) => (
            <li key={s.title} className="flex items-start gap-3">
              <Icon name={s.icon} size={20} className={s.color} />
              <span className="flex flex-1 flex-col gap-1">
                <span className={`text-[13px] font-medium ${s.titleColor}`}>
                  {s.title}
                </span>
                <span className="text-[11px] leading-[1.45] text-mute-2 text-pretty">
                  {s.meta}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <CopyLink lang={lang} note={d.shop.saveLink} copy={d.common.copy} />

        <div className="flex w-full flex-col gap-2.5 sm:flex-row">
          <Link
            href={`/s/${shop.slug}`}
            className="btn btn-ghost flex-1 bg-paper"
          >
            {d.shop.keepShopping}
          </Link>
          {shop.whatsapp ? (
            <a
              href={`https://wa.me/${shop.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                `${order.code}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ink flex-1"
            >
              <Icon name="chat" size={18} />
              <span>{d.shop.contactShop}</span>
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
