"use client";

import { Icon } from "@/components/Icon";
import type { Lang } from "@/lib/i18n";

export type PayState = {
  iban_on: boolean;
  iban_value: string;
  wallet_on: boolean;
  wallet_value: string;
  cash_on: boolean;
  cash_value: string;
};

export const emptyPay: PayState = {
  iban_on: true,
  iban_value: "",
  wallet_on: false,
  wallet_value: "",
  cash_on: true,
  cash_value: "",
};

type Row = {
  key: "iban" | "wallet" | "cash";
  icon: string;
  label: string;
  placeholder: string;
  /** Bank/wallet handles must be typed exactly, so keep them LTR + mono. */
  mono: boolean;
};

function rows(lang: Lang): Row[] {
  const ar = lang === "ar";
  return [
    {
      key: "iban",
      icon: "account_balance",
      label: ar ? "تحويل بنكي (IBAN)" : "Bank transfer (IBAN)",
      placeholder: "BH00 XXXX 0000 0000 0000 00",
      mono: true,
    },
    {
      key: "wallet",
      icon: "account_balance_wallet",
      label: ar ? "محفظة إلكترونية" : "Wallet (BenefitPay)",
      placeholder: "+973 0000 0000",
      mono: true,
    },
    {
      key: "cash",
      icon: "payments",
      label: ar ? "نقداً عند الاستلام" : "Cash on pickup",
      placeholder: ar ? "ادفع عند الكاونتر" : "Pay at the counter",
      mono: false,
    },
  ];
}

export function PaymentMethods({
  lang,
  value,
  onChange,
}: {
  lang: Lang;
  value: PayState;
  onChange: (next: PayState) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows(lang).map((row) => {
        const on = value[`${row.key}_on`];
        const detail = value[`${row.key}_value`];

        return (
          <div
            key={row.key}
            className={`flex flex-col gap-2.5 rounded-[14px] border p-3.5 transition-colors ${
              on ? "border-ink bg-white" : "border-line bg-soft"
            }`}
          >
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() =>
                onChange({ ...value, [`${row.key}_on`]: !on } as PayState)
              }
              className="flex cursor-pointer items-center gap-2.5 text-start"
            >
              <Icon
                name={row.icon}
                size={21}
                className={on ? "text-ink" : "text-mute-2"}
              />
              <span className="flex-1 text-sm font-medium">{row.label}</span>
              <Icon
                name={on ? "check_circle" : "radio_button_unchecked"}
                size={22}
                className={on ? "text-ok" : "text-line-5"}
              />
            </button>

            {on ? (
              <input
                value={detail}
                dir={row.mono ? "ltr" : undefined}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [`${row.key}_value`]: e.target.value,
                  } as PayState)
                }
                placeholder={row.placeholder}
                aria-label={row.label}
                className={`field !py-3 text-xs ${row.mono ? "font-mono" : ""}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
