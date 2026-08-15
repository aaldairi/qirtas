"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeFromCart, setCartQty } from "@/app/actions/cart";
import { Icon } from "@/components/Icon";
import { t, type Lang } from "@/lib/i18n";

export function CartRow({
  lang,
  slug,
  productId,
  variant,
  qty,
}: {
  lang: Lang;
  slug: string;
  productId: string;
  variant: string | null;
  qty: number;
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(next: number) {
    start(async () => {
      await setCartQty(slug, productId, variant, next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        aria-label="−"
        disabled={pending}
        onClick={() => change(qty - 1)}
        className="cursor-pointer rounded-md bg-sand p-1 text-mute disabled:opacity-50"
      >
        <Icon name="remove" size={16} />
      </button>
      <span className="num min-w-4 text-center text-xs font-medium">{qty}</span>
      <button
        type="button"
        aria-label="+"
        disabled={pending}
        onClick={() => change(qty + 1)}
        className="cursor-pointer rounded-md bg-sand p-1 text-mute disabled:opacity-50"
      >
        <Icon name="add" size={16} />
      </button>

      <button
        type="button"
        aria-label={d.common.delete}
        disabled={pending}
        onClick={() =>
          start(async () => {
            await removeFromCart(slug, productId, variant);
            router.refresh();
          })
        }
        className="ms-1 cursor-pointer text-mute-5 hover:text-bad disabled:opacity-50"
      >
        <Icon name="delete" size={17} />
      </button>
    </div>
  );
}
