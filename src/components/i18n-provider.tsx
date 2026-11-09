"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LANG, LOCALES, translate, type TFunction } from "@/locales";

type I18nValue = { locale: string; t: TFunction };
const I18nContext = createContext<I18nValue | null>(null);
const value: I18nValue = {
  locale: LOCALES[DEFAULT_LANG],
  t: (key, vars) => translate(DEFAULT_LANG, key, vars),
};

/** Shares English messages and formatting across client components. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}
