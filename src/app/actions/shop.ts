"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getOwnShop, requireShop } from "@/lib/data";
import { fils } from "@/lib/money";
import { isReservedSlug, isValidSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const payment = z.object({
  iban_on: z.boolean(),
  iban_value: z.string().trim().max(64).nullable(),
  wallet_on: z.boolean(),
  wallet_value: z.string().trim().max(64).nullable(),
  cash_on: z.boolean(),
  cash_value: z.string().trim().max(120).nullable(),
});

const createSchema = payment.extend({
  name: z.string().trim().min(1).max(80),
  owner_name: z.string().trim().max(80).nullable(),
  slug: z.string().trim().toLowerCase(),
});

function paymentProblem(input: z.infer<typeof payment>): string | null {
  const on = [input.iban_on, input.wallet_on, input.cash_on].filter(Boolean);
  if (on.length === 0) return "needOnePayment";

  if (input.iban_on && !input.iban_value?.trim()) return "needPaymentValue";
  if (input.wallet_on && !input.wallet_value?.trim()) return "needPaymentValue";

  return null;
}

export async function createShop(
  raw: z.input<typeof createSchema>,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const existing = await getOwnShop();
  if (existing) redirect("/dashboard");

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  if (!isValidSlug(input.slug) || isReservedSlug(input.slug)) {
    return { ok: false, error: "slugInvalid" };
  }

  const problem = paymentProblem(input);
  if (problem) return { ok: false, error: problem };

  const db = createAdminClient();
  const { error } = await db.from("shops").insert({
    owner_id: user.id,
    name: input.name,
    slug: input.slug,
    owner_name: input.owner_name || null,
    iban_on: input.iban_on,
    iban_value: input.iban_value?.trim() || null,
    wallet_on: input.wallet_on,
    wallet_value: input.wallet_value?.trim() || null,
    cash_on: input.cash_on,
    cash_value: input.cash_value?.trim() || null,
  });

  if (error) {
    // 23505 = unique_violation, i.e. somebody claimed the slug first.
    if (error.code === "23505") return { ok: false, error: "slugTaken" };
    return { ok: false, error: "somethingWrong" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const updateSchema = payment.extend({
  name: z.string().trim().min(1).max(80),
  owner_name: z.string().trim().max(80).nullable(),
  pickup_on: z.boolean(),
  delivery_on: z.boolean(),
  delivery_fee: z.number().min(0).max(999),
  whatsapp: z.string().trim().max(32).nullable(),
});

export async function updateShop(
  raw: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  const { shop } = await requireShop();

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  const problem = paymentProblem(input);
  if (problem) return { ok: false, error: problem };

  if (!input.pickup_on && !input.delivery_on) {
    return { ok: false, error: "needFulfilment" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("shops")
    .update({
      name: input.name,
      owner_name: input.owner_name || null,
      iban_on: input.iban_on,
      iban_value: input.iban_value?.trim() || null,
      wallet_on: input.wallet_on,
      wallet_value: input.wallet_value?.trim() || null,
      cash_on: input.cash_on,
      cash_value: input.cash_value?.trim() || null,
      pickup_on: input.pickup_on,
      delivery_on: input.delivery_on,
      delivery_fee: fils(input.delivery_fee),
      whatsapp: input.whatsapp?.trim() || null,
    })
    .eq("id", shop.id);

  if (error) return { ok: false, error: "somethingWrong" };

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return { ok: true };
}

/**
 * Changing the store link breaks every QR label already printed against the
 * old one, so this is deliberately a separate action from the rest of
 * settings — the UI warns before calling it.
 */
export async function updateSlug(raw: string): Promise<ActionResult> {
  const { shop } = await requireShop();
  const slug = raw.trim().toLowerCase();

  if (slug === shop.slug) return { ok: true };
  if (!isValidSlug(slug) || isReservedSlug(slug)) {
    return { ok: false, error: "slugInvalid" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("shops")
    .update({ slug })
    .eq("id", shop.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "slugTaken" };
    return { ok: false, error: "somethingWrong" };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true };
}

export async function checkSlug(slug: string): Promise<"ok" | "taken" | "invalid"> {
  const value = slug.trim().toLowerCase();
  if (!isValidSlug(value) || isReservedSlug(value)) return "invalid";

  const db = createAdminClient();
  const { data } = await db
    .from("shops")
    .select("id")
    .eq("slug", value)
    .maybeSingle();

  return data ? "taken" : "ok";
}

export async function signOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
