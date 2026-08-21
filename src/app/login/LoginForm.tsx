"use client";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  COOLDOWN_SECONDS,
  parseLastRequest,
  secondsLeft,
  type LastRequest,
} from "@/lib/cooldown";
import { fill, t, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent";

const REQUEST_KEY = "qirtas.signin.request";

function readLastRequest(): LastRequest | null {
  if (typeof window === "undefined") return null;
  try {
    return parseLastRequest(window.localStorage.getItem(REQUEST_KEY));
  } catch {
    // Private mode or a disabled store: no persisted cooldown to honour.
    return null;
  }
}

function writeLastRequest(email: string) {
  if (typeof window === "undefined") return;
  try {
    const entry: LastRequest = { at: Date.now(), email };
    window.localStorage.setItem(REQUEST_KEY, JSON.stringify(entry));
  } catch {
    // A cooldown we cannot persist is still enforced for this mount.
  }
}

export function LoginForm({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(0);

  // Starts at 0 on both server and client, then reconciles from storage, so
  // the first paint matches the markup React streamed.
  useEffect(() => {
    const entry = readLastRequest();
    const remaining = secondsLeft(entry);
    if (remaining === 0) return;

    // A reload used to wipe the "check your inbox" panel and hand back an
    // empty form, which is exactly when someone sends a second link.
    setLeft(remaining);
    if (entry?.email) {
      setEmail(entry.email);
      setState("sent");
    }
  }, []);

  // Keyed on the boolean, not on `left`: depending on the count would tear the
  // interval down and rebuild it on every tick.
  const cooling = left > 0;
  useEffect(() => {
    if (!cooling) return;
    const id = window.setInterval(() => {
      setLeft(secondsLeft(readLastRequest()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooling]);

  const startCooldown = useCallback((value: string) => {
    writeLastRequest(value);
    setLeft(COOLDOWN_SECONDS);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();

    // The button is disabled during the cooldown, but Enter still submits.
    const remaining = secondsLeft(readLastRequest());
    if (remaining > 0) {
      setLeft(remaining);
      setError(fill(d.auth.resendWait, { seconds: String(remaining) }));
      return;
    }

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
      // Backing off after a refusal matters more than after a success:
      // retrying immediately is what turns one blocked send into a spent hour.
      if (isRateLimit(authError)) startCooldown(value);
      setError(authMessage(authError, d));
      setState("idle");
      return;
    }

    startCooldown(value);
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
          disabled={left > 0}
          onClick={() => setState("idle")}
          className="self-start text-[13px] font-medium text-ok-ink underline underline-offset-4 disabled:no-underline disabled:opacity-60"
        >
          {left > 0
            ? fill(d.auth.resendIn, { seconds: String(left) })
            : d.auth.resend}
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
        disabled={state === "sending" || left > 0}
        className="btn btn-ink py-4.5 text-sm"
      >
        {left > 0
          ? fill(d.auth.resendIn, { seconds: String(left) })
          : state === "sending"
            ? d.auth.sending
            : d.auth.send}
      </button>
    </form>
  );
}

function isRateLimit(error: { message?: string; status?: number }): boolean {
  return (
    error.status === 429 ||
    /rate limit|too many requests|after \d+ seconds?/i.test(error.message ?? "")
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

  if (isRateLimit(error)) return d.auth.rateLimited;
  if (/signups? not allowed|disabled/i.test(text)) return d.auth.signupsOff;
  if (/invalid|email address/i.test(text)) return d.auth.invalidEmail;
  return d.common.somethingWrong;
}
