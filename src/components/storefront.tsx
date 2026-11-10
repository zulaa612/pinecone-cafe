"use client";

import Link from "next/link";
import { Coffee } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCafe } from "./cafe-provider";
import { Icon } from "./icon";
import { CartDrawer, OrderTracker, ReviewDialog } from "./order-dialogs";
import { money, type Category } from "@/lib/cafe";
import { useI18n } from "./i18n-provider";
import { ThemeToggle } from "./preferences";

const categories: { name: "All favorites" | Category; icon: string }[] = [
  { name: "All favorites", icon: "grid" },
  { name: "Coffee", icon: "coffee" },
  { name: "Non-Coffee", icon: "leaf" },
  { name: "Meal", icon: "croissant" },
];

export function Brand({ light = false }: { light?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label={t("store.brand.home")}
    >
      <span className="brand-symbol" aria-hidden="true">
        <Coffee size={24} strokeWidth={1.5} />
      </span>
      <span className="brand-wordmark">
        <span className="brand-name">Pinecone cafe</span>
        <span className="brand-tagline">{t("store.brand.tagline")}</span>
      </span>
    </Link>
  );
}

export function Stars({ rating = 5 }: { rating?: number }) {
  const { t } = useI18n();
  return (
    <span
      className="stars"
      role="img"
      aria-label={t("store.stars.label", { rating })}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          name="star"
          size={14}
          key={n}
          className={n <= Math.round(rating) ? "star-filled" : ""}
        />
      ))}
    </span>
  );
}

