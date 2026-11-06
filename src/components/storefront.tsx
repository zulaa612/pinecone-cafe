"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCafe } from "./cafe-provider";
import { Icon } from "./icon";
import { CartDrawer, OrderTracker, ReviewDialog } from "./order-dialogs";
import { money, type Category } from "@/lib/cafe";

const categories: { name: "All favorites" | Category; icon: string }[] = [
  { name: "All favorites", icon: "grid" }, { name: "Coffee", icon: "coffee" },
  { name: "Non-Coffee", icon: "leaf" }, { name: "Food & Pastries", icon: "croissant" },
];

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Pine and Pour home"><span className="brand-mark"><svg width="34" height="40" viewBox="0 0 34 40" fill="none" aria-hidden="true"><path d="M17 3v34M17 5 9 13h6L5 23h9L2 33h30L20 23h9L19 13h6L17 5Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round"/><path d="m11 18 6 6 6-6M8 28l9 6 9-6" stroke="currentColor" strokeWidth="1.2"/></svg></span><span className="brand-name">pine <span>&</span> pour<small>COFFEE & LITTLE MOMENTS</small></span></Link>;
}

export function Stars({ rating = 5 }: { rating?: number }) {
  return <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(n => <Icon name="star" size={14} key={n} className={n <= Math.round(rating) ? "star-filled" : ""} />)}</span>;
}

