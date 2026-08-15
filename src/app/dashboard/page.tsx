import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import {
  getScanCounts,
  getStats,
  listOrders,
  listProducts,
  requireShop,
} from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";
import { qrDataUrl } from "@/lib/qr";
import { productUrl } from "@/lib/urls";

export default async function DashboardHome() {
  const { shop } = await requireShop();
  const lang = await getLang();
  const d = t(lang);

  const [stats, orders, products, scans] = await Promise.all([
    getStats(shop.id),
    listOrders(shop.id),
    listProducts(shop.id),
    getScanCounts(shop.id),
  ]);

  const attention = orders.filter(
    (o) => o.status === "REVIEW" || o.status === "PENDING",
  );

  const topScanned = products
    .map((p) => ({ product: p, count: scans.get(p.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .filter((row) => row.count > 0);

  const topQrs = await Promise.all(
    topScanned.map((row) => qrDataUrl(productUrl(shop.slug, row.product.id), 120)),
  );

  const cards = [
    {
      icon: "payments",
      label: d.dash.statSales,
      value: money(stats.salesToday),
      unit: "BHD",
      dark: true,
      accent: "text-paper",
    },
    {
      icon: "receipt_long",
      label: d.dash.statOrders,
      value: String(stats.orderCount),
      unit: "",
      dark: false,
      accent: "text-ink",
    },
    {
      icon: "hourglass_top",
      label: d.dash.statPending,
      value: String(stats.pendingCount),
      unit: "",
      dark: false,
      accent: "text-warn",
    },
    {
      icon: "qr_code_scanner",
      label: d.dash.statScans,
      value: String(stats.scanCount),
      unit: "",
      dark: false,
      accent: "text-ink",
    },
  ];

  return (
    <>
      <PageHeader
        title={d.dash.pages.home}
        actions={
          <>
            <Link href="/dashboard/labels" className="btn btn-ghost">
              <Icon name="print" size={17} />
              <span className="hidden sm:inline">{d.dash.printLabels}</span>
            </Link>
            <Link href="/dashboard/products/new" className="btn btn-primary">
              <Icon name="add" size={17} />
              <span>{d.dash.addProduct}</span>
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        {/* ------------------------------------------------------- stats */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`flex flex-col gap-3.5 rounded-[18px] border p-5 ${
                c.dark ? "border-ink bg-ink" : "border-line bg-paper"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  name={c.icon}
                  size={19}
                  className={c.dark ? "text-paper" : c.accent}
                />
                <span className="font-mono text-[11px] text-mute-2">
                  {c.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`num text-[30px] font-extrabold tracking-[-0.03em] ${c.accent}`}
                >
                  {c.value}
                </span>
                {c.unit ? (
                  <span className="font-mono text-xs text-mute-2">{c.unit}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr] xl:items-start">
          {/* ------------------------------------------ needs attention */}
          <section className="card overflow-hidden">
            <header className="flex items-center gap-2.5 border-b border-line-3 px-5 py-4">
              <h2 className="text-[15px] font-medium">
                {d.dash.needsAttention}
              </h2>
              <Link
                href="/dashboard/orders"
                className="ms-auto text-xs text-brand hover:underline"
              >
                {d.dash.seeAll}
              </Link>
            </header>

            {attention.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-6 py-12">
                <Icon name="task_alt" size={28} className="text-mute-5" />
                <p className="text-[13px] text-mute-2">{d.dash.allClear}</p>
              </div>
            ) : (
              <ul>
                {attention.slice(0, 5).map((o) => {
                  const hasReceipt = Boolean(o.receipt_path);
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/dashboard/orders?id=${o.id}`}
                        className="flex items-center gap-3.5 border-b border-line-4 px-5 py-4 transition-colors hover:bg-soft"
                      >
                        <Icon
                          name={hasReceipt ? "receipt_long" : "hourglass_top"}
                          size={22}
                          className={hasReceipt ? "text-warn" : "text-mute-5"}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate text-sm font-medium">
                            <span className="num">{o.code}</span> ·{" "}
                            {o.customer_name}
                          </span>
                          <span className="truncate font-mono text-[11px] text-mute-2">
                            {hasReceipt
                              ? d.dash.receiptAttached
                              : d.dash.waitingReceipt}{" "}
                            · {o.order_items.length} {d.common.items}
                          </span>
                        </span>
                        <span className="num text-sm font-medium">
                          {money(o.total)}
                        </span>
                        <span
                          className={`shrink-0 rounded-[20px] px-3.5 py-2 text-xs font-medium ${
                            hasReceipt
                              ? "bg-ok text-white"
                              : "bg-sand text-mute"
                          }`}
                        >
                          {hasReceipt ? d.dash.confirm : d.dash.view}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* --------------------------------------------- most scanned */}
          <section className="card overflow-hidden">
            <h2 className="border-b border-line-3 px-5 py-4 text-[15px] font-medium">
              {d.dash.topScanned}
            </h2>

            {topScanned.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-6 py-12">
                <Icon name="qr_code_scanner" size={26} className="text-mute-5" />
                <p className="text-[13px] text-mute-2">{d.dash.noScans}</p>
              </div>
            ) : (
              <ul>
                {topScanned.map((row, i) => (
                  <li key={row.product.id}>
                    <Link
                      href={`/dashboard/products/${row.product.id}`}
                      className="flex items-center gap-3 border-b border-line-4 px-5 py-3.5 transition-colors hover:bg-soft"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={topQrs[i]}
                        alt=""
                        className="h-9.5 w-9.5 rounded-md"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[13px]">
                          {row.product.name}
                        </span>
                        <span className="font-mono text-[10px] text-mute-2">
                          <span className="num">{row.count}</span>{" "}
                          {d.dash.scans}
                        </span>
                      </span>
                      <span className="num text-[13px] font-medium">
                        {money(row.product.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