export default function Storefront() {
  const { products, reviews, cart, cartCount, cartTotal, addToCart, checkPayment } =
    useCafe();
  const { t } = useI18n();
  const [category, setCategory] = useState("All favorites");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"cart" | "track" | "review" | null>(
    null,
  );
  const [orderId, setOrderId] = useState<string>();
  const [paymentReturn, setPaymentReturn] = useState<"return" | "canceled">();
  const [paymentReturnError, setPaymentReturnError] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const paymentReturnHandled = useRef(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (paymentReturnHandled.current) return;
    const url = new URL(window.location.href);
    const returnedOrderId = url.searchParams.get("payment_order");
    const result = url.searchParams.get("payment");
    if (!returnedOrderId || returnedOrderId.length > 60 || (result !== "return" && result !== "canceled")) return;
    paymentReturnHandled.current = true;
    url.searchParams.delete("payment_order");
    url.searchParams.delete("payment");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    // Restore the saved order after hosted checkout. Only the server can verify payment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderId(returnedOrderId);
    setPaymentReturn(result);
    setDialog("track");
    setVerifyingPayment(true);
    void checkPayment(returnedOrderId).then((payment) => {
      if (!payment.ok) setPaymentReturnError(payment.error);
      setVerifyingPayment(false);
    });
  }, [checkPayment]);
  const filtered = products.filter(
    (p) =>
      (category === "All favorites" || p.category === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  function addItem(id: string, name: string) {
    addToCart(id);
    setToast(t("store.toast.added", { name }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }
  const closeDialog = () => setDialog(null);

  return (
    <div className="storefront">
      <a className="skip-link" href="#menu">
        {t("store.skip")}
      </a>
      <div className="announcement">
        <span className="code">
          {t("store.announcement.code")} <Coffee />
        </span>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label={t("nav.mainLabel")}>
            <a className="nav-active" href="#menu">
              {t("store.nav.menu")}
            </a>

            <a href="#reviews">{t("store.nav.leaveReview")}</a>
            <Link href="/admin">{t("common.admin")}</Link>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <button className="track-button" onClick={() => setDialog("track")}>
              <Icon name="receipt" size={17} />
              <span>{t("store.nav.track")}</span>
            </button>
            <button
              className="cart-button"
              onClick={() => setDialog("cart")}
              aria-label={t("store.nav.cartLabel", { count: cartCount })}
            >
              <Icon name="bag" size={18} />
              <span>{t("store.nav.myOrder")}</span>
              <span className="cart-count">{cartCount}</span>
            </button>
            <button
              className="mobile-menu-button icon-button"
              aria-expanded={mobileMenu}
              aria-label={t("store.nav.toggle")}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Icon name={mobileMenu ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {mobileMenu && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label={t("store.nav.mobileLabel")}>
            <a href="#menu" onClick={() => setMobileMenu(false)}>
              {t("store.nav.menu")}
            </a>

            <a href="#reviews" onClick={() => setMobileMenu(false)}>
              {t("store.nav.reviews")}
            </a>
            <Link href="/admin" onClick={() => setMobileMenu(false)}>
              {t("common.admin")}
            </Link>
            <button
              onClick={() => {
                setMobileMenu(false);
                setDialog("track");
              }}
            >
              {t("store.nav.track")}
            </button>
            <div
              className="mobile-nav-preferences"
              role="group"
              aria-label={t("store.nav.preferences")}
            >
              <ThemeToggle />
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> {t("store.hero.eyebrow")}
            </div>
            <h1 id="hero-title">
              {t("store.hero.title1")}
              <br />
              {t("store.hero.title2")} <em>{t("store.hero.title3")}</em>
            </h1>
            <p>
              {t("store.hero.line1")}
              <br className="desktop-break" /> {t("store.hero.line2")}
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#menu">
                {t("store.hero.cta")} <Icon name="arrow-right" size={18} />
              </a>
              <span className="pickup-note"><Icon name="clock" size={17} /> {t("store.hero.pickup")}</span>
            </div>
            {reviews.length > 0 ? (
              <div className="hero-social-proof">
                <span className="hero-rating">{average.toFixed(1)}</span>
                <div>
                  <Stars rating={average} />
                  <p>
                    <span>
                      {t("store.hero.reviewCount", { count: reviews.length })}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="hero-community">
                <Icon name="heart" size={17} />
                <span>{t("store.hero.community")}</span>
              </div>
            )}
          </div>
          <div className="hero-visual">
            <Image
              src="/images/herojpg.jpg"
              alt={t("store.hero.alt")}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
              className="hero-photo"
            />
            <div className="hero-photo-shade" />
            <span className="hero-code"><span /> {t("store.hero.code")}</span>
            <div className="hero-image-caption">
              <span>{t("store.hero.caption")}</span>
              <strong>{t("store.hero.captionTitle")}</strong>
              <a href="#menu" className="hero-caption-arrow" aria-label={t("store.hero.explore")}>
                <Icon name="arrow-up-right" size={22} />
              </a>
            </div>
          </div>
        </section>

        <section
          id="menu"
          className="menu-section container"
          aria-labelledby="menu-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">{t("store.menu.eyebrow")}</div>
              <h2 id="menu-title">
                {t("store.menu.title1")} <em>{t("store.menu.title2")}</em>
              </h2>
              <p>{t("store.menu.subtitle")}</p>
            </div>
            <span className="menu-heading-note"><Icon name="coffee" size={22} /> {t("store.menu.note")}</span>
          </div>
          {products.length > 0 && (
            <div className="menu-toolbar">
              <div
                className="category-tabs"
                role="group"
                aria-label={t("store.menu.filterLabel")}
              >
                {categories.map((item) => (
                  <button
                    className={category === item.name ? "category-active" : ""}
                    key={item.name}
                    onClick={() => setCategory(item.name)}
                    aria-pressed={category === item.name}
                  >
                    <Icon name={item.icon} size={17} />
                    {item.name === "All favorites"
                      ? t("store.menu.all")
                      : t(`category.${item.name}`)}
                  </button>
                ))}
              </div>
              <div className="menu-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  placeholder={t("store.menu.searchPlaceholder")}
                  aria-label={t("store.menu.searchLabel")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          {products.length > 0 && (
            <div className="menu-results" aria-live="polite">
              <span>{t("store.menu.results", { count: filtered.length })}</span>
            </div>
          )}
          {!products.length ? (
            <div className="catalog-empty">
              <span className="catalog-empty-icon">
                <Icon name="coffee" size={34} />
              </span>
              <span className="eyebrow">
                {t("store.menu.emptyEyebrow")}
              </span>
              <h3>{t("store.menu.emptyTitle")}</h3>
              <p>{t("store.menu.emptyText")}</p>
            </div>
          ) : filtered.length ? (
            <div className="product-grid">
              {filtered.map((product) => {
                const inCart =
                  cart.find((item) => item.productId === product.id)
                    ?.quantity ?? 0;
                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-image">
                      <Link href={`/menu/${product.id}`} className="product-image-link" aria-label={product.name} />
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 480px) 90vw, (max-width: 900px) 45vw, 25vw"
                        style={{ objectPosition: "center" }}
                      />
                      {product.badge && (
                        <span
                          className={`product-badge ${product.category === "Meal" ? "badge-green" : ""}`}
                        >
                          {product.badge === "Bestseller" && (
                            <Icon name="star" size={11} />
                          )}
                          {product.badge}
                        </span>
                      )}
                      {!product.available && (
                        <span className="unavailable-overlay">
                          {t("store.menu.backSoon")}
                        </span>
                      )}
                      <span className="product-category">
                        {product.category === "Meal"
                          ? t("store.menu.catMeal")
                          : product.category === "Non-Coffee"
                            ? t("store.menu.catNonCoffee")
                            : t("store.menu.catCoffee")}
                      </span>
                    </div>
                    <div className="product-info">
                      <div className="product-title-row">
                        <h3><Link href={`/menu/${product.id}`}>{product.name}</Link></h3>
                        <span>{money(product.price)}</span>
                      </div>
                      <p>{product.description}</p>
                      <button
                        className={`add-to-cart ${inCart ? "has-in-cart" : ""}`}
                        disabled={!product.available}
                        onClick={() => addItem(product.id, product.name)}
                        aria-label={t("store.menu.addedLabel", {
                          name: product.name,
                        })}
                      >
                        <span>
                          {!product.available
                            ? t("store.menu.backSoon")
                            : inCart
                              ? t("store.menu.inBag", { count: inCart })
                              : t("store.menu.add")}
                        </span>
                        <Icon name="plus" size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="no-results">
              <Icon name="search" size={30} />
              <h3>{t("store.menu.noResultsTitle")}</h3>
              <p>{t("store.menu.noResultsText")}</p>
              <button
                className="button button-primary"
                onClick={() => {
                  setSearch("");
                  setCategory("All favorites");
                }}
              >
                {t("store.menu.showAll")}
              </button>
            </div>
          )}
          <div className="menu-footnote">
            <Icon name="leaf" size={15} />
            <p>{t("store.menu.footnote")}</p>
          </div>
        </section>

        <section className="ritual-banner container">
          <div className="ritual-illustration">
            <Icon name="coffee" size={48} />
            <span className="illustration-spark">✧</span>
          </div>
          <div>
            <span className="eyebrow">
              {t("store.ritual.eyebrow")}
            </span>
            <h2>
              {t("store.ritual.title1")} <em>{t("store.ritual.title2")}</em>
            </h2>
          </div>
          <button
            className="button button-cream"
            onClick={() => setDialog("track")}
          >
            {t("store.ritual.track")} <Icon name="arrow-right" size={18} />
          </button>
        </section>

        <section id="reviews" className="reviews-section" aria-labelledby="reviews-title">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">{t("store.reviews.eyebrow")}</div>
                <h2 id="reviews-title">
                  {t("store.reviews.title1")} <em>{t("store.reviews.title2")}</em>
                </h2>
                <p>{t("store.reviews.subtitle")}</p>
                <div className="review-summary">
                  {reviews.length ? (
                    <>
                      <Stars rating={average} />
                      <strong>{average.toFixed(1)}</strong>
                      <span>{t("store.reviews.summary")}</span>
                    </>
                  ) : (
                    <span>{t("store.reviews.none")}</span>
                  )}
                </div>
              </div>
              <button
                className="button button-outline"
                onClick={() => setDialog("review")}
              >
                {t("store.reviews.leave")} <Icon name="arrow-up-right" size={17} />
              </button>
            </div>
            {!reviews.length && (
              <div className="reviews-empty">
                <Icon name="heart" size={27} />
                <div>
                  <h3>{t("store.reviews.emptyTitle")}</h3>
                  <p>{t("store.reviews.emptyText")}</p>
                </div>
              </div>
            )}
            <div className="review-grid">
              {(showAllReviews ? reviews : reviews.slice(0, 3)).map(
                (review, index) => (
                  <article className="review-card" key={review.id}>
                    <Stars rating={review.rating} />
                    <blockquote>“{review.comment}”</blockquote>
                    <div className="review-author">
                      <span className={`review-avatar avatar-${index % 3}`}>
                        {review.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{review.name}</strong>
                        <span>{t("store.reviews.role")}</span>
                      </div>
                      <Icon name="check" size={15} />
                    </div>
                  </article>
                ),
              )}
            </div>
            {reviews.length > 3 && (
              <button
                className="more-reviews"
                onClick={() => setShowAllReviews(!showAllReviews)}
              >
                {showAllReviews
                  ? t("store.reviews.fewer")
                  : t("store.reviews.all", { count: reviews.length })}
                <Icon name="chevron-down" size={15} />
              </button>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <Brand light />
              <p>
                {t("store.footer.blurb1")}
                <br />
                {t("store.footer.blurb2")}
              </p>
            </div>
            <div className="footer-links">
              <strong>
                <a href="#menu">{t("store.footer.menu")}</a>
              </strong>
              <strong>
                <a href="#reviews">{t("store.footer.reviews")}</a>
              </strong>
              <strong>
                <Link href="/admin">{t("common.admin")}</Link>
              </strong>
            </div>
            <div className="footer-links">
              <strong>
                <button onClick={() => setDialog("track")}>
                  {t("store.footer.track")}
                </button>
              </strong>

              <strong>
                <button onClick={() => setDialog("review")}>
                  {t("store.footer.leaveReview")}
                </button>
              </strong>
            </div>
            <div className="footer-last">
              <Icon name="sun" size={28} />
              <strong>{t("store.footer.last")}</strong>
              <p>
                {t("store.footer.last1")}
                <br />
                {t("store.footer.last2")}
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t("store.footer.copy")}</span>
            <span>{t("store.footer.motto")}</span>
            <span>{t("store.footer.languages")}</span>
          </div>
        </div>
      </footer>
      <div className={`toast ${toast ? "toast-visible" : ""}`} role="status">
        <span>
          <Icon name="check" size={17} />
        </span>
        {toast}
        <button
          onClick={() => {
            setToast("");
            setDialog("cart");
          }}
        >
          {t("store.toast.view")} <Icon name="arrow-right" size={14} />
        </button>
      </div>
      {cartCount > 0 && (
        <button className="mobile-cart-bar" onClick={() => setDialog("cart")}>
          <span>
            <Icon name="bag" size={19} /> {t("store.cartBar")} <span>{cartCount}</span>
          </span>
          <strong>
            {money(cartTotal)} <Icon name="arrow-right" size={17} />
          </strong>
        </button>
      )}
      {dialog === "cart" && (
        <CartDrawer
          onClose={closeDialog}
          onTrack={(id) => {
            setOrderId(id);
            setDialog("track");
          }}
        />
      )}
      {dialog === "track" && (
        <OrderTracker
          key={orderId ?? "lookup"}
          orderId={orderId}
          onClose={closeDialog}
          paymentReturn={paymentReturn}
          paymentReturnError={paymentReturnError}
          verifyingPayment={verifyingPayment}
        />
      )}
      {dialog === "review" && <ReviewDialog onClose={closeDialog} />}
    </div>
  );
}
