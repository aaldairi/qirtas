import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getUser } from "@/lib/supabase/server";

import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const lang = await getLang();
  const d = t(lang);

  // Already signed in? Straight through — /dashboard sends them to
  // onboarding if they haven't created a shop yet.
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex items-center gap-4 px-6 py-5 sm:px-10">
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
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-7 px-6 pb-16"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-[17px] bg-ink">
          <Icon name="qr_code_2" size={30} className="text-paper" />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-[31px] font-medium leading-[1.15] tracking-[-0.035em] text-pretty">
            {d.auth.title}
          </h1>
          <p className="text-sm leading-[1.65] text-mute text-pretty">
            {d.auth.sub}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {d.auth.bullets.map(([icon, label]) => (
            <li key={label} className="flex items-center gap-2.5">
              <Icon name={icon} size={19} className="text-ok" />
              <span className="text-[13px] font-medium leading-[1.4] text-ink-3">
                {label}
              </span>
            </li>
          ))}
        </ul>

        <LoginForm lang={lang} />

        <p className="text-center text-[11px] leading-[1.6] text-mute-2 text-pretty">
          {d.auth.terms}
        </p>
      </main>
    </div>
  );
}
