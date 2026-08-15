"use client";

import { useTransition } from "react";

import { signOut } from "@/app/actions/shop";
import { Icon } from "@/components/Icon";

export function SignOutButton({ label }: { label: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={pending}
      onClick={() => start(() => void signOut())}
      className="shrink-0 cursor-pointer text-mute-2 transition-colors hover:text-paper disabled:opacity-50"
    >
      <Icon name="logout" size={18} />
    </button>
  );
}
