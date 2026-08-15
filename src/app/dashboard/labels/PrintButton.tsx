"use client";

import { Icon } from "@/components/Icon";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-primary"
    >
      <Icon name="print" size={17} />
      <span>{label}</span>
    </button>
  );
}
