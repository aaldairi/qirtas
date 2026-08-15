import { cookies } from "next/headers";

import { DEFAULT_LANG, LANG_COOKIE, isLang, type Lang } from "@/lib/i18n";

/** Reads the language the visitor picked; Arabic is the default. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}
