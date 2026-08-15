"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addToCart } from "@/app/actions/cart";
import { Icon } from "@/components/Icon";
import { fill, t, type Lang } from "@/lib/i18n";

export function BuyPanel({
  lang,
  slug,
  productId,
  variants,
  maxQty,
  outOfStock,
}: {
  lang: Lang;
  slug: string;
  productId: string;
  variants: { label: string; qty: number }[];
  maxQty: number;
  outOfStock: boolean;
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();

  const [variant, setVariant] = useState<string | null>(
    variants[0]?.label ?? null,
  );
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState("");
  const [note, setNote] = useState("");

  const cap = Math.max(1, maxQty);

  function bump(delta: number) {
    setQty((q) => {
      const next = Math.min(cap, Math.max(1, q + delta));
      setNote(next === cap && delta > 0 && maxQty < 999 ? fill(d.shop.maxStock, { n: cap }) : "");
      return next;
    });
  }

  function add(then?: "checkout") {
    if (outOfStock) return;

    start(async () => {
      await addToCart(slug, productId, variant, qty);
      router.refresh();

      if (then === "checkout") {
        router.push(`/s/${slug}/checkout`);
        return;
      }

      setToast(d.shop.added);
      setTimeout(() => setToast(""), 2000);
    });
  }

  if (outOfStock) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] border border-bad-line bg-bad-soft p-4">
        <Icon name="do_not_disturb_on" size={20} className="text-bad" />
        <span className="text-[13px] font-medium text-bad-ink">
          {d.common.outOfStock}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 0 ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="label mb-2.5">{d.shop.chooseVariant}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const on = variant === v.label;
              return (
                <button
                  key={v.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setVariant(v.label)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-xs font-medium transition-colors ${
                    on
                      ? "border-ink bg-ink text-paper"
                      : "border-line-2 bg-white text-ink-3 hover:border-ink"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-soft px-3.5 py-2.5">
        <span className="flex-1 text-xs font-medium text-mute">
          {d.shop.qty}
        </span>
        <button
          type="button"
          aria-label="−"
          onClick={() => bump(-1)}
          className="cursor-pointer rounded-lg bg-dust p-1.5 text-ink"
        >
          <Icon name="remove" size={20} />
        </button>
        <span className="num min-w-6 text-center text-[15px] font-medium">
          {qty}
        </span>
        <button
          type="button"
          aria-label="+"
          onClick={() => bump(1)}
          className="cursor-pointer rounded-lg bg-dust p-1.5 text-ink"
        >
          <Icon name="add" size={20} />
        </button>
      </div>

      {note ? (
        <p className="font-mono text-[11px] text-warn-ink">{note}</p>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => add()}
          disabled={pending}
          className="btn btn-ghost flex-1 !border-ink py-4"
        >
          {d.shop.addToCart}
        </button>
        <button
          type="button"
          onClick={() => add("checkout")}
          disabled={pending}
          className="btn btn-ink flex-1 py-4"
        >
          {d.shop.buyNow}
        </button>
      </div>

      {toast ? (
        <p className="flex items-center gap-2 rounded-xl border border-ok-line bg-ok-soft px-3.5 py-3 text-xs font-medium text-ok-ink animate-pop">
          <Icon name="check_circle" size={17} className="text-ok" />
          <span>{toast}</span>
        </p>
      ) : null}
    </div>
  );
}
