"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { decideOrder, getReceiptUrl } from "@/app/actions/orders";
import { Icon } from "@/components/Icon";
import { t, type Lang } from "@/lib/i18n";
import { fileSize } from "@/lib/format";
import { money } from "@/lib/money";
import type { OrderWithItems } from "@/lib/types";

import { STATUS_STYLE } from "./StatusPill";

export function OrderDetail({
  order,
  lang,
}: {
  order: OrderWithItems;
  lang: Lang;
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const actionable = order.status === "REVIEW" || order.status === "PENDING";
  const decided = order.status === "PAID" || order.status === "REJECTED";

  const methodLabel =
    order.payment_method === "cash"
      ? lang === "ar"
        ? "نقداً عند الاستلام"
        : "Cash on pickup"
      : order.payment_method === "wallet"
        ? lang === "ar"
          ? "محفظة إلكترونية"
          : "Wallet"
        : lang === "ar"
          ? "تحويل بنكي (IBAN)"
          : "Bank transfer (IBAN)";

  const statusLabel =
    d.dash.filters.find(([key]) => key === order.status)?.[1] ?? order.status;

  function copyDetail() {
    if (!order.payment_detail) return;
    navigator.clipboard?.writeText(order.payment_detail).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function openReceipt() {
    setReceiptLoading(true);
    const result = await getReceiptUrl(order.id);
    setReceiptLoading(false);
    if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function decide(decision: "PAID" | "REJECTED") {
    start(async () => {
      await decideOrder(order.id, decision);
      router.refresh();
    });
  }

  return (
    <section className="card flex flex-col gap-5 p-6 xl:sticky xl:top-6">
      <Link
        href="/dashboard/orders"
        className="flex items-center gap-2 text-[13px] text-mute xl:hidden"
      >
        <Icon name="arrow_back" size={18} className="rtl:rotate-180" />
        <span>{d.common.back}</span>
      </Link>

      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="truncate text-[19px] font-medium tracking-[-0.02em]">
            {order.customer_name}
          </h2>
          <p className="font-mono text-[11px] leading-[1.5] text-mute-2">
            <span className="num">{order.code}</span> ·{" "}
            <a
              href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
              dir="ltr"
              className="num hover:text-brand"
            >
              {order.customer_phone}
            </a>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-[20px] px-3 py-2 font-mono text-[10px] ${
            STATUS_STYLE[order.status]
          }`}
        >
          {statusLabel}
        </span>
      </header>

      {/* ----------------------------------------------------------- items */}
      <div className="overflow-hidden rounded-[14px] border border-line">
        {order.order_items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-line-4 px-4 py-3"
          >
            <div className="h-9 w-9 shrink-0 rounded-[9px] bg-[repeating-linear-gradient(135deg,#e7e3d9_0_6px,#f3f0e9_6px_12px)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[13px]">{item.name}</span>
              <span className="truncate font-mono text-[10px] text-mute-2">
                {item.variant_label ? `${item.variant_label} · ` : ""}
                <span className="num">×{item.qty}</span> ·{" "}
                <span className="num">{money(item.unit_price)}</span>
              </span>
            </div>
            <span className="num text-xs">{money(item.line_total)}</span>
          </div>
        ))}

        {Number(order.delivery_fee) > 0 ? (
          <div className="flex items-center justify-between border-b border-line-4 px-4 py-3">
            <span className="text-[13px] text-mute">{d.shop.delivery}</span>
            <span className="num text-xs">{money(order.delivery_fee)}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between bg-soft px-4 py-3">
          <span className="text-[13px] font-medium">{d.common.total}</span>
          <span className="num text-[15px] font-medium">
            {money(order.total)} BHD
          </span>
        </div>
      </div>

      {/* -------------------------------------------------- proof + method */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <span className="label">{d.dash.paymentProof}</span>

          {order.receipt_path ? (
            <button
              type="button"
              onClick={openReceipt}
              disabled={receiptLoading}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-3 text-start transition-colors hover:border-ink disabled:opacity-60"
            >
              <span className="flex h-12 w-9.5 shrink-0 items-end justify-center rounded-md bg-[repeating-linear-gradient(135deg,#e7e3d9_0_5px,#f3f0e9_5px_10px)] pb-1">
                <Icon name="receipt_long" size={15} className="text-mute-2" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-xs">
                  {order.receipt_name || "receipt"}
                </span>
                <span className="font-mono text-[10px] leading-[1.3] text-mute-2">
                  <span className="num">{fileSize(order.receipt_size)}</span>
                </span>
                <span className="text-[11px] font-medium text-brand">
                  {receiptLoading ? d.common.loading : d.dash.viewFull}
                </span>
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 p-5 text-center">
              <Icon name="hourglass_top" size={20} className="text-mute-5" />
              <span className="text-[11px] leading-[1.4] text-mute-2 text-pretty">
                {d.dash.awaitingReceipt}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="label">{d.dash.method}</span>
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-soft p-3">
            <span className="text-xs leading-[1.4]">{methodLabel}</span>
            {order.payment_detail ? (
              <button
                type="button"
                onClick={copyDetail}
                className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-white p-2.5 text-start"
              >
                <span
                  dir="ltr"
                  className="num min-w-0 flex-1 break-all text-[11px] leading-[1.45] text-mute"
                >
                  {order.payment_detail}
                </span>
                <Icon
                  name={copied ? "check" : "content_copy"}
                  size={16}
                  className={copied ? "text-ok" : "text-mute-2"}
                />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- decide */}
      {actionable ? (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => decide("REJECTED")}
            disabled={pending}
            className="btn btn-ghost !text-bad-ink"
          >
            {d.dash.reject}
          </button>
          <button
            type="button"
            onClick={() => decide("PAID")}
            disabled={pending}
            className="btn btn-ok flex-1"
          >
            <Icon name="check_circle" size={18} />
            <span>{pending ? d.common.saving : d.dash.confirmPayment}</span>
          </button>
        </div>
      ) : null}

      {decided ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2.5 rounded-[13px] border p-3.5 ${
            order.status === "PAID"
              ? "border-ok-line bg-ok-soft"
              : "border-bad-line bg-bad-soft"
          }`}
        >
          <Icon
            name={order.status === "PAID" ? "verified" : "cancel"}
            size={20}
            className={order.status === "PAID" ? "text-ok" : "text-bad"}
          />
          <p
            className={`text-xs leading-[1.5] text-pretty ${
              order.status === "PAID" ? "text-ok-ink" : "text-bad-ink"
            }`}
          >
            {order.status === "PAID" ? d.dash.paidMsg : d.dash.rejectedMsg}
          </p>
        </div>
      ) : null}
    </section>
  );
}
