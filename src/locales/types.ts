export const LANGS = ["mn", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "mn";
export const LANG_COOKIE = "lang";
export const LOCALES: Record<Lang, string> = { mn: "mn-MN", en: "en-US" };

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/**
 * Declares one namespace of messages. The Mongolian table must contain exactly the
 * same keys as the English one, so a missing translation is a compile error.
 */
export function defineMessages<const T extends Record<string, string>>(en: T, mn: Record<keyof T, string>) {
  return { en, mn };
}