export default function Storefront() {
  const { products, reviews, cart, cartCount, cartTotal, addToCart } = useCafe();
  const [category, setCategory] = useState("All favorites");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"cart" | "track" | "review" | null>(null);
  const [orderId, setOrderId] = useState<string>();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const filtered = products.filter(p => (category === "All favorites" || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()));
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  function addItem(id: string, name: string) {
    addToCart(id);
    setToast(`${name} added to your bag`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }
  const closeDialog = () => setDialog(null);

  return <>
    <a className="skip-link" href="#menu">Skip to the menu</a>
    <div className="announcement"><span>A little coffee. A little comfort. A whole lot of good.</span><nav className="section-switcher" aria-label="Choose section"><Link href="/" aria-current="page"><Icon name="user" size={12} />Customer</Link><Link href="/admin"><Icon name="shield" size={12} />Admin <Icon name="arrow-up-right" size={10} /></Link></nav></div>
    <header className="site-header">
      <div className="container header-inner"><Brand /><nav className="desktop-nav" aria-label="Main navigation"><a className="nav-active" href="#menu">Our menu</a><a href="#story">Our story</a><a href="#reviews">Kind words</a></nav><div className="header-actions"><button className="track-button" onClick={() => setDialog("track")}><Icon name="receipt" size={17} /><span>Track order</span></button><button className="cart-button" onClick={() => setDialog("cart")} aria-label={`Open bag, ${cartCount} items`}><Icon name="bag" size={18} /><span>My bag</span><span className="cart-count">{cartCount}</span></button><button className="mobile-menu-button icon-button" aria-expanded={mobileMenu} aria-label="Toggle navigation" onClick={() => setMobileMenu(!mobileMenu)}><Icon name={mobileMenu ? "close" : "menu"} /></button></div></div>
      {mobileMenu && <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#menu" onClick={() => setMobileMenu(false)}>Our menu</a><a href="#story" onClick={() => setMobileMenu(false)}>Our story</a><a href="#reviews" onClick={() => setMobileMenu(false)}>Kind words</a><button onClick={() => { setMobileMenu(false); setDialog("track"); }}>Track an order</button></nav>}
    </header>

    <main>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> YOUR DAILY DOSE OF SOMETHING GOOD</div><h1 id="hero-title">Good days start<br />with <em>great coffee.</em></h1><p>Thoughtfully brewed. Freshly baked. Made for you.<br className="desktop-break" /> A little pause in your day, a little joy in every cup.</p><div className="hero-actions"><a className="button button-primary" href="#menu">Find your favorite <Icon name="arrow-right" size={18} /></a><span className="pickup-note"><Icon name="clock" size={17} /> Ready in 15–20 min</span></div>{reviews.length > 0 ? <div className="hero-social-proof"><div className="avatar-stack" aria-hidden="true"><span>AM</span><span>JL</span><span>SK</span><span>OT</span></div><div><Stars rating={average} /><p><strong>Loved by our community</strong><span>Good coffee. Even better company.</span></p></div></div> : <div className="hero-community"><Icon name="heart" size={17} /><span>Good coffee. Even better company.</span></div>}</div>
        <div className="hero-visual"><Image src="/images/hero.jpg" alt="Freshly brewed coffee and a golden croissant on a warm café table" fill priority sizes="(max-width: 700px) 100vw, 53vw" className="hero-photo" /><div className="hero-photo-shade" /><div className="hero-stamp"><span>SMALL BATCH</span><Icon name="coffee" size={32} /><span>BIG LITTLE JOYS</span></div><div className="hero-image-caption"><span>THE PERFECT PAIRING</span><strong>A slow morning, served fresh.</strong><span className="hero-caption-arrow"><Icon name="arrow-up-right" size={23} /></span></div></div>
      </section>

      <div className="values-strip container"><div><Icon name="leaf" size={20} /><span>Ethically sourced beans</span></div><span className="value-dot" /><div><Icon name="croissant" size={23} /><span>Baked fresh, every day</span></div><span className="value-dot" /><div><Icon name="heart" size={20} /><span>Made with a little extra love</span></div><span className="value-dot" /><div><Icon name="bag" size={20} /><span>Pickup & delivery</span></div></div>

      <section id="menu" className="menu-section container" aria-labelledby="menu-title">
        <div className="section-heading"><div><div className="eyebrow">A LITTLE SOMETHING FOR EVERY CRAVING</div><h2 id="menu-title">Your next <em>favorite.</em></h2><p>Familiar comforts. New little discoveries. All made with care.</p></div>{products.length > 0 && <span className="fresh-note"><span /> Freshly made. Always.</span>}</div>
        {products.length > 0 && <div className="menu-toolbar"><div className="category-tabs" role="group" aria-label="Filter menu by category">{categories.map(item => <button className={category === item.name ? "category-active" : ""} key={item.name} onClick={() => setCategory(item.name)} aria-pressed={category === item.name}><Icon name={item.icon} size={17} />{item.name}</button>)}</div><div className="menu-search"><Icon name="search" size={18} /><input type="search" placeholder="Find your craving…" aria-label="Search menu" value={search} onChange={e => setSearch(e.target.value)} /></div></div>}
        {products.length > 0 && <div className="menu-results" aria-live="polite"><span>{filtered.length} good things to choose from</span><span>Made to order, just for you</span></div>}
        {!products.length ? <div className="catalog-empty"><span className="catalog-empty-icon"><Icon name="coffee" size={34} /></span><span className="eyebrow">GOOD THINGS TAKE A LITTLE TIME</span><h3>Something lovely is brewing.</h3><p>Our menu is coming soon. Check back for freshly brewed coffee,<br className="desktop-break" /> delicious little bites, and your next everyday favorite.</p><a href="#story" className="button button-outline">Get to know us <Icon name="arrow-right" size={17} /></a></div> : filtered.length ? <div className="product-grid">{filtered.map(product => {
          const inCart = cart.find(item => item.productId === product.id)?.quantity ?? 0;
          return <article className="product-card" key={product.id}><div className="product-image"><Image src={product.image} alt={product.name} fill sizes="(max-width: 480px) 90vw, (max-width: 900px) 45vw, 25vw" style={{ objectPosition: "center" }} />{product.badge && <span className={`product-badge ${product.category === "Food & Pastries" ? "badge-green" : ""}`}>{product.badge === "Bestseller" && <Icon name="star" size={11} />}{product.badge}</span>}{!product.available && <span className="unavailable-overlay">Back soon</span>}<span className="product-category">{product.category === "Food & Pastries" ? "FRESH FROM THE OVEN" : product.category === "Non-Coffee" ? "SOMETHING DIFFERENT" : "THE COFFEE COLLECTION"}</span></div><div className="product-info"><div className="product-title-row"><h3>{product.name}</h3><span>{money(product.price)}</span></div><p>{product.description}</p><button className={`add-to-cart ${inCart ? "has-in-cart" : ""}`} disabled={!product.available} onClick={() => addItem(product.id, product.name)} aria-label={`Add ${product.name} to bag`}><span>{!product.available ? "Back soon" : inCart ? `Add another · ${inCart} in bag` : "Add to bag"}</span><Icon name="plus" size={17} /></button></div></article>;
        })}</div> : <div className="no-results"><Icon name="search" size={30} /><h3>No favorites found. Yet.</h3><p>Try another search or explore the whole menu.</p><button className="button button-primary" onClick={() => { setSearch(""); setCategory("All favorites"); }}>See all favorites</button></div>}
        <div className="menu-footnote"><Icon name="leaf" size={15} /><p>Good things, thoughtfully made. Ask us about oat milk and other little extras when you collect.</p></div>
      </section>

      <section className="ritual-banner container"><div className="ritual-illustration"><Icon name="coffee" size={48} /><span className="illustration-spark">✧</span></div><div><span className="eyebrow">LESS WAITING. MORE SIPPING.</span><h2>Your coffee break, <em>on your terms.</em></h2><p>Order ahead. Skip the queue. Get straight to the good part.</p></div><button className="button button-cream" onClick={() => setDialog("track")}>Track your order <Icon name="arrow-right" size={18} /></button></section>

      <section id="story" className="story-section container"><div className="story-image"><Image src="/images/story.jpg" alt="The warm wood interior and welcoming counter of a neighborhood café" fill sizes="(max-width: 700px) 100vw, 45vw" /><span className="story-image-label">A little place. A lot of heart.</span></div><div className="story-copy"><div className="eyebrow">MORE THAN WHAT’S IN YOUR CUP</div><h2>A neighborhood heart.<br /><em>A coffee lover’s soul.</em></h2><p>We believe the best things in life are the little ones. The smell of freshly ground beans. A still-warm pastry. A familiar face who knows your order.</p><p>Pine & Pour is our love letter to those moments. Thoughtful ingredients, honest craft, and a welcoming corner to make your own.</p><div className="story-signature">With love, <span>Pine & Pour</span><Icon name="heart" size={20} /></div></div></section>

      <section id="reviews" className="reviews-section"><div className="container"><div className="section-heading"><div><div className="eyebrow">GOOD COFFEE BRINGS GOOD PEOPLE TOGETHER</div><h2>Kind words. <em>Full hearts.</em></h2><div className="review-summary">{reviews.length ? <><Stars rating={average} /><strong>{average.toFixed(1)}</strong><span>from our lovely community</span></> : <span>Every good story starts with a little hello.</span>}</div></div><button className="button button-outline" onClick={() => setDialog("review")}>Leave a little love <Icon name="arrow-up-right" size={17} /></button></div>{!reviews.length && <div className="reviews-empty"><Icon name="heart" size={27} /><div><h3>Your kind words belong here.</h3><p>Be the first to share your Pine & Pour moment.</p></div></div>}<div className="review-grid">{(showAllReviews ? reviews : reviews.slice(0, 3)).map((review, index) => <article className="review-card" key={review.id}><Stars rating={review.rating} /><blockquote>“{review.comment}”</blockquote><div className="review-author"><span className={`review-avatar avatar-${index % 3}`}>{review.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><div><strong>{review.name}</strong><span>Coffee lover & lovely human</span></div><Icon name="check" size={15} /></div></article>)}</div>{reviews.length > 3 && <button className="more-reviews" onClick={() => setShowAllReviews(!showAllReviews)}>{showAllReviews ? "Show fewer reviews" : `Read all ${reviews.length} reviews`}<Icon name="chevron-down" size={15} /></button>}</div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-top"><div><Brand light /><p>Good coffee. Fresh food.<br />Little moments worth slowing down for.</p></div><div className="footer-links"><strong>Make yourself at home</strong><a href="#menu">Our menu</a><a href="#story">Our story</a><a href="#reviews">Kind words</a></div><div className="footer-links"><strong>A little help</strong><button onClick={() => setDialog("track")}>Track your order</button><button onClick={() => setDialog("review")}>Share your experience</button><Link href="/admin">Admin section <Icon name="arrow-up-right" size={12} /></Link></div><div className="footer-last"><Icon name="sun" size={28} /><strong>A good day is brewing.</strong><p>Come for the coffee.<br />Stay for the little moments.</p><a className="footer-menu-link" href="#menu">Find your favorite <Icon name="arrow-right" size={16} /></a></div></div><div className="footer-bottom"><span>© 2026 Pine & Pour. Made with care.</span><span>Small batch. Big heart. Always.</span></div></div></footer>
    <div className={`toast ${toast ? "toast-visible" : ""}`} role="status"><span><Icon name="check" size={17} /></span>{toast}<button onClick={() => { setToast(""); setDialog("cart"); }}>View bag <Icon name="arrow-right" size={14} /></button></div>
    {cartCount > 0 && <button className="mobile-cart-bar" onClick={() => setDialog("cart")}><span><Icon name="bag" size={19} /> View your bag <span>{cartCount}</span></span><strong>{money(cartTotal)} <Icon name="arrow-right" size={17} /></strong></button>}
    {dialog === "cart" && <CartDrawer onClose={closeDialog} onTrack={id => { setOrderId(id); setDialog("track"); }} />}
    {dialog === "track" && <OrderTracker orderId={orderId} onClose={closeDialog} />}
    {dialog === "review" && <ReviewDialog onClose={closeDialog} />}
  </>;
}
