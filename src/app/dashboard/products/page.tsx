import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { getProduct, listCategories, listProducts, requireShop } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";
import { qrDataUrl } from "@/lib/qr";
import { productUrl } from "@/lib/urls";

import { ProductDrawer } from "./ProductDrawer";
import { ProductRowActions } from "./ProductRowActions";
import { QrDialog } from "./QrDialog";

export default async function ProductsPage(props: {
  searchParams: Promise<{ new?: string; edit?: string; qr?: string; cat?: string }>;
}) {
  const search = await props.searchParams;
  const { shop } = await requireShop();
  const lang = await getLang();
  const d = t(lang);

  const [products, categories] = await Promise.all([
    listProducts(shop.id),
    listCategories(shop.id),
  ]);

  const catFilter = search.cat ?? "all";
  const visible =
    catFilter === "all"
      ? products
      : products.filter((p) => p.category_id === catFilter);

  const qrs = await Promise.all(
    visible.map((p) => qrDataUrl(productUrl(shop.slug, p.id, "qr"), 120)),
  );

  // Drawer + QR dialog are driven by the URL so both are shareable and the
  // back button closes them.
  const editing = search.edit ? await getProduct(shop.id, search.edit) : null;
  const drawerOpen = Boolean(search.new) || Boolean(editing);

  const qrProduct = search.qr ? await getProduct(shop.id, search.qr) : null;
  const qrBig = qrProduct
    ? await qrDataUrl(productUrl(shop.slug, qrProduct.id, "qr"), 640)
    : null;

  const filters = [{ id: "all", name: d.common.all }, ...categories];

  return (
    <>
      <PageHeader
        title={d.dash.pages.products}
        meta={`(${products.length})`}
        actions={
          <>
            <Link href="/dashboard/labels" className="btn btn-ghost">
              <Icon name="print" size={17} />
              <span className="hidden sm:inline">{d.dash.printLabels}</span>
            </Link>
            <Link href="/dashboard/products?new=1" className="btn btn-primary">
              <Icon name="add" size={17} />
              <span>{d.dash.addProduct}</span>
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        {categories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2.5">
            {filters.map((c) => {
              const on = catFilter === c.id;
              return (
                <Link
                  key={c.id}
                  href={c.id === "all" ? "/dashboard/products" : `/dashboard/products?cat=${c.id}`}
                  className={`rounded-[20px] border px-4 py-2.5 text-xs transition-colors ${
                    on
                      ? "border-ink bg-ink text-paper"
                      : "border-line-2 bg-paper text-mute hover:border-ink"
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Icon name="inventory_2" size={30} className="text-mute-5" />
            <p className="text-[15px] font-medium">{d.dash.noProducts}</p>
            <p className="max-w-[320px] text-[13px] leading-[1.6] text-mute-2 text-pretty">
              {d.dash.noProductsSub}
            </p>
            <Link href="/dashboard/products?new=1" className="btn btn-primary mt-2">
              <Icon name="add" size={17} />
              <span>{d.dash.addProduct}</span>
            </Link>
          </div>
        ) : (
          <>
            {/* ------------------------------------------ table (desktop) */}
            <div className="card hidden overflow-hidden lg:block">
              <div className="grid grid-cols-[64px_2.2fr_1fr_1fr_1fr_1fr_130px] border-b border-line-3 bg-soft px-5 py-3.5">
                {d.dash.tableHead.map((h, i) => (
                  <span
                    key={i}
                    className="font-mono text-[10px] text-mute-2"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {visible.map((p, i) => {
                const variantLine = p.product_variants?.length
                  ? p.product_variants
                      .map((v) => `${v.label} ×${v.qty}`)
                      .join(" · ")
                  : d.common.noVariants;

                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[64px_2.2fr_1fr_1fr_1fr_1fr_130px] items-center border-b border-line-4 px-5 py-3.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrs[i]}
                      alt=""
                      className="h-11 w-11 rounded-md"
                    />
                    <div className="flex min-w-0 flex-col gap-1 pe-3">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.name}
                        </span>
                        {!p.active ? (
                          <span className="shrink-0 rounded-[20px] bg-sand px-2 py-0.5 font-mono text-[9px] text-mute">
                            {d.dash.draft}
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate font-mono text-[11px] text-mute-2">
                        {variantLine}
                      </span>
                    </div>
                    <span className="num truncate pe-2 text-xs text-mute">
                      {p.sku || "—"}
                    </span>
                    <span className="truncate pe-2 text-xs text-mute">
                      {p.categories?.name || "—"}
                    </span>
                    <span className="num text-[13px] font-medium">
                      {money(p.price)}
                    </span>
                    <StockCell product={p} lang={lang} />
                    <ProductRowActions
                      productId={p.id}
                      name={p.name}
                      lang={lang}
                    />
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------- cards (mobile) */}
            <ul className="flex flex-col gap-2.5 lg:hidden">
              {visible.map((p, i) => (
                <li
                  key={p.id}
                  className="card flex items-center gap-3.5 p-4"
                >
                  <Link href={`/dashboard/products?edit=${p.id}`} className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {p.name}
                        </span>
                        {!p.active ? (
                          <span className="shrink-0 rounded-[20px] bg-sand px-2 py-0.5 font-mono text-[9px] text-mute">
                            {d.dash.draft}
                          </span>
                        ) : null}
                      </span>
                      <span className="num truncate text-[11px] text-mute-2">
                        {p.sku || "—"}
                      </span>
                      <StockCell product={p} lang={lang} />
                    </span>
                  </Link>
                  <Link
                    href={`/dashboard/products?qr=${p.id}`}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    aria-label={d.dash.productQr}
                  >
                    <span className="num text-sm font-medium">
                      {money(p.price)}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrs[i]} alt="" className="h-11 w-11 rounded-md" />
                  </Link>
                  <ProductRowActions
                    productId={p.id}
                    name={p.name}
                    lang={lang}
                    compact
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {drawerOpen ? (
        <ProductDrawer
          lang={lang}
          product={editing}
          categories={categories}
          shopSlug={shop.slug}
        />
      ) : null}

      {qrProduct && qrBig ? (
        <QrDialog
          lang={lang}
          name={qrProduct.name}
          price={money(qrProduct.price)}
          url={productUrl(shop.slug, qrProduct.id, "nfc")}
          qr={qrBig}
          downloadHref={`/qr/${shop.slug}/${qrProduct.id}.png`}
        />
      ) : null}
    </>
  );
}

function StockCell({
  product,
  lang,
}: {
  product: { stock: number; track_stock: boolean };
  lang: "ar" | "en";
}) {
  const d = t(lang);

  if (!product.track_stock) {
    return (
      <span className="font-mono text-[11px] text-mute-2">
        {lang === "ar" ? "بدون تتبع" : "Not tracked"}
      </span>
    );
  }

  const out = product.stock <= 0;
  const low = product.stock > 0 && product.stock < 10;

  return (
    <span
      className={`font-mono text-[11px] ${
        out ? "text-bad" : low ? "text-warn" : "text-mute"
      }`}
    >
      {out ? (
        d.common.outOfStock
      ) : (
        <>
          <span className="num">{product.stock}</span> {d.common.inStock}
        </>
      )}
    </span>
  );
}
