import Link from "next/link";

import { Icon } from "@/components/Icon";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export default async function NotFound() {
  const lang = await getLang();
  const d = t(lang);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-shell px-6 text-center">
      <Icon name="search_off" size={34} className="text-mute-5" />
      <p className="text-lg font-medium">{d.shop.shopNotFound}</p>
      <Link href="/" className="btn btn-ink mt-3">
        {d.brand}
      </Link>
    </div>
  );
}
