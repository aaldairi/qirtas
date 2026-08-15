"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteProduct } from "@/app/actions/products";
import { Icon } from "@/components/Icon";
import { fill, t, type Lang } from "@/lib/i18n";

export function ProductRowActions({
  productId,
  name,
  lang,
  compact,
}: {
  productId: string;
  name: string;
  lang: Lang;
  compact?: boolean;
}) {
  const d = t(lang);
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm(fill(d.dash.deleteConfirm, { name }))) return;
    start(async () => {
      await deleteProduct(productId);
      router.refresh();
    });
  }

  const button =
    "flex cursor-pointer items-center justify-center rounded-[9px] border border-line p-2 transition-colors hover:border-ink";

  return (
    <div
      className={`flex gap-2 ${compact ? "flex-col" : "justify-end"}`}
    >
      {compact ? null : (
        <Link
          href={`/dashboard/products?qr=${productId}`}
          title={d.dash.productQr}
          aria-label={d.dash.productQr}
          className={`${button} text-mute`}
        >
          <Icon name="qr_code_2" size={19} />
        </Link>
      )}
      <Link
        href={`/dashboard/products?edit=${productId}`}
        title={d.common.edit}
        aria-label={d.common.edit}
        className={`${button} text-mute`}
      >
        <Icon name="edit" size={19} />
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        title={d.common.delete}
        aria-label={d.common.delete}
        className={`${button} text-bad disabled:opacity-50`}
      >
        <Icon name="delete" size={19} />
      </button>
    </div>
  );
}
