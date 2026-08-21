"use client";

import { useState } from "react";

import { Icon } from "@/components/Icon";
import { fill, t, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent";

export function LoginForm({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError(d.auth.invalidEmail);
      return;
    }

    setError("");
    setState("sending");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authMessage(authError, d));
      setState("idle");
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col gap-4 rounded-[18px] border border-ok-line bg-ok-soft p-6 animate-pop">
        <div className="flex items-center gap-2.5">
          <Icon name="mark_email_read" size={22} className="text-ok-ink" />
          <span className="text-base font-medium text-ok-ink">
            {d.auth.sent}
          </span>
        </div>
        <p className="text-[13px] leading-[1.6] text-ok-ink/85 text-pretty">
          {fill(d.auth.sentSub, { email })}
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="self-start text-[13px] font-medium text-ok-ink underline underline-offset-4"
        >
          {d.auth.resend}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-2">
        <span className="label">{d.auth.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          placeholder="you@shop.com"
          className="field text-[15px]"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3 py-3 text-xs font-medium text-bad-ink"
        >
          <Icon name="error" size={17} />
          <span>{error}</span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="btn btn-ink py-4.5 text-sm"
      >
        {state === "sending" ? d.auth.sending : d.auth.send}
      </button>
    </form>
  );
}

// Supabase reports auth failures as English prose. Showing that raw inside an
// Arabic screen is both untranslated and unactionable, so the cases an owner
// can actually hit get a message that says what to do next.
function authMessage(
  error: { message?: string; status?: number },
  d: ReturnType<typeof t>,
): string {
  const text = error.message ?? "";

  if (error.status === 429 || /rate limit|too many requests/i.test(text)) {
    return d.auth.rateLimited;
  }
  if (/signups? not allowed|disabled/i.test(text)) {
    return d.auth.signupsOff;
  }
  if (/invalid|email address/i.test(text)) {
    return d.auth.invalidEmail;
  }
  return d.common.somethingWrong;
}
