"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import type { Lang } from "@/lib/i18n";

/**
 * The order token in the URL is the customer's only way back to this page,
 * so make copying it a one-tap job.
 */
export function CopyLink({
  lang,
  note,
  copy,
}: {
  lang: Lang;
  note: string;
  copy: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setUrl(window.location.href), []);

  return (
    <button
      type="button"
      aria-label={copy}
      onClick={() => {
        navigator.clipboard?.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border border-dashed border-line-2 bg-paper p-3.5 text-start"
    >
      <Icon name="link" size={18} className="shrink-0 text-mute-2" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] text-mute">{note}</span>
        <span dir="ltr" className="num truncate text-[11px] text-mute-2">
          {url}
        </span>
      </span>
      <Icon
        name={copied ? "check" : "content_copy"}
        size={17}
        className={`shrink-0 ${copied ? "text-ok" : "text-mute-2"}`}
      />
    </button>
  );
}
