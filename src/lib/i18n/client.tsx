"use client";

import { createContext, use, type ReactNode } from "react";
import { dictionaries, translate, type Lang, type TKey } from "./dictionaries";

const LangContext = createContext<Lang>("en");

/** Pages wrap their content in this so Client Components can call useT(). */
export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export function useT() {
  const lang = use(LangContext);
  const dict = dictionaries[lang];
  return Object.assign((key: TKey, vars?: Record<string, string | number>) => translate(dict, key, vars), { lang });
}
