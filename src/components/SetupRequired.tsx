import { Icon } from "@/components/Icon";

/**
 * Shown when the deployment has no Supabase credentials yet. A fresh deploy
 * would otherwise throw on the first render, and whoever opened the link —
 * possibly a customer with a phone camera — would see a blank error page.
 *
 * Only variable *names* are listed, never values.
 */
export function SetupRequired({ missing }: { missing: string[] }) {
  const steps = [
    {
      icon: "database",
      title: "Create a Supabase project",
      body: "Then run supabase/schema.sql in the SQL Editor. It creates every table, the row-level security policies, and both storage buckets.",
    },
    {
      icon: "key",
      title: "Add the environment variables",
      body: "Project URL and the anon key from Data API, plus the service_role key from API Keys. Set them on the hosting project, not in the repository.",
    },
    {
      icon: "link",
      title: "Allow the auth callback",
      body: "In Supabase, under Authentication → URL Configuration, add this deployment's origin as the Site URL and its /auth/callback path as a redirect URL.",
    },
  ];

  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand px-5 py-12">
      <main className="flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-ink">
            <Icon name="qr_code_2" size={24} className="text-paper" />
          </span>
          <span className="text-lg font-medium">Qirtas</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.03em]">
            Almost there — one setup step left
          </h1>
          <p className="text-sm leading-[1.65] text-mute text-pretty">
            This deployment is running, but it has no database connected yet, so
            there is nothing to show. Connect Supabase and it comes to life.
          </p>
        </div>

        <div className="card flex flex-col gap-3 p-5">
          <span className="label">MISSING VARIABLES</span>
          <ul className="flex flex-col gap-2">
            {missing.map((name) => (
              <li key={name} className="flex items-center gap-2.5">
                <Icon name="error" size={17} className="text-bad" />
                <code className="num text-[13px] text-ink-3">{name}</code>
              </li>
            ))}
          </ul>
        </div>

        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.title} className="card flex gap-3.5 p-5">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-xs font-medium text-mute">
                {i + 1}
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon name={step.icon} size={17} className="text-mute" />
                  {step.title}
                </span>
                <span className="text-[13px] leading-[1.6] text-mute text-pretty">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="text-xs leading-[1.6] text-mute-2 text-pretty">
          Full instructions are in the project README. Once the variables are
          set, redeploy and this screen is replaced by the store.
        </p>
      </main>
    </div>
  );
}
