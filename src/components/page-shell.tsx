"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCafe } from "@/components/cafe-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icon";
import { CartDrawer, OrderTracker } from "@/components/order-dialogs";
import { LanguageSwitcher, ThemeToggle } from "@/components/preferences";
import { Brand } from "@/components/storefront";

/** Header, checkout and order tracking for product detail pages. */
export function PageShell({ children }: { children: ReactNode }) {
  const { cartCount } = useCafe();
  const { t } = useI18n();
  const [cartOpen, setCartOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);

  return (
    <div className="storefront page-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={t("nav.mainLabel")}>
            <Link href="/">{t("nav.home")}</Link>
            <Link href="/#menu">{t("nav.menu")}</Link>
            <Link href="/admin">{t("common.admin")}</Link>
          </nav>
          <div className="header-actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={t("cust.cartLabel", { count: cartCount })}>
              <Icon name="bag" size={18} />
              <span className="cart-count">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="container page-main">{children}</main>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onTrack={(id) => { setCartOpen(false); setTrackedOrderId(id); }} />}
      {trackedOrderId && <OrderTracker orderId={trackedOrderId} onClose={() => setTrackedOrderId(null)} />}
    </div>
  );
}
