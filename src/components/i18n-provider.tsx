"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LANG_COOKIE, LOCALES, translate, type Lang, type MessageKey, type TFunction, type Vars } from "@/locales";

type I18nValue = { lang: Lang; locale: string; setLang: (lang: Lang) => void; t: TFunction };
const I18nContext = createContext<I18nValue | null>(null);

/**
 * Language lives in a cookie so the server renders the right language on first paint.
 * Switching only updates this state, so the cart and session are untouched.
 */
export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, locale: LOCALES[lang], setLang, t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}
