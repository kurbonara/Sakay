import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { dictionaries, translate, type Lang, type TKey } from "./dictionaries";

export const LANG_COOKIE = "sakay_lang";

/** Reads the language cookie (inside a Suspense boundary) and returns a translator. */
export const getI18n = cache(async () => {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: Lang = value === "fil" ? "fil" : "en";
  const dict = dictionaries[lang];
  const t = (key: TKey, vars?: Record<string, string | number>) => translate(dict, key, vars);
  return { lang, t };
});
