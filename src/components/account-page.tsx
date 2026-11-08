"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageShell } from "@/components/page-shell";
import { money, type CustomerType } from "@/lib/cafe";

export function AccountPage() {
  const { user, orders, status, setCustomerType } = useCafe();
  const { t, locale } = useI18n();
  const [choice, setChoice] = useState<CustomerType | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !choice) return;
    setSaving(true);
    setMessage(null);
    const result = await setCustomerType(choice);
    setSaving(false);
    setMessage(result.ok ? { ok: true, text: t("cust.account.saved") } : { ok: false, text: result.error });
  }

  return (
    <PageShell>
      <h1 className="page-title">{t("cust.account.title")}</h1>
      {status === "loading" ? (
        <p className="page-note">{t("common.loading")}</p>
      ) : !user ? (
        <div className="page-card">
          <p>{t("cust.account.signIn")}</p>
          <p><Link href="/login">{t("common.signIn")}</Link> · <Link href="/register">{t("common.register")}</Link></p>
        </div>
      ) : (
        <div className="account-grid">
          <section className="page-card" aria-labelledby="acct-profile">
            <h2 id="acct-profile">{user.name}</h2>
            <dl className="account-facts">
              <div><dt>{t("cust.account.email")}</dt><dd>{user.email}</dd></div>
              <div><dt>{t("cust.account.name")}</dt><dd>{user.name}</dd></div>
            </dl>
            {user.role !== "customer" ? (
              <p className="page-note">{t("cust.account.staff")}</p>
            ) : (
              <form onSubmit={save} className="account-role">
                <fieldset className="auth-roles">
                  <legend>{t("cust.account.roleTitle")}</legend>
                  {(["student", "teacher"] as const).map(type => (
                    <label key={type}>
                      <input type="radio" name="customerType" value={type} checked={(choice ?? user.customerType) === type} onChange={() => setChoice(type)} />
                      <span><strong>{t(`auth.role.${type}`)}</strong><small>{t(`auth.role.${type}Desc`)}</small></span>
                    </label>
                  ))}
                </fieldset>
                <p className="page-note">{t("cust.account.discountNote")}</p>
                {message && <p className={message.ok ? "page-success" : "auth-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
                <button className="page-button" type="submit" disabled={saving || !choice || choice === user.customerType}>
                  {saving ? t("cust.account.saving") : t("cust.account.save")}
                </button>
              </form>
            )}
          </section>
          <section className="page-card" aria-labelledby="acct-orders">
            <h2 id="acct-orders">{t("cust.account.orders")}</h2>
            {user.role !== "customer" ? null : orders.length === 0 ? (
              <p className="page-note">{t("cust.account.noOrders")} <Link href="/#menu">{t("cust.account.menu")}</Link></p>
            ) : (
              <ul className="account-orders">
                {orders.map(order => (
                  <li key={order.id}>
                    <div>
                      <strong>{order.id}</strong>
                      <small>{new Date(order.createdAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
                    </div>
                    <span className={`ord-status ord-status-${order.status}`}>{t(`status.${order.status}`)}</span>
                    <strong>{money(order.total)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
