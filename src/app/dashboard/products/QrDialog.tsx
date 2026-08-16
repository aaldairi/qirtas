"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/Icon";
import { useDialog } from "@/components/useDialog";
import { t, type Lang } from "@/lib/i18n";

export function QrDialog({
  lang,
  name,
  price,
  url,
  qr,
  downloadHref,
}: {
  lang: Lang;
  name: string;
  price: string;
  url: string;
  qr: string;
  downloadHref: string;
}) {
  const d = t(lang);
  const router = useRouter();

  function close() {
    router.push("/dashboard/products");
  }

  const panelRef = useDialog(close);
  const [saving, setSaving] = useState(false);

  /**
   * On iOS a plain <a download> always lands in Files, never the photo
   * library, and there is no web API to write to Photos directly. Handing the
   * PNG to the system share sheet gives the "Save Image" action, which does.
   * Desktop browsers have no share target for files, so they fall back to the
   * ordinary download.
   */
  async function saveImage() {
    setSaving(true);
    try {
      const response = await fetch(downloadHref);
      const blob = await response.blob();
      const file = new File([blob], `qr-${name.replace(/\s+/g, "-").toLowerCase()}.png`, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      // Cancelling the share sheet rejects with AbortError; that is not a
      // failure and should not surface as one.
      if ((error as Error)?.name !== "AbortError") {
        window.open(downloadHref, "_blank", "noopener");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={d.dash.productQr}
        className="flex w-full max-w-[380px] flex-col items-center gap-4 rounded-3xl bg-paper p-8 animate-pop"
      >
        <p className="text-center text-lg font-medium leading-[1.3]">{name}</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={d.dash.productQr} className="h-[220px] w-[220px]" />

        <div className="flex flex-col items-center gap-1.5">
          <span className="num text-lg font-medium">{price} BHD</span>
          <span className="num text-[10px] text-mute-2">
            {d.common.scanToBuy}
          </span>
        </div>

        <p
          dir="ltr"
          className="w-full break-all rounded-xl border border-line bg-soft p-3 text-center font-mono text-[11px] leading-[1.5] text-mute"
        >
          {url}
        </p>

        <div className="flex w-full gap-2.5">
          <button
            type="button"
            onClick={saveImage}
            disabled={saving}
            className="btn btn-ghost flex-1"
          >
            <Icon name={saving ? "progress_activity" : "download"} size={17} />
            <span>{saving ? d.dash.saving : d.dash.saveImage}</span>
          </button>
          <Link href="/dashboard/labels" className="btn btn-primary flex-1">
            <Icon name="print" size={17} />
            <span>{d.dash.labelSheet}</span>
          </Link>
        </div>

        <button
          type="button"
          onClick={close}
          className="cursor-pointer text-[13px] text-mute-2 hover:text-ink"
        >
          {d.common.close}
        </button>
      </div>
    </div>
  );
}
