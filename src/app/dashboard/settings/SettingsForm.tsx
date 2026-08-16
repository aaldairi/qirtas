"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { checkSlug, updateShop, updateSlug } from "@/app/actions/shop";
import { Icon } from "@/components/Icon";
import { PaymentMethods, type PayState } from "@/components/PaymentMethods";
import { t, type Lang } from "@/lib/i18n";
import { parsePrice } from "@/lib/money";
import { slugify } from "@/lib/slug";
import type { Shop } from "@/lib/types";

export function SettingsForm({
  lang,
  shop,
  email,
  storeUrl,
}: {
  lang: Lang;
  shop: Shop;
  email: string;
  storeUrl: string;
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState(shop.name);
  const [ownerName, setOwnerName] = useState(shop.owner_name ?? "");
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp ?? "");
  const [pickup, setPickup] = useState(shop.pickup_on);
  const [delivery, setDelivery] = useState(shop.delivery_on);
  const [fee, setFee] = useState(Number(shop.delivery_fee).toFixed(3));
  const [copied, setCopied] = useState(false);
  const [slugOpen, setSlugOpen] = useState(false);
  const [slug, setSlug] = useState(shop.slug);
  const [slugState, setSlugState] = useState<"idle" | "ok" | "taken" | "invalid">("idle");
  const [slugSaved, setSlugSaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [pay, setPay] = useState<PayState>({
    iban_on: shop.iban_on,
    iban_value: shop.iban_value ?? "",
    wallet_on: shop.wallet_on,
    wallet_value: shop.wallet_value ?? "",
    cash_on: shop.cash_on,
    cash_value: shop.cash_value ?? "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (!name.trim()) return setError(d.common.required);

    start(async () => {
      const result = await updateShop({
        name: name.trim(),
        owner_name: ownerName.trim() || null,
        whatsapp: whatsapp.trim() || null,
        pickup_on: pickup,
        delivery_on: delivery,
        delivery_fee: parsePrice(fee) ?? 0,
        iban_on: pay.iban_on,
        iban_value: pay.iban_value,
        wallet_on: pay.wallet_on,
        wallet_value: pay.wallet_value,
        cash_on: pay.cash_on,
        cash_value: pay.cash_value,
      });

      if (result.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2400);
        return;
      }

      const messages: Record<string, string> = {
        needOnePayment: d.onboarding.needOnePayment,
        needPaymentValue: d.onboarding.needPaymentValue,
        needFulfilment:
          lang === "ar"
            ? "فعّل الاستلام أو التوصيل على الأقل"
            : "Turn on pickup or delivery",
      };
      setError(messages[result.error] ?? d.common.somethingWrong);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex max-w-[960px] flex-col gap-5"
      noValidate
    >
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        {/* ------------------------------------------------ store details */}
        <section className="card flex flex-col gap-4.5 p-6">
          <h2 className="text-base font-medium">{d.dash.storeDetails}</h2>

          <label className="flex flex-col gap-2">
            <span className="label">{d.dash.shopNameLabel}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field text-sm"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label">{d.dash.ownerNameLabel}</span>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={email}
              className="field text-sm"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="label">{d.dash.storeLink}</span>
            <div className="flex items-center gap-2 rounded-[11px] border border-dashed border-line-2 bg-soft p-3">
              <span
                dir="ltr"
                className="num min-w-0 flex-1 truncate text-xs text-mute"
              >
                {storeUrl}
              </span>
              <button
                type="button"
                aria-label={d.common.copy}
                onClick={() => {
                  navigator.clipboard?.writeText(storeUrl).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="shrink-0 cursor-pointer text-mute-2 hover:text-ink"
              >
                <Icon
                  name={copied ? "check" : "content_copy"}
                  size={16}
                  className={copied ? "text-ok" : ""}
                />
              </button>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={d.dash.openStore}
                className="shrink-0 text-mute-2 hover:text-ink"
              >
                <Icon name="open_in_new" size={16} />
              </a>
            </div>
          </div>

          {slugOpen ? (
            <div className="flex flex-col gap-2.5 rounded-[13px] border border-warn-soft bg-warn-soft/40 p-3.5">
              <p className="text-[11px] leading-[1.5] text-warn-ink text-pretty">
                {d.dash.changeLinkWarn}
              </p>
              <div className="flex items-center overflow-hidden rounded-[11px] border border-line-2 bg-white focus-within:border-ink">
                <span dir="ltr" className="shrink-0 border-e border-line bg-soft px-3 py-3 font-mono text-[11px] text-mute-2">
                  /s/
                </span>
                <input
                  value={slug}
                  dir="ltr"
                  aria-label={d.dash.storeLink}
                  onChange={(e) => {
                    const next = slugify(e.target.value);
                    setSlug(next);
                    setSlugState("idle");
                    if (next && next !== shop.slug) {
                      checkSlug(next).then(setSlugState).catch(() => setSlugState("idle"));
                    }
                  }}
                  className="w-full min-w-0 border-0 bg-transparent px-3 py-3 font-mono text-[13px] outline-none"
                />
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={pending || (slug !== shop.slug && slugState !== "ok")}
                  onClick={() =>
                    start(async () => {
                      const result = await updateSlug(slug);
                      if (result.ok) {
                        setSlugSaved(true);
                        setSlugOpen(false);
                        router.refresh();
                      } else {
                        setError(
                          result.error === "slugTaken"
                            ? d.onboarding.slugTaken
                            : d.onboarding.slugInvalid,
                        );
                      }
                    })
                  }
                  className="btn btn-ink !py-2.5 text-xs"
                >
                  {d.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => { setSlug(shop.slug); setSlugOpen(false); }}
                  className="btn btn-ghost !py-2.5 text-xs"
                >
                  {d.common.cancel}
                </button>
                {slug !== shop.slug && slugState === "taken" ? (
                  <span className="text-[11px] text-bad-ink">{d.onboarding.slugTaken}</span>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSlugOpen(true)}
              className="self-start text-[11px] font-medium text-brand underline underline-offset-4"
            >
              {d.dash.changeLink}
            </button>
          )}

          <span role="status" aria-live="polite" className="sr-only">
            {slugSaved ? d.dash.linkUpdated : ""}
          </span>

          <label className="flex flex-col gap-2">
            <span className="label">{d.dash.whatsapp}</span>
            <input
              value={whatsapp}
              dir="ltr"
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+973 3000 0000"
              className="field font-mono text-[13px]"
            />
            <span className="text-[11px] leading-[1.5] text-mute-2">
              {d.dash.whatsappHint}
            </span>
          </label>
        </section>

        <div className="flex flex-col gap-5">
          {/* ------------------------------------------------- payments */}
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-medium">{d.onboarding.payTitle}</h2>
              <p className="text-xs leading-[1.6] text-mute text-pretty">
                {d.onboarding.paySub}
              </p>
            </div>
            <PaymentMethods lang={lang} value={pay} onChange={setPay} />
          </section>

          {/* ----------------------------------------------- fulfilment */}
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-medium">{d.dash.fulfilTitle}</h2>
              <p className="text-xs leading-[1.6] text-mute text-pretty">
                {d.dash.fulfilSub}
              </p>
            </div>

            <Toggle
              icon="storefront"
              label={d.dash.pickupLabel}
              on={pickup}
              onToggle={() => setPickup((v) => !v)}
            />

            <div className="flex flex-col gap-2.5">
              <Toggle
                icon="local_shipping"
                label={d.dash.deliveryLabel}
                on={delivery}
                onToggle={() => setDelivery((v) => !v)}
              />
              {delivery ? (
                <label className="flex flex-col gap-2 ps-1">
                  <span className="label">{d.dash.deliveryFee}</span>
                  <span className="flex items-center gap-1.5 rounded-[11px] border border-line-2 bg-white px-3">
                    <input
                      value={fee}
                      dir="ltr"
                      inputMode="decimal"
                      onChange={(e) => setFee(e.target.value)}
                      placeholder="1.500"
                      aria-label={d.dash.deliveryFee}
                      className="w-full min-w-0 border-0 bg-transparent py-3 font-mono text-[13px] outline-none"
                    />
                    <span className="shrink-0 font-mono text-[11px] text-mute-2">
                      BHD
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3.5 py-3 text-xs font-medium text-bad-ink"
        >
          <Icon name="error" size={17} />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary self-start"
        >
          {pending ? d.common.saving : d.common.save}
        </button>
        <span role="status" aria-live="polite" className="sr-only">
          {saved ? d.dash.saved : ""}
        </span>
        {saved ? (
          <span
            aria-hidden="true"
            className="flex items-center gap-1.5 text-[13px] font-medium text-ok-ink animate-pop"
          >
            <Icon name="check_circle" size={17} className="text-ok" />
            {d.dash.saved}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Toggle({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: string;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border p-3.5 text-start transition-colors ${
        on ? "border-ink bg-white" : "border-line bg-soft"
      }`}
    >
      <Icon name={icon} size={21} className={on ? "text-ink" : "text-mute-2"} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span
        className={`flex h-[23px] w-10 items-center rounded-[20px] p-0.5 transition-colors ${
          on ? "justify-end bg-ok" : "justify-start bg-line-2"
        }`}
      >
        <span className="h-[19px] w-[19px] rounded-full bg-white" />
      </span>
    </button>
  );
}
