import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { getStats, requireShop } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

import { NavLink, TabLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { shop, email } = await requireShop();
  const lang = await getLang();
  const d = t(lang);
  const stats = await getStats(shop.id);

  const storeUrl = `${siteUrl().replace(/^https?:\/\//, "")}/s/${shop.slug}`;
  const initials = (shop.owner_name || shop.name || "•")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const nav = d.dash.nav.map(([href, icon, label]) => ({
    href: `/dashboard${href}`,
    icon,
    label,
    badge: href === "/orders" && stats.pendingCount > 0 ? stats.pendingCount : 0,
  }));

  return (
    <div className="flex min-h-dvh bg-sand">
      {/* ------------------------------------------------- sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 bg-ink p-4 pt-5.5 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <Icon name="qr_code_2" size={26} className="text-paper" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[15px] font-medium text-paper">
              {shop.name}
            </span>
            <span
              dir="ltr"
              className="truncate font-mono text-[10px] text-mute-2"
            >
              {storeUrl}
            </span>
          </span>
        </Link>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5">
          <LangToggle
            lang={lang}
            label={d.langLabel}
            className="rounded-[11px] border border-ink-2 px-3 py-3 text-xs text-mute-3 hover:text-paper"
          />

          <div className="flex items-center gap-2.5 rounded-[11px] px-3 py-3">
            <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-ink-2 text-[11px] font-medium text-chalk">
              {initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xs text-paper">
                {shop.owner_name || email}
              </span>
              <span className="font-mono text-[10px] text-mute-2">
                {d.dash.owner}
              </span>
            </span>
            <SignOutButton label={d.common.signOut} />
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------------- content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <div className="no-print flex items-center gap-3 border-b border-line bg-ink px-4 py-3.5 lg:hidden">
          <Icon name="qr_code_2" size={22} className="text-paper" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper">
            {shop.name}
          </span>
          <LangToggle
            lang={lang}
            label={lang === "ar" ? "EN" : "ع"}
            iconSize={15}
            className="rounded-full border border-ink-2 px-2.5 py-1.5 text-[11px] text-mute-3"
          />
          <SignOutButton label={d.common.signOut} />
        </div>

        <main id="main" className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>

        {/* mobile bottom tabs */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
          {nav.map((item) => (
            <TabLink key={item.href} {...item} />
          ))}
        </nav>
      </div>
    </div>
  );
}
