import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { cartCount, readCart } from "@/lib/cart";
import { getShopBySlug } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const shop = await getShopBySlug(slug);
  return { title: shop ? shop.name : "Qirtas" };
}

export default async function StoreLayout(props: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const lang = await getLang();
  const d = t(lang);
  const count = cartCount(await readCart(slug));

  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-4 sm:px-6">
          <Link
            href={`/s/${slug}`}
            className="flex min-w-0 items-center gap-2.5"
          >
            <Icon name="storefront" size={22} />
            <span className="truncate text-[17px] font-medium tracking-[-0.02em]">
              {shop.name}
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-1">
            <LangToggle
              lang={lang}
              label={lang === "ar" ? "EN" : "ع"}
              iconSize={16}
              className="rounded-full px-2.5 py-2 text-[11px] font-medium text-mute hover:text-ink"
            />

            <Link
              href={`/s/${slug}/cart`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-sand"
              aria-label={`${d.shop.cart}${count ? ` (${count})` : ""}`}
            >
              <Icon name="shopping_bag" size={22} />
              {count > 0 ? (
                <span className="num absolute end-0.5 top-0.5 min-w-4 rounded-lg bg-bad px-1 text-center text-[9px] leading-4 font-medium text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[900px] flex-1 px-4 pb-16 sm:px-6">
        {props.children}
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-3 px-4 py-6 sm:px-6">
          <span className="text-xs text-mute-2">{shop.name}</span>
          <Link
            href="/"
            className="ms-auto flex items-center gap-1.5 font-mono text-[11px] text-mute-4 hover:text-ink"
          >
            <Icon name="qr_code_2" size={14} />
            <span>{d.brand}</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
