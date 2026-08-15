import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { getOwnShop } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getUser } from "@/lib/supabase/server";

import { SetupForm } from "./SetupForm";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const shop = await getOwnShop();
  if (shop) redirect("/dashboard");

  const lang = await getLang();
  const d = t(lang);

  return (
    <div className="flex min-h-dvh flex-col bg-sand">
      <header className="flex items-center gap-4 border-b border-line-3 bg-paper px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Icon name="qr_code_2" size={24} />
          <span className="text-base font-medium">{d.brand}</span>
        </Link>
        <LangToggle
          lang={lang}
          label={d.langLabel}
          className="ms-auto rounded-full border border-line-2 px-3.5 py-2 text-xs font-medium text-mute"
        />
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-[560px] flex-1 px-5 py-10 sm:px-6"
      >
        <div className="mb-7 flex flex-col gap-2.5">
          <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.03em]">
            {d.onboarding.title}
          </h1>
          <p className="text-sm leading-[1.6] text-mute text-pretty">
            {d.onboarding.sub}
          </p>
        </div>

        <SetupForm lang={lang} origin={siteUrl()} />
      </main>
    </div>
  );
}
