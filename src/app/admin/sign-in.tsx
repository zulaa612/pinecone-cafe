"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "@/components/icon";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher, ThemeToggle } from "@/components/preferences";
import type { FormState } from "@/lib/validation";
import { signInStaff } from "./actions";

export function StaffSignIn() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(signInStaff, {} as FormState);
  return (
    <main className="adm-login">
      <div className="adm-login-story">
        <Link href="/" className="adm-brand"><span className="adm-brand-mark"><Icon name="coffee" size={24} /></span><span>Pine & Pour<span className="adm-brand-sub">{t("adm.brand.sub")}</span></span></Link>
        <div className="adm-login-quote"><span className="adm-eyebrow">{t("adm.login.quoteEyebrow")}</span><h1>{t("adm.login.quoteLine1")}<br />{t("adm.login.quoteLine2")}</h1><p>{t("adm.login.quoteText")}</p><span className="adm-login-line" /></div>
        <p className="adm-login-bottom">{t("adm.login.bottom")}</p>
      </div>
      <div className="adm-login-main">
        <div className="adm-login-prefs">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <Link href="/" className="adm-back"><Icon name="arrow-left" size={17} /> {t("adm.login.back")}</Link>
        <section className="adm-login-card">
          <span className="adm-lock"><Icon name="lock" size={23} /></span>
          <span className="adm-eyebrow">{t("adm.login.eyebrow")}</span>
          <h2>{t("adm.login.titleLine1")}<br />{t("adm.login.titleLine2")}</h2>
          <p>{t("adm.login.intro")}</p>
          <form action={action} className="adm-login-form">
            <label htmlFor="staff-email">{t("adm.login.email")}</label>
            <input id="staff-email" name="email" type="email" autoComplete="username" placeholder={t("adm.login.emailPlaceholder")} required maxLength={254} aria-invalid={Boolean(state.error)} />
            <label htmlFor="staff-password">{t("adm.login.password")}</label>
            <input id="staff-password" name="password" type="password" autoComplete="current-password" placeholder={t("adm.login.passwordPlaceholder")} required maxLength={256} aria-describedby={state.error ? "staff-error" : undefined} aria-invalid={Boolean(state.error)} />
            {state.error && <p id="staff-error" className="adm-field-error" role="alert">{state.error}</p>}
            <button className="adm-primary" disabled={pending} type="submit">{pending ? t("adm.login.pending") : t("adm.login.submit")}<Icon name="arrow-right" size={17} /></button>
          </form>
          <p className="adm-login-help">{t("adm.login.help1")}<br />{t("adm.login.help2")}</p>
        </section>
        <span className="adm-login-copyright">{t("adm.footer.copy")}</span>
      </div>
    </main>
  );
}
