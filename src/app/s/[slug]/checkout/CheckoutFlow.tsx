"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { placeOrder, uploadReceipt } from "@/app/actions/checkout";
import { Icon } from "@/components/Icon";
import { fileSize } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";
import { money } from "@/lib/money";
import type { Fulfilment, PaymentMethod } from "@/lib/types";

type ShopView = {
  name: string;
  iban_on: boolean;
  iban_value: string | null;
  wallet_on: boolean;
  wallet_value: string | null;
  cash_on: boolean;
  cash_value: string | null;
  pickup_on: boolean;
  delivery_on: boolean;
  delivery_fee: number;
};

type SummaryLine = {
  id: string;
  name: string;
  variant: string | null;
  qty: number;
  lineTotal: string;
};

type Receipt = { path: string; name: string; size: number };

export function CheckoutFlow({
  lang,
  slug,
  shop,
  subtotal,
  summary,
}: {
  lang: Lang;
  slug: string;
  shop: ShopView;
  subtotal: number;
  summary: SummaryLine[];
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fulfilOptions = [
    shop.pickup_on ? ("pickup" as const) : null,
    shop.delivery_on ? ("delivery" as const) : null,
  ].filter(Boolean) as Fulfilment[];

  const payOptions = [
    shop.iban_on ? ("iban" as const) : null,
    shop.wallet_on ? ("wallet" as const) : null,
    shop.cash_on ? ("cash" as const) : null,
  ].filter(Boolean) as PaymentMethod[];

  const [fulfilment, setFulfilment] = useState<Fulfilment>(
    fulfilOptions[0] ?? "pickup",
  );
  const [payment, setPayment] = useState<PaymentMethod>(
    payOptions[0] ?? "cash",
  );

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const deliveryFee = fulfilment === "delivery" ? shop.delivery_fee : 0;
  const total = subtotal + deliveryFee;
  const needsTransfer = payment === "iban" || payment === "wallet";

  const messages: Record<string, string> = {
    needName: d.shop.needName,
    needPhone: d.shop.needPhone,
    needReceipt: d.shop.needReceipt,
    needPayment: d.shop.needPayment,
    imageTooBig: d.dash.imageTooBig,
    imageBadType: d.dash.imageBadType,
    cartEmpty: d.shop.cartEmpty,
  };

  function next() {
    if (!name.trim()) return setError(d.shop.needName);
    if (phone.trim().length < 6) return setError(d.shop.needPhone);
    setError("");
    setStep(2);
  }

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");

    const body = new FormData();
    body.set("slug", slug);
    body.set("file", file);

    const result = await uploadReceipt(body);
    setUploading(false);

    if (result.ok) {
      setReceipt({ path: result.path, name: result.name, size: result.size });
    } else {
      setError(messages[result.error] ?? d.common.somethingWrong);
    }
  }

  function copy(key: string, value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  }

  function submit() {
    if (needsTransfer && !receipt) return setError(d.shop.needReceipt);
    setError("");

    start(async () => {
      const result = await placeOrder({
        slug,
        name: name.trim(),
        phone: phone.trim(),
        fulfilment,
        payment,
        receiptPath: receipt?.path ?? null,
        receiptName: receipt?.name ?? null,
        receiptSize: receipt?.size ?? null,
      });

      if (!result.ok) {
        setError(messages[result.error] ?? d.common.somethingWrong);
        return;
      }

      router.push(`/order/${result.token}`);
    });
  }

  const transferFields = [
    { key: "name", label: d.shop.beneficiary, value: shop.name, mono: false },
    {
      key: "acc",
      label: payment === "wallet" ? d.shop.wallet : "IBAN",
      value:
        (payment === "wallet" ? shop.wallet_value : shop.iban_value) ?? "—",
      mono: true,
    },
    { key: "amt", label: d.shop.amount, value: `${money(total)} BHD`, mono: true },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ progress */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-[3px] flex-1 rounded-sm ${
                n <= step ? "bg-ink" : "bg-line"
              }`}
            />
          ))}
        </div>
        <span className="num text-[11px] text-mute-2">{step} / 2</span>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium tracking-[-0.02em]">
            {d.shop.yourDetails}
          </h2>

          <label className="flex flex-col gap-2">
            <span className="label">{d.shop.fullName}</span>
            <input
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              placeholder={d.shop.namePh}
              className="field text-[15px] font-medium"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label">{d.shop.phone}</span>
            <input
              value={phone}
              dir="ltr"
              type="tel"
              autoComplete="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder={d.shop.phonePh}
              className="field font-mono text-sm"
            />
          </label>

          {fulfilOptions.length > 0 ? (
            <fieldset
              role="radiogroup"
              aria-label={d.shop.fulfilment}
              className="flex flex-col gap-2.5"
            >
              <legend className="label mb-2.5">{d.shop.fulfilment}</legend>
              {fulfilOptions.map((option) => (
                <Choice
                  key={option}
                  icon={option === "pickup" ? "storefront" : "local_shipping"}
                  label={option === "pickup" ? d.shop.pickup : d.shop.delivery}
                  meta={
                    option === "pickup"
                      ? d.shop.pickupMeta
                      : shop.delivery_fee > 0
                        ? `${d.shop.deliveryMeta} · ${money(shop.delivery_fee)} BHD`
                        : `${d.shop.deliveryMeta} · ${d.shop.pickupFree}`
                  }
                  on={fulfilment === option}
                  onClick={() => setFulfilment(option)}
                />
              ))}
            </fieldset>
          ) : null}

          {error ? <ErrorNote text={error} /> : null}

          <button type="button" onClick={next} className="btn btn-ink py-4.5 text-sm">
            {d.shop.continuePay}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-medium tracking-[-0.02em]">
              {d.shop.payTitle}
            </h2>
            <p className="text-xs leading-[1.55] text-mute text-pretty">
              {d.shop.paySub}
            </p>
          </div>

          {/* ------------------------------------------------- summary */}
          <div className="card overflow-hidden">
            {summary.map((line) => (
              <div
                key={line.id}
                className="flex items-center gap-3 border-b border-line-4 px-4 py-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium">
                    {line.name}
                  </span>
                  <span className="font-mono text-[10px] text-mute-2">
                    {line.variant ? `${line.variant} · ` : ""}
                    <span className="num">×{line.qty}</span>
                  </span>
                </span>
                <span className="num text-xs">{line.lineTotal}</span>
              </div>
            ))}
            {deliveryFee > 0 ? (
              <div className="flex items-center justify-between border-b border-line-4 px-4 py-3">
                <span className="text-xs text-mute">{d.shop.delivery}</span>
                <span className="num text-xs">{money(deliveryFee)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between bg-soft px-4 py-3">
              <span className="text-[13px] font-medium">{d.common.total}</span>
              <span className="num text-[15px] font-medium">
                {money(total)} BHD
              </span>
            </div>
          </div>

          {/* --------------------------------------------- pay methods */}
          <fieldset
            role="radiogroup"
            aria-label={d.shop.payTitle}
            className="flex flex-col gap-2.5"
          >
            <legend className="sr-only">{d.shop.payTitle}</legend>
            {payOptions.map((option) => (
              <Choice
                key={option}
                icon={
                  option === "iban"
                    ? "account_balance"
                    : option === "wallet"
                      ? "account_balance_wallet"
                      : "payments"
                }
                label={
                  option === "iban"
                    ? lang === "ar"
                      ? "تحويل بنكي (IBAN)"
                      : "Bank transfer (IBAN)"
                    : option === "wallet"
                      ? lang === "ar"
                        ? "محفظة إلكترونية"
                        : "Wallet"
                      : lang === "ar"
                        ? "نقداً عند الاستلام"
                        : "Cash on pickup"
                }
                on={payment === option}
                onClick={() => {
                  setPayment(option);
                  setError("");
                }}
              />
            ))}
          </fieldset>

          {/* ------------------------------------------ transfer details */}
          {needsTransfer ? (
            <>
              <div className="flex flex-col gap-3.5 rounded-[18px] bg-ink p-4.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-mute-2">
                    {d.shop.transferTo}
                  </span>
                  <span className="num text-[15px] font-medium text-paper">
                    {money(total)} BHD
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {transferFields.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => copy(f.key, f.value)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[11px] bg-white/7 p-3 text-start"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-mono text-[9px] tracking-[0.1em] text-mute-2">
                          {f.label}
                        </span>
                        <span
                          dir={f.mono ? "ltr" : undefined}
                          className={`break-all text-sm font-medium leading-[1.35] text-paper ${
                            f.mono ? "num" : ""
                          }`}
                        >
                          {f.value}
                        </span>
                      </span>
                      <Icon
                        name={copied === f.key ? "check" : "content_copy"}
                        size={18}
                        className={
                          copied === f.key ? "text-ok-line" : "text-mute-2"
                        }
                      />
                    </button>
                  ))}
                </div>

                <p className="text-[11px] leading-[1.6] text-mute-3 text-pretty">
                  {d.shop.transferNote}
                </p>
              </div>

              {/* --------------------------------------------- receipt */}
              <div className="flex flex-col gap-2.5">
                <span className="label">{d.shop.attachReceipt}</span>

                {receipt ? (
                  <div className="flex items-center gap-3 rounded-[14px] border border-ok-line bg-white p-3">
                    <span className="flex h-13 w-11 shrink-0 items-end justify-center rounded-lg bg-[repeating-linear-gradient(135deg,#e7e3d9_0_5px,#f3f0e9_5px_10px)] pb-1">
                      <Icon name="receipt_long" size={15} className="text-mute-2" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-xs font-medium">
                        {receipt.name}
                      </span>
                      <span className="num font-mono text-[10px] text-mute-2">
                        {fileSize(receipt.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={d.common.delete}
                      onClick={() => setReceipt(null)}
                      className="cursor-pointer text-mute-5 hover:text-bad"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border border-dashed border-line-5 bg-soft px-4 py-6 transition-colors hover:border-ink disabled:opacity-60"
                  >
                    <Icon
                      name={uploading ? "progress_activity" : "upload_file"}
                      size={26}
                      className="text-mute-4"
                    />
                    <span className="text-xs font-medium text-mute">
                      {uploading ? d.shop.uploading : d.shop.uploadReceipt}
                    </span>
                    <span className="font-mono text-[10px] text-mute-4">
                      {d.shop.uploadHint}
                    </span>
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={attach}
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-soft p-4">
              <Icon name="storefront" size={22} className="text-mute" />
              <p className="text-xs leading-[1.55] text-ink-3 text-pretty">
                {shop.cash_value || d.shop.cashNote}
              </p>
            </div>
          )}

          {error ? <ErrorNote text={error} /> : null}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-ghost"
            >
              {d.common.back}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || uploading}
              className="btn btn-ink flex-1 py-4.5 text-sm"
            >
              {pending ? d.shop.placing : d.shop.placeOrder}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Choice({
  icon,
  label,
  meta,
  on,
  onClick,
}: {
  icon: string;
  label: string;
  meta?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 rounded-[14px] border p-3.5 text-start transition-colors ${
        on ? "border-ink bg-white" : "border-line bg-soft hover:border-line-2"
      }`}
    >
      <Icon name={icon} size={21} className={on ? "text-ink" : "text-mute-2"} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium">{label}</span>
        {meta ? (
          <span className="font-mono text-[10px] leading-[1.4] text-mute-2">
            {meta}
          </span>
        ) : null}
      </span>
      <Icon
        name={on ? "radio_button_checked" : "radio_button_unchecked"}
        size={20}
        className={on ? "text-ok" : "text-line-5"}
      />
    </button>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3.5 py-3 text-xs font-medium text-bad-ink"
    >
      <Icon name="error" size={17} />
      <span>{text}</span>
    </p>
  );
}
