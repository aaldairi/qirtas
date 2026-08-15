import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LangToggle } from "@/components/LangToggle";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { qrDataUrl } from "@/lib/qr";
import { getOwnShop } from "@/lib/data";

export default async function MarketingPage() {
  const lang = await getLang();
  const d = t(lang);
  const m = d.marketing;

  // A genuinely scannable code — it points at this deployment's sign-up page,
  // so anyone pointing a camera at it lands somewhere real.
  const demoQr = await qrDataUrl(`${siteUrl()}/login`, 420);
  const shop = await getOwnShop();
  const primaryHref = shop ? "/dashboard" : "/login";

  return (
    <div className="bg-paper text-ink">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-20 border-b border-line-3 bg-paper/92 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-[1180px] items-center gap-4 px-7">
          <Icon name="qr_code_2" size={26} />
          <span className="text-[17px] font-medium">{d.brand}</span>

          <nav className="ms-auto flex items-center gap-6">
            <div className="hidden items-center gap-6 md:flex">
              {m.nav.map(([href, label]) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-mute transition-colors hover:text-ink"
                >
                  {label}
                </a>
              ))}
            </div>

            <LangToggle
              lang={lang}
              label={lang === "ar" ? "EN" : "ع"}
              iconSize={16}
              className="rounded-full border border-line-2 px-3 py-2 text-xs font-medium"
            />

            <Link
              href={primaryHref}
              className="rounded-[22px] bg-brand px-5 py-3 text-[13px] font-medium text-paper transition hover:brightness-110"
            >
              {m.ctaNav}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* -------------------------------------------------------- hero */}
        <section className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div className="flex flex-col gap-6">
              <span className="self-start rounded-[20px] bg-sand px-3.5 py-2 font-mono text-xs text-mute">
                {m.eyebrow}
              </span>
              <h1 className="text-[38px] font-extrabold leading-[1.08] tracking-[-0.04em] text-pretty md:text-[56px]">
                {m.heroTitle}
              </h1>
              <p className="max-w-[520px] text-[17px] leading-[1.7] text-mute text-pretty">
                {m.heroSub}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="flex items-center gap-2.5 rounded-[14px] bg-brand px-6 py-4 text-[15px] font-medium text-paper transition hover:brightness-110"
                >
                  <Icon name="storefront" size={19} />
                  <span>{m.ctaMain}</span>
                </Link>
                <a
                  href="#how"
                  className="rounded-[14px] border border-line-2 px-6 py-4 text-[15px] font-medium transition hover:bg-sand"
                >
                  {m.ctaSecond}
                </a>
              </div>

              <ul className="flex flex-wrap gap-6 pt-1.5">
                {m.proof.map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <Icon name="check_circle" size={18} className="text-ok" />
                    <span className="text-[13px] text-mute">{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* phone mock */}
            <div className="flex justify-center rounded-[28px] bg-sand p-8 md:p-10">
              <div className="flex w-[290px] flex-col gap-4 rounded-[30px] border border-line bg-paper p-5.5 shadow-[0_30px_60px_-34px_rgba(26,25,23,.45)]">
                <div className="flex items-center justify-between font-mono text-[11px] text-mute-2">
                  <span>9:41</span>
                  <Icon name="battery_full" size={14} />
                </div>
                <div className="h-[120px] rounded-2xl bg-[repeating-linear-gradient(135deg,#e7e3d9_0_8px,#f3f0e9_8px_16px)]" />
                <div className="flex flex-col gap-1.5">
                  <span className="label">{m.demoCat}</span>
                  <span className="text-[19px] font-medium leading-tight">
                    {m.demoName}
                  </span>
                  <span className="num text-[17px] font-medium">
                    3.200{" "}
                    <span className="text-[11px] text-mute-2">BHD</span>
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex-1 rounded-xl border border-ink py-3 text-center text-xs font-medium">
                    {m.demoAdd}
                  </span>
                  <span className="flex-1 rounded-xl bg-brand py-3 text-center text-xs font-medium text-paper">
                    {m.demoBuy}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section id="how" className="border-y border-line-3 bg-sand-2">
          <div className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
            <header className="mb-11 flex max-w-[620px] flex-col gap-3">
              <span className="font-mono text-xs text-mute-2">
                {m.howEyebrow}
              </span>
              <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-pretty md:text-[38px]">
                {m.howTitle}
              </h2>
            </header>

            <ol className="grid gap-5.5 md:grid-cols-3">
              {m.steps.map(([icon, title, body], i) => (
                <li
                  key={title}
                  className="flex flex-col gap-4 rounded-[22px] border border-line bg-paper p-7.5"
                >
                  <div className="flex items-center gap-3">
                    <Icon name={icon} size={26} />
                    <span className="num text-xs text-mute-2">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-xl font-medium leading-[1.25]">{title}</h3>
                  <p className="text-sm leading-[1.7] text-mute text-pretty">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ try a code */}
        <section
          id="demo"
          className="mx-auto max-w-[1180px] px-7 py-16 md:py-24"
        >
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-5">
              <span className="font-mono text-xs text-mute-2">
                {m.qrEyebrow}
              </span>
              <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-pretty md:text-[38px]">
                {m.qrTitle}
              </h2>
              <p className="text-base leading-[1.75] text-mute text-pretty">
                {m.qrBody}
              </p>
              <ul className="flex flex-col gap-3">
                {m.qrPoints.map(([icon, label]) => (
                  <li key={label} className="flex items-start gap-3">
                    <Icon name={icon} size={19} />
                    <span className="text-sm leading-[1.6] text-ink-3">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <div className="flex w-[300px] flex-col items-center gap-4 rounded-3xl border border-line bg-paper p-7 shadow-[0_24px_50px_-34px_rgba(26,25,23,.5)]">
                <span className="text-center text-base font-medium leading-[1.3]">
                  {m.demoName}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={demoQr}
                  alt={m.qrTitle}
                  width={190}
                  height={190}
                  className="h-[190px] w-[190px]"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <span className="num text-lg font-medium">3.200 BHD</span>
                  <span className="num text-[10px] text-mute-2">
                    {m.scanMe}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- features */}
        <section id="features" className="bg-ink text-paper">
          <div className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
            <header className="mb-11 flex max-w-[620px] flex-col gap-3">
              <span className="font-mono text-xs text-mute-2">
                {m.featEyebrow}
              </span>
              <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-paper text-pretty md:text-[38px]">
                {m.featTitle}
              </h2>
            </header>

            <div className="grid border-t border-ink-2 md:grid-cols-3">
              {m.features.map(([icon, title, body]) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 border-b border-ink-2 px-6.5 py-7.5"
                >
                  <Icon name={icon} size={26} className="text-paper" />
                  <h3 className="text-[17px] font-medium leading-[1.3] text-paper">
                    {title}
                  </h3>
                  <p className="text-[13px] leading-[1.7] text-mute-3 text-pretty">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- audiences */}
        <section className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
          <div className="grid gap-5.5 md:grid-cols-2">
            {m.audiences.map(([icon, title, points], i) => (
              <div
                key={title}
                className={`flex flex-col gap-4.5 rounded-3xl border border-line p-9 ${
                  i === 0 ? "bg-sand-2" : "bg-paper"
                }`}
              >
                <Icon name={icon} size={28} />
                <h3 className="text-2xl font-medium leading-[1.25] tracking-[-0.02em]">
                  {title}
                </h3>
                <ul className="flex flex-col gap-3">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="text-ok" />
                      <span className="text-sm leading-[1.6] text-ink-3">
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- pricing */}
        <section id="pricing" className="border-y border-line-3 bg-sand-2">
          <div className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
            <header className="mb-11 flex max-w-[620px] flex-col gap-3">
              <span className="font-mono text-xs text-mute-2">
                {m.priceEyebrow}
              </span>
              <h2 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-pretty md:text-[38px]">
                {m.priceTitle}
              </h2>
              <p className="text-[15px] leading-[1.7] text-mute text-pretty">
                {m.priceSub}
              </p>
            </header>

            <div className="grid gap-5.5 md:grid-cols-3">
              {m.plans.map(([name, price, period, popular, features]) => (
                <div
                  key={name}
                  className={`flex flex-col gap-5 rounded-3xl border p-8 ${
                    popular
                      ? "border-ink bg-ink"
                      : "border-line bg-paper"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-base font-medium ${
                        popular ? "text-paper" : "text-ink"
                      }`}
                    >
                      {name}
                    </span>
                    {popular ? (
                      <span className="rounded-[20px] bg-paper px-2.5 py-1.5 font-mono text-[10px] text-ink">
                        {m.popular}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span
                      className={`num text-[40px] font-extrabold leading-none tracking-[-0.04em] ${
                        popular ? "text-paper" : "text-ink"
                      }`}
                    >
                      {price}
                    </span>
                    <span className="font-mono text-xs text-mute-2">
                      {period}
                    </span>
                  </div>

                  <div
                    className={`h-px ${popular ? "bg-ink-2" : "bg-line-3"}`}
                  />

                  <ul className="flex flex-col gap-3">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Icon
                          name="check"
                          size={17}
                          className={popular ? "text-ok-line" : "text-ok"}
                        />
                        <span
                          className={`text-[13px] leading-[1.6] ${
                            popular ? "text-chalk" : "text-ink-3"
                          }`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={primaryHref}
                    className={`mt-auto rounded-[13px] border px-4 py-4 text-center text-sm font-medium transition ${
                      popular
                        ? "border-paper bg-paper text-ink hover:bg-white"
                        : "border-line-2 text-ink hover:bg-sand"
                    }`}
                  >
                    {m.choosePlan}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ why shelves */}
        <section className="mx-auto max-w-[1180px] px-7 py-16 md:py-24">
          <h2 className="mb-10 max-w-[560px] text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] text-pretty md:text-[38px]">
            {m.loveTitle}
          </h2>
          <div className="grid gap-5.5 md:grid-cols-3">
            {m.quotes.map(([text, num, title, sub]) => (
              <div
                key={title}
                className="flex flex-col gap-4.5 rounded-[22px] border border-line p-7.5"
              >
                <p className="text-[15px] leading-[1.75] text-ink-3 text-pretty">
                  {text}
                </p>
                <div className="mt-auto flex items-center gap-3">
                  <span className="num flex h-9.5 w-9.5 items-center justify-center rounded-full bg-dust text-xs font-medium text-mute">
                    {num}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{title}</span>
                    <span className="font-mono text-[11px] text-mute-2">
                      {sub}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="mx-auto max-w-[1180px] px-7 pb-16 md:pb-24">
          <div className="flex flex-wrap items-center gap-9 rounded-[28px] bg-ink p-9 md:p-14">
            <div className="flex min-w-[280px] flex-1 flex-col gap-3.5">
              <h2 className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-paper text-pretty md:text-[34px]">
                {m.contactTitle}
              </h2>
              <p className="max-w-[460px] text-[15px] leading-[1.7] text-mute-3 text-pretty">
                {m.contactBody}
              </p>
            </div>
            <Link
              href={primaryHref}
              className="flex items-center gap-2.5 rounded-[14px] bg-paper px-6 py-4 text-[15px] font-medium text-ink transition hover:bg-white"
            >
              <Icon name="storefront" size={20} />
              <span>{m.startFree}</span>
            </Link>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="border-t border-line-3">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-9 px-7 py-11">
          <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <Icon name="qr_code_2" size={22} />
              <span className="text-[15px] font-medium">{d.brand}</span>
            </div>
            <p className="max-w-[260px] text-xs leading-[1.7] text-mute-2 text-pretty">
              {m.footerBlurb}
            </p>
          </div>

          {m.footerCols.map(([title, links]) => (
            <div key={title} className="flex min-w-[150px] flex-col gap-3">
              <span className="font-mono text-[11px] text-mute-2">{title}</span>
              {links.map(([href, label]) => (
                <Link
                  key={label + href}
                  href={href}
                  className="text-[13px] text-ink-3 transition-colors hover:text-brand"
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1180px] px-7 pb-9 font-mono text-[11px] text-mute-4">
          {m.copyright}
        </div>
      </footer>
    </div>
  );
}
