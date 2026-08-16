import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { listProducts, requireShop } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { money } from "@/lib/money";
import { qrDataUrl } from "@/lib/qr";
import { productUrl } from "@/lib/urls";

import { PrintButton } from "./PrintButton";

export default async function LabelsPage() {
  const { shop } = await requireShop();
  const lang = await getLang();
  const d = t(lang);

  const products = await listProducts(shop.id, { onlyActive: true });
  const qrs = await Promise.all(
    products.map((p) => qrDataUrl(productUrl(shop.slug, p.id, "qr"), 400)),
  );

  return (
    <>
      <PageHeader
        title={d.dash.pages.labels}
        meta={`${products.length} ${lang === "ar" ? "ملصق" : "labels"}`}
        actions={
          products.length > 0 ? <PrintButton label={d.common.print} /> : null
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        {products.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Icon name="qr_code_2" size={30} className="text-mute-5" />
            <p className="text-[15px] font-medium">{d.dash.labelsEmpty}</p>
            <Link href="/dashboard/products?new=1" className="btn btn-primary mt-2">
              <Icon name="add" size={17} />
              <span>{d.dash.addProduct}</span>
            </Link>
          </div>
        ) : (
          <>
            <p className="no-print max-w-[560px] text-[13px] leading-[1.6] text-mute text-pretty">
              {d.dash.labelDesc}
            </p>

            {/* Print styles flatten this to a bare 4-up A4 grid. */}
            <div className="print-sheet card grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 lg:grid-cols-4 lg:p-8">
              {products.map((p, i) => (
                <div
                  key={p.id}
                  className="print-label flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-line-2 px-3 py-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrs[i]}
                    alt=""
                    className="h-24 w-24"
                  />
                  <span className="line-clamp-2 text-center text-xs font-medium leading-[1.3]">
                    {p.name}
                  </span>
                  <span className="num text-xs text-ink-3">
                    {money(p.price)} BHD
                  </span>
                  <span className="num text-[9px] text-mute-4">
                    {d.common.scanToBuy}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
