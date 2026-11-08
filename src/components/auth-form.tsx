"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginCustomer, registerCustomer } from "@/app/auth/actions";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher, ThemeToggle } from "@/components/preferences";
import type { FormState } from "@/lib/validation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const register = mode === "register";
  const [state, action, pending] = useActionState(register ? registerCustomer : loginCustomer, {} as FormState);
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-prefs">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <Link href="/" className="auth-back">{t("auth.back")}</Link>
        <h1>{register ? t("auth.title.register") : t("auth.title.login")}</h1>
        <p>{register ? t("auth.intro.register") : t("auth.intro.login")}</p>
        <form action={action} className="auth-form" noValidate={false}>
          {register && (
            <label>{t("auth.name")}
              <input name="name" autoComplete="name" required minLength={2} maxLength={80} aria-invalid={Boolean(fieldError("name"))} />
              {fieldError("name") && <small role="alert">{fieldError("name")}</small>}
            </label>
          )}
          <label>{t("auth.email")}
            <input name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(fieldError("email"))} />
            {fieldError("email") && <small role="alert">{fieldError("email")}</small>}
          </label>
          <label>{t("auth.password")}
            <input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 8 : 1} maxLength={256} aria-invalid={Boolean(fieldError("password"))} />
            {fieldError("password") && <small role="alert">{fieldError("password")}</small>}
          </label>
          {register && (
            <fieldset className="auth-roles">
              <legend>{t("auth.roleLegend")}</legend>
              <label><input type="radio" name="customerType" value="student" defaultChecked /> <span><strong>{t("auth.role.student")}</strong><small>{t("auth.role.studentDesc")}</small></span></label>
              <label><input type="radio" name="customerType" value="teacher" /> <span><strong>{t("auth.role.teacher")}</strong><small>{t("auth.role.teacherDesc")}</small></span></label>
            </fieldset>
          )}
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          <button type="submit" disabled={pending}>{pending ? t("auth.pending") : register ? t("auth.submit.register") : t("auth.submit.login")}</button>
        </form>
        <p className="auth-switch">
          {register ? <>{t("auth.switch.haveAccount")} <Link href="/login">{t("auth.switch.signIn")}</Link></> : <>{t("auth.switch.newHere")} <Link href="/register">{t("auth.switch.create")}</Link></>}
        </p>
      </section>
    </main>
  );
}
