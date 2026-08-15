import { t, type Lang } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/types";

export const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: "bg-sand text-mute-2",
  REVIEW: "bg-warn-soft text-warn-ink",
  PAID: "bg-ok-soft text-ok-ink",
  REJECTED: "bg-bad-soft text-bad-ink",
};

export function StatusPill({
  status,
  lang,
}: {
  status: OrderStatus;
  lang: Lang;
}) {
  const label =
    t(lang).dash.filters.find(([key]) => key === status)?.[1] ?? status;

  return (
    <span
      className={`rounded-[20px] px-2.5 py-1.5 font-mono text-[9px] ${STATUS_STYLE[status]}`}
    >
      {label}
    </span>
  );
}
