import { PageHeader } from "@/components/PageHeader";
import { requireShop } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { storeUrl } from "@/lib/urls";

import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { shop, email } = await requireShop();
  const lang = await getLang();
  const d = t(lang);

  return (
    <>
      <PageHeader title={d.dash.pages.settings} />

      <div className="px-5 py-6 lg:px-7">
        <SettingsForm
          lang={lang}
          shop={shop}
          email={email}
          storeUrl={storeUrl(shop.slug)}
        />
      </div>
    </>
  );
}
