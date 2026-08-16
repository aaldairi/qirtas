"use client";

import { useEffect, useState, useTransition } from "react";

import { checkSlug, createShop } from "@/app/actions/shop";
import { Icon } from "@/components/Icon";
import { emptyPay, PaymentMethods, type PayState } from "@/components/PaymentMethods";
import { t, type Lang } from "@/lib/i18n";
import { slugify } from "@/lib/slug";

export function SetupForm({ lang, origin }: { lang: Lang; origin: string }) {
  const d = t(lang);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "ok" | "taken" | "invalid">("idle");
  const [pay, setPay] = useState<PayState>(emptyPay);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Suggest a link from the shop name until the owner takes over the field.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Availability check, debounced so we aren't hitting the DB per keystroke.
  useEffect(() => {
    if (!slug) {
      setSlugState("idle");
      return;
    }
    const timer = setTimeout(() => {
      checkSlug(slug).then(setSlugState).catch(() => setSlugState("idle"));
    }, 400);
    return () => clearTimeout(timer);
  }, [slug]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError(d.common.required);
    if (slugState === "taken") return setError(d.onboarding.slugTaken);
    if (slugState !== "ok") return setError(d.onboarding.slugInvalid);

    start(async () => {
      const result = await createShop({
        name: name.trim(),
        owner_name: ownerName.trim() || null,
        slug,
        iban_on: pay.iban_on,
        iban_value: pay.iban_value,
        wallet_on: pay.wallet_on,
        wallet_value: pay.wallet_value,
        cash_on: pay.cash_on,
        cash_value: pay.cash_value,
      });

      // Success redirects, so anything returned here is a failure.
      if (result && !result.ok) {
        const messages: Record<string, string> = {
          slugTaken: d.onboarding.slugTaken,
          slugInvalid: d.onboarding.slugInvalid,
          needOnePayment: d.onboarding.needOnePayment,
          needPaymentValue: d.onboarding.needPaymentValue,
        };
        setError(messages[result.error] ?? d.common.somethingWrong);
      }
    });
  }

  const slugHint =
    slugState === "taken"
      ? { text: d.onboarding.slugTaken, tone: "bad" as const }
      : slugState === "invalid" && slug
        ? { text: d.onboarding.slugInvalid, tone: "bad" as const }
        : slugState === "ok"
          ? { text: `${origin.replace(/^https?:\/\//, "")}/s/${slug}`, tone: "ok" as const }
          : { text: d.onboarding.slugHint, tone: "mute" as const };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <section className="card flex flex-col gap-4.5 p-6">
        <label className="flex flex-col gap-2">
          <span className="label">{d.onboarding.shopName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={d.onboarding.shopNamePh}
            className="field text-[15px] font-medium"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="label">{d.onboarding.ownerName}</span>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder={d.onboarding.ownerNamePh}
            className="field text-[15px]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="label">{d.onboarding.storeLink}</span>
          <div className="flex items-center gap-0 overflow-hidden rounded-[11px] border border-line-2 bg-white focus-within:border-ink">
            <span
              dir="ltr"
              className="shrink-0 border-e border-line bg-soft px-3 py-3.5 font-mono text-[11px] text-mute-2"
            >
              /s/
            </span>
            <input
              value={slug}
              dir="ltr"
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="seef-stationery"
              aria-label={d.onboarding.storeLink}
              className="w-full min-w-0 border-0 bg-transparent px-3 py-3.5 font-mono text-[13px] text-ink outline-none"
            />
            {slug && slugState !== "idle" ? (
              // Spacing lives on this wrapper, not the icon. The .ms class
              // forces direction: ltr for ligature rendering, so a logical
              // margin on the icon itself resolves against LTR and lands on
              // the wrong side in Arabic — leaving the tick 1px from the edge.
              <span className="flex shrink-0 items-center pe-3">
                <Icon
                  name={slugState === "ok" ? "check_circle" : "error"}
                  size={18}
                  className={slugState === "ok" ? "text-ok" : "text-bad"}
                />
              </span>
            ) : null}
          </div>
          <span
            dir={slugHint.tone === "ok" ? "ltr" : undefined}
            className={`text-[11px] leading-[1.5] ${
              slugHint.tone === "bad"
                ? "text-bad-ink"
                : slugHint.tone === "ok"
                  ? "font-mono text-ok-ink"
                  : "text-mute-2"
            }`}
          >
            {slugHint.text}
          </span>
        </label>
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-medium">{d.onboarding.payTitle}</h2>
          <p className="text-xs leading-[1.55] text-mute text-pretty">
            {d.onboarding.paySub}
          </p>
        </div>
        <PaymentMethods lang={lang} value={pay} onChange={setPay} />
      </section>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3.5 py-3 text-xs font-medium text-bad-ink"
        >
          <Icon name="error" size={17} />
          <span>{error}</span>
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-ink py-4.5 text-sm">
        <span>{pending ? d.onboarding.creating : d.onboarding.openShop}</span>
        {pending ? null : <Icon name="arrow_forward" size={18} />}
      </button>
    </form>
  );
}
