import admin from "./admin";
import common from "./common";
import customer from "./customer";
import orders from "./orders";
import storefront from "./storefront";
import type { Lang } from "./types";

export type MessageKey =
  | keyof typeof common.en
  | keyof typeof storefront.en
  | keyof typeof orders.en
  | keyof typeof admin.en
  | keyof typeof customer.en;

const namespaces = [common, storefront, orders, admin, customer];
export const messages: Record<Lang, Record<string, string>> = {
  en: Object.assign({}, ...namespaces.map(n => n.en)),
};

export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

/** Falls back to English, then to the key itself, so a gap never renders as blank. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = messages[lang]?.[key] ?? messages.en[key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : template;
}

export const isMessageKey = (key: string): key is MessageKey => key in messages.en;

export { DEFAULT_LANG, LANGS, LOCALES, type Lang } from "./types";
