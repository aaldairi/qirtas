import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { listOrders, requireShop } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";
import { OrderDetail } from "./OrderDetail";
import { StatusPill } from "./StatusPill";

export default async function OrdersPage(props: {
  searchParams: Promise<{ id?: string; status?: string }>;
}) {
  const search = await props.searchParams;
  const { shop } = await requireShop();
  const lang = await getLang();
  const d = t(lang);

  const orders = await listOrders(shop.id);

  const statusFilter = search.status ?? "all";
  const visible =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const active =
    visible.find((o) => o.id === search.id) ?? visible[0] ?? null;

  return (
    <>
      <PageHeader title={d.dash.pages.orders} meta={`(${orders.length})`} />

      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        {orders.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Icon name="receipt_long" size={30} className="text-mute-5" />
            <p className="text-[15px] font-medium">{d.dash.noOrders}</p>
            <p className="max-w-[320px] text-[13px] leading-[1.6] text-mute-2 text-pretty">
              {d.dash.noOrdersSub}
            </p>
            <Link href="/dashboard/labels" className="btn btn-primary mt-2">
              <Icon name="print" size={17} />
              <span>{d.dash.printLabels}</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              {d.dash.filters.map(([key, label]) => {
                const on = statusFilter === key;
                return (
                  <Link
                    key={key}
                    href={
                      key === "all"
                        ? "/dashboard/orders"
                        : `/dashboard/orders?status=${key}`
                    }
                    className={`rounded-[20px] border px-4 py-2.5 text-xs transition-colors ${
                      on
                        ? "border-ink bg-ink text-paper"
                        : "border-line-2 bg-paper text-mute hover:border-ink"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr] xl:items-start">
              {/* ------------------------------------------------- list */}
              <ul
                className={`card overflow-hidden ${
                  search.id ? "hidden xl:block" : ""
                }`}
              >
                {visible.length === 0 ? (
                  <li className="px-5 py-10 text-center text-[13px] text-mute-2">
                    {d.dash.noOrders}
                  </li>
                ) : (
                  visible.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/dashboard/orders?id=${o.id}${
                          statusFilter !== "all" ? `&status=${statusFilter}` : ""
                        }`}
                        className={`flex items-center gap-3 border-b border-line-4 px-5 py-4 transition-colors hover:bg-soft ${
                          active?.id === o.id ? "bg-soft" : ""
                        }`}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="truncate text-sm font-medium">
                            <span className="num">{o.code}</span> ·{" "}
                            {o.customer_name}
                          </span>
                          <span className="truncate font-mono text-[11px] text-mute-2">
                            <span className="num">{o.order_items.length}</span>{" "}
                            {d.common.items} ·{" "}
                            {o.fulfilment === "pickup"
                              ? d.shop.pickup
                              : d.shop.delivery}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-2">
                          <span className="num text-sm font-medium">
                            {money(o.total)}
                          </span>
                          <StatusPill status={o.status} lang={lang} />
                        </span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>

              {/* ----------------------------------------------- detail */}
              {active ? (
                <OrderDetail key={active.id} order={active} lang={lang} />
              ) : (
                <div className="card hidden items-center justify-center px-6 py-16 text-center text-[13px] text-mute-2 xl:flex">
                  {d.dash.selectOrder}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

