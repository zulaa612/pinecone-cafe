"use client";

import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { Coffee } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCafe } from "./cafe-provider";
import { Icon } from "./icon";
import { CartDrawer, OrderTracker, ReviewDialog } from "./order-dialogs";
import { money, type Category } from "@/lib/cafe";

const categories: { name: "All favorites" | Category; icon: string }[] = [
  { name: "All favorites", icon: "grid" },
  { name: "Coffee", icon: "coffee" },
  { name: "Non-Coffee", icon: "leaf" },
  { name: "Meal", icon: "croissant" },
];

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Pinecone cafe — home"
    >
      <span className="brand-symbol" aria-hidden="true">
        <Coffee size={24} strokeWidth={1.5} />
      </span>
      <span className="brand-wordmark">
        <span className="brand-name">Pinecone cafe</span>
        <span className="brand-tagline">COFFEE & GOOD COMPANY</span>
      </span>
    </Link>
  );
}

export function Stars({ rating = 5 }: { rating?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
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
  const { user, products, reviews, cart, cartCount, cartTotal, addToCart } =
    useCafe();
  const [category, setCategory] = useState("All favorites");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"cart" | "track" | "review" | null>(
    null,
  );
  const [orderId, setOrderId] = useState<string>();
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
    setToast(`${name} сагсанд нэмэгдлээ.`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }
  const closeDialog = () => setDialog(null);

  return (
    <div className="storefront">
      <a className="skip-link" href="#menu">
        Меню үзэх
      </a>
      <div className="announcement">
        <span className="code">
          Код гацвал кофе уу. <Coffee />
        </span>
        <nav className="section-switcher" aria-label="Choose section">
          <Link href="/" aria-current="page">
            <Icon name="user" size={20} />
            Үйлчлүүлэгч
          </Link>
          <Link href="/admin">
            <Icon name="shield" size={20} />
            Админ
          </Link>
        </nav>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            <a className="nav-active" href="#menu">
              Меню
            </a>

            <a href="#reviews">Сэтгэгдэл үлдээх</a>
          </nav>
          <div className="header-actions">
            <div className="user-chip">
              {user ? (
                <>
                  <span className="user-name">{user.name}</span>
                  {user.role === "admin" && <Link href="/admin">Admin</Link>}
                  <form action={logout}><button type="submit">Sign out</button></form>
                </>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </div>
            <button className="track-button" onClick={() => setDialog("track")}>
              <Icon name="receipt" size={17} />
              <span>Захиалга хянах</span>
            </button>
            <button
              className="cart-button"
              onClick={() => setDialog("cart")}
              aria-label={`Таны захиалга: ${cartCount}`}
            >
              <Icon name="bag" size={18} />
              <span>Миний захиалга</span>
              <span className="cart-count">{cartCount}</span>
            </button>
            <button
              className="mobile-menu-button icon-button"
              aria-expanded={mobileMenu}
              aria-label="Toggle navigation"
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Icon name={mobileMenu ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {mobileMenu && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
            <a href="#menu" onClick={() => setMobileMenu(false)}>
              Меню
            </a>

            <a href="#reviews" onClick={() => setMobileMenu(false)}>
              Сэтгэгдэл
            </a>
            <button
              onClick={() => {
                setMobileMenu(false);
                setDialog("track");
              }}
            >
              Захиалга хянах
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> A LITTLE COFFEE. A LITTLE MAGIC.
            </div>
            <h1 id="hero-title">
              Build success,
              <br />
              have <em>some rest.</em>
            </h1>
            <p>
              When your brain hits 404 Not Found,
              <br className="desktop-break" /> grab a sweet treat and restart.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#menu">
                Өнөөдөр юу уух уу? <Icon name="arrow-right" size={18} />
              </a>
              <span className="pickup-note"><Icon name="clock" size={17} /> 5–10 минутын дотор бэлэн</span>
            </div>
            {reviews.length > 0 ? (
              <div className="hero-social-proof">
                <span className="hero-rating">{average.toFixed(1)}</span>
                <div>
                  <Stars rating={average} />
                  <p>
                    <span>{reviews.length} сэтгэгдэл · Made better by you.</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="hero-community">
                <Icon name="heart" size={17} />
                <span>Good coffee. Fresh ideas. Your kind of break.</span>
              </div>
            )}
          </div>
          <div className="hero-visual">
            <Image
              src="/images/herojpg.jpg"
              alt="A freshly poured latte with leaf-shaped coffee art on a wooden café table"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
              className="hero-photo"
            />
            <div className="hero-photo-shade" />
            <span className="hero-code"><span /> npm install magic</span>
            <div className="hero-image-caption">
              <span>YOUR DAILY MOMENT OF JOY</span>
              <strong>A good day is brewing.</strong>
              <a href="#menu" className="hero-caption-arrow" aria-label="Explore the menu">
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
              <div className="eyebrow">THE GOOD STUFF</div>
              <h2 id="menu-title">
                Өнөөдөр <em>юу уух уу?</em>
              </h2>
              <p>Дуртай кофегоо сонгоод, өөртөө бяцхан завсарлага бэлэглээрэй.</p>
            </div>
            <span className="menu-heading-note"><Icon name="coffee" size={22} /> Brewed for your next big idea.</span>
          </div>
          {products.length > 0 && (
            <div className="menu-toolbar">
              <div
                className="category-tabs"
                role="group"
                aria-label="Filter menu by category"
              >
                {categories.map((item) => (
                  <button
                    className={category === item.name ? "category-active" : ""}
                    key={item.name}
                    onClick={() => setCategory(item.name)}
                    aria-pressed={category === item.name}
                  >
                    <Icon name={item.icon} size={17} />
                    {item.name}
                  </button>
                ))}
              </div>
              <div className="menu-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  placeholder="Бичээд хайх уу?..."
                  aria-label="Search menu"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          {products.length > 0 && (
            <div className="menu-results" aria-live="polite">
              <span>{filtered.length} бүтээгдэхүүн</span>
            </div>
          )}
          {!products.length ? (
            <div className="catalog-empty">
              <span className="catalog-empty-icon">
                <Icon name="coffee" size={34} />
              </span>
              <span className="eyebrow">
                ӨНӨӨДӨР ТА ХӨӨРХӨН ХАРАГДАЖ БАЙНА.
              </span>
              <h3>Something lovely is brewing.</h3>
              <p>Меню шинэчлэгдэж байгаа тул та түр хүлээнэ үү.</p>
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
                        <span className="unavailable-overlay">Back soon</span>
                      )}
                      <span className="product-category">
                        {product.category === "Meal"
                          ? "FRESH FROM THE OVEN"
                          : product.category === "Non-Coffee"
                            ? "SOMETHING DIFFERENT"
                            : "THE COFFEE COLLECTION"}
                      </span>
                    </div>
                    <div className="product-info">
                      <div className="product-title-row">
                        <h3>{product.name}</h3>
                        <span>{money(product.price)}</span>
                      </div>
                      <p>{product.description}</p>
                      <button
                        className={`add-to-cart ${inCart ? "has-in-cart" : ""}`}
                        disabled={!product.available}
                        onClick={() => addItem(product.id, product.name)}
                        aria-label={`${product.name} сагсанд орлоо.`}
                      >
                        <span>
                          {!product.available
                            ? "Back soon"
                            : inCart
                              ? `Таны захиалгын тоо · ${inCart}`
                              : "Сагсанд нэмэх"}
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
              <h3>Одоогоор шинэ зүйл алга.</h3>
              <p>Өөр цэсрүү зочлоод үзээрэй.</p>
              <button
                className="button button-primary"
                onClick={() => {
                  setSearch("");
                  setCategory("All favorites");
                }}
              >
                Бүх бүтээгдэхүүн харах
              </button>
            </div>
          )}
          <div className="menu-footnote">
            <Icon name="leaf" size={15} />
            <p>
              Та сэтгэгдэл хэсэгт өөрийн санал хүсэлт болон хэн нэгэнд сайхан үг
              үлдээгээрэй.
            </p>
          </div>
        </section>

        <section className="ritual-banner container">
          <div className="ritual-illustration">
            <Icon name="coffee" size={48} />
            <span className="illustration-spark">✧</span>
          </div>
          <div>
            <span className="eyebrow">
              Захиалгаа хүлээж байна уу? Удахгүй бэлэн болноо.
            </span>
            <h2>
              Trust <em>the process.</em>
            </h2>
          </div>
          <button
            className="button button-cream"
            onClick={() => setDialog("track")}
          >
            Захиалга хянах <Icon name="arrow-right" size={18} />
          </button>
        </section>

        <section id="reviews" className="reviews-section" aria-labelledby="reviews-title">
          <div className="container">
            <div className="section-heading">
              <div>
                <div className="eyebrow">A LITTLE LOVE FROM OUR COMMUNITY</div>
                <h2 id="reviews-title">
                  Таны үгс, <em>бидний урам.</em>
                </h2>
                <p>Санал хүсэлтээ хуваалцаад, хэн нэгэнд сайхан үг үлдээгээрэй.</p>
                <div className="review-summary">
                  {reviews.length ? (
                    <>
                      <Stars rating={average} />
                      <strong>{average.toFixed(1)}</strong>
                      <span>from our lovely community</span>
                    </>
                  ) : (
                    <span>Every good story starts with a little hello.</span>
                  )}
                </div>
              </div>
              <button
                className="button button-outline"
                onClick={() => setDialog("review")}
              >
                Leave a little love <Icon name="arrow-up-right" size={17} />
              </button>
            </div>
            {!reviews.length && (
              <div className="reviews-empty">
                <Icon name="heart" size={27} />
                <div>
                  <h3>Your kind words belong here.</h3>
                  <p>Be the first to share your Pinecone cafe moment.</p>
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
                        <span>Coffee lover & lovely human</span>
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
                  ? "Show fewer reviews"
                  : `Read all ${reviews.length} reviews`}
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
                Good coffee. Fresh food.
                <br />
                Little moments worth slowing down for.
              </p>
            </div>
            <div className="footer-links">
              <strong>
                <a href="#menu">МЕНЮ</a>
              </strong>
              <strong>
                <a href="#reviews">СЭТГЭГДЭЛ</a>
              </strong>
            </div>
            <div className="footer-links">
              <strong>
                <button onClick={() => setDialog("track")}>
                  ЗАХИАЛГАА ХЯНАХ
                </button>
              </strong>

              <strong>
                <button onClick={() => setDialog("review")}>
                  СЭТГЭГДЭЛ ҮЛДЭЭХ
                </button>
              </strong>
            </div>
            <div className="footer-last">
              <Icon name="sun" size={28} />
              <strong>A good day is brewing.</strong>
              <p>
                Come for the coffee.
                <br />
                Stay for the little moments.
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Pinecone cafe. Made with care.</span>
            <span>Small batch. Big heart. Always.</span>
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
          Сагсанд юу юу оров? <Icon name="arrow-right" size={14} />
        </button>
      </div>
      {cartCount > 0 && (
        <button className="mobile-cart-bar" onClick={() => setDialog("cart")}>
          <span>
            <Icon name="bag" size={19} /> Сагс шалгах <span>{cartCount}</span>
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
        <OrderTracker orderId={orderId} onClose={closeDialog} />
      )}
      {dialog === "review" && <ReviewDialog onClose={closeDialog} />}
    </div>
  );
}
