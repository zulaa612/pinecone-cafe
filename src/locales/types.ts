export const LANGS = ["en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const LOCALES: Record<Lang, string> = { en: "en-US" };

/** Declares one namespace of English messages. */
export function defineMessages<const T extends Record<string, string>>(en: T) {
  return { en };
}
