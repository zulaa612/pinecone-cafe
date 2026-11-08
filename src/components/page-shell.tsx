"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/app/auth/actions";
import { useCafe } from "@/components/cafe-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icon";
import { CartDrawer } from "@/components/order-dialogs";
import { LanguageSwitcher, ThemeToggle } from "@/components/preferences";
import { Brand } from "@/components/storefront";

/** Header + cart drawer for secondary pages (product detail, account). */
export function PageShell({ children }: { children: ReactNode }) {
  const { user, cartCount } = useCafe();
  const { t } = useI18n();
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="storefront page-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={t("nav.mainLabel")}>
            <Link href="/">{t("nav.home")}</Link>
            <Link href="/#menu">{t("nav.menu")}</Link>
          </nav>
          <div className="header-actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="user-chip">
              {user ? (
                <>
                  <Link href="/account" className="user-name">{user.name}</Link>
                  {user.role === "admin" && <Link href="/admin">{t("common.admin")}</Link>}
                  <form action={logout}><button type="submit">{t("common.signOut")}</button></form>
                </>
              ) : (
                <Link href="/login">{t("common.signIn")}</Link>
              )}
            </div>
            <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={t("cust.cartLabel", { count: cartCount })}>
              <Icon name="bag" size={18} />
              <span className="cart-count">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="container page-main">{children}</main>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onTrack={() => { setCartOpen(false); router.push("/account"); }} />}
    </div>
  );
}
