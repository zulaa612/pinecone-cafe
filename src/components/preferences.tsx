"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";
import { useI18n } from "@/components/i18n-provider";
import { LANGS } from "@/locales";

const THEME_KEY = "pine-theme";
const THEME_EVENT = "pine-theme-change";
type Theme = "light" | "dark";

const subscribe = (notify: () => void) => {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
};
const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Reads the theme the inline head script already applied, so there is no flash on load. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  const setTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? t("theme.toLight") : t("theme.toDark");
  return (
    // suppressHydrationWarning: the server can't know the theme the head script applied.
    <button type="button" className={`pref-button theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label} suppressHydrationWarning>
      <span suppressHydrationWarning><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></span>
    </button>
  );
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className={`pref-lang ${className}`} role="group" aria-label={t("lang.label")}>
      {LANGS.map(code => (
        <button
          key={code}
          type="button"
          lang={code}
          className={code === lang ? "pref-lang-active" : ""}
          aria-pressed={code === lang}
          aria-label={t("lang.switchTo", { language: t(`lang.${code}`) })}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
