"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/Icon";

type Props = {
  href: string;
  icon: string;
  label: string;
  badge?: number;
};

function useActive(href: string) {
  const pathname = usePathname();
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

export function NavLink({ href, icon, label, badge = 0 }: Props) {
  const active = useActive(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[11px] px-3 py-3 transition-colors ${
        active ? "bg-ink-2 text-paper" : "text-mute-3 hover:text-paper"
      }`}
    >
      <Icon name={icon} size={20} />
      <span className={`flex-1 text-[13px] ${active ? "font-medium" : ""}`}>
        {label}
      </span>
      {badge > 0 ? (
        <span className="num min-w-5 rounded-[10px] bg-warn px-1.5 text-center text-[11px] leading-5 font-medium text-ink">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function TabLink({ href, icon, label, badge = 0 }: Props) {
  const active = useActive(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center gap-1 py-2.5"
    >
      <span className="relative">
        <Icon
          name={icon}
          size={22}
          fill={active}
          className={active ? "text-ink" : "text-mute-4"}
        />
        {badge > 0 ? (
          <span className="num absolute -top-1 -end-2 min-w-4 rounded-lg bg-warn px-1 text-center text-[9px] leading-4 font-medium text-ink">
            {badge}
          </span>
        ) : null}
      </span>
      <span
        className={`text-[10px] leading-none ${
          active ? "font-medium text-ink" : "text-mute-4"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
