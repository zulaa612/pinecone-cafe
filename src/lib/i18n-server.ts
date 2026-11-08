import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, isMessageKey, translate, type Lang, type MessageKey, type TFunction, type Vars } from "@/locales";

/** Reads the visitor's language from the cookie set by the language switcher. */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function getT(): Promise<TFunction> {
  const lang = await getLang();
  return (key: MessageKey, vars?: Vars) => translate(lang, key, vars);
}

/** Validation schemas carry message keys; anything unknown (e.g. a zod default) becomes a generic message. */
export function issueMessage(t: TFunction, issue: { message: string } | undefined): string {
  return t(issue && isMessageKey(issue.message) ? issue.message : "err.invalid");
}
