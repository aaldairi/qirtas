"use client";

import { useTransition } from "react";

import { setLang } from "@/app/actions/lang";
import { Icon } from "@/components/Icon";
import type { Lang } from "@/lib/i18n";

export function LangToggle({
  lang,
  label,
  className = "",
  iconSize = 18,
}: {
  lang: Lang;
  label: string;
  className?: string;
  iconSize?: number;
}) {
  const [pending, start] = useTransition();
  const next: Lang = lang === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setLang(next))}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      className={`inline-flex cursor-pointer items-center gap-2 disabled:opacity-60 ${className}`}
    >
      <Icon name="translate" size={iconSize} />
      <span>{label}</span>
    </button>
  );
}
