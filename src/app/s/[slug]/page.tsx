import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { getShopBySlug, listProducts } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";

export default async function StorefrontPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const lang = await getLang();
  const d = t(lang);
  const products = await listProducts(shop.id, { onlyActive: true });

  return (
    <div className="flex flex-col gap-5 py-7">
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-2 px-6 py-20 text-center">
          <Icon name="inventory_2" size={30} className="text-mute-5" />
          <p className="text-sm text-mute-2">{d.shop.emptyStore}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const out = p.track_stock && p.stock <= 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/s/${slug}/p/${p.id}`}
                  className="card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_12px_28px_-20px_rgba(26,25,23,.5)]"
                >
                  <ProductImage
                    path={p.image_path}
                    alt={p.name}
                    className="h-28 w-full sm:h-32"
                  />
                  <span className="flex flex-1 flex-col gap-1.5 p-3">
                    <span className="line-clamp-2 text-xs font-medium leading-[1.3]">
                      {p.name}
                    </span>
                    <span className="num mt-auto text-xs font-medium text-ink-3">
                      {money(p.price)} BHD
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        out ? "text-bad" : "text-ok"
                      }`}
                    >
                      {out
                        ? d.common.outOfStock
                        : lang === "ar"
                          ? "متوفر"
                          : "In stock"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
