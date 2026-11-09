import "server-only";

import { DEFAULT_LANG, isMessageKey, translate, type MessageKey, type TFunction, type Vars } from "@/locales";

export async function getT(): Promise<TFunction> {
  return (key: MessageKey, vars?: Vars) => translate(DEFAULT_LANG, key, vars);
}

/** Validation schemas carry message keys; anything unknown (e.g. a zod default) becomes a generic message. */
export function issueMessage(t: TFunction, issue: { message: string } | undefined): string {
  return t(issue && isMessageKey(issue.message) ? issue.message : "err.invalid");
}
