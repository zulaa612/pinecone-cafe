"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icon";
import { PageShell } from "@/components/page-shell";
import { Stars } from "@/components/storefront";
import { money } from "@/lib/cafe";
import { computePricing } from "@/lib/pricing";
import { toCents } from "@/lib/cafe";

const countKey = (count: number, one: "cust.reviews.count_one" | "cust.review.stars_one") =>
  (count === 1 ? one : one.replace("_one", "_other")) as "cust.reviews.count_other" | "cust.review.stars_other";

export function ProductDetail({ id }: { id: string }) {
  const { user, products, reviews, status, refresh, addToCart, addReview } = useCafe();
  const { t, locale } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const product = products.find(p => p.id === id);
  const productReviews = reviews.filter(r => r.productId === id);

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const result = await addReview({ productId: id, rating, comment: comment.trim() });
    setSaving(false);
    if (result.ok) {
      setComment("");
      setFeedback({ ok: true, text: t("cust.review.thanks") });
    } else {
      setFeedback({ ok: false, text: result.error });
    }
  }

  if (!product) {
    return (
      <PageShell>
        <Link href="/#menu" className="page-back">← {t("cust.back")}</Link>
        {status === "loading" ? (
          <p className="page-note" role="status">{t("cust.loading")}</p>
        ) : status === "error" ? (
          <div className="page-card">
            <p role="alert">{t("cust.error")}</p>
            <button className="page-button" onClick={() => void refresh()}>{t("common.retry")}</button>
          </div>
        ) : (
          <div className="page-card">
            <h1 className="page-title">{t("cust.notFound.title")}</h1>
            <p className="page-note">{t("cust.notFound.text")}</p>
          </div>
        )}
      </PageShell>
    );
  }

  const teacherPrice = user?.customerType === "teacher" && user.role === "customer"
    ? computePricing(toCents(product.price), "teacher").totalCents / 100
    : null;

  return (
    <PageShell>
      <Link href="/#menu" className="page-back">← {t("cust.back")}</Link>
      <article className="detail">
        <div className="detail-image">
          {/* Product photography comes from admin-provided URLs, so next/image remote config is not used. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} />
        </div>
        <div className="detail-info">
          <span className="detail-category">{t(`category.${product.category}`)}</span>
          <h1>{product.name}</h1>
          <div className="detail-rating" aria-label={product.reviewCount ? t("cust.ratingLabel", { rating: product.rating.toFixed(1) }) : t("cust.noRatings")}>
            <Stars rating={product.rating} />
            <span>
              {product.reviewCount
                ? <><strong>{product.rating.toFixed(1)}</strong> · {t(countKey(product.reviewCount, "cust.reviews.count_one"), { count: product.reviewCount })}</>
                : t("cust.noRatings")}
            </span>
          </div>
          <p className="detail-price">{money(product.price)}</p>
          {teacherPrice !== null && <p className="page-success">{t("cust.teacherPrice", { price: money(teacherPrice) })}</p>}
          <p className="detail-description">{product.description}</p>
          {product.available ? (
            <div className="detail-buy">
              <div className="ord-quantity" role="group" aria-label={t("cust.quantity")}>
                <button type="button" aria-label="−" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Icon name="minus" size={14} /></button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label="+" onClick={() => setQuantity(q => Math.min(99, q + 1))}><Icon name="plus" size={14} /></button>
              </div>
              <button
                className="page-button detail-add"
                onClick={() => { addToCart(product.id, quantity); setAdded(true); setTimeout(() => setAdded(false), 2500); }}
              >
                <Icon name="bag" size={17} /> {t("cust.add")}
              </button>
            </div>
          ) : (
            <p className="ord-unavailable">{t("cust.unavailable")}</p>
          )}
          <p className="page-success" role="status" aria-live="polite">{added ? t("cust.added", { name: product.name }) : ""}</p>
        </div>
      </article>

      <section className="detail-reviews" aria-labelledby="detail-reviews-title">
        <h2 id="detail-reviews-title">{t("cust.reviews.title")}</h2>
        <div className="detail-reviews-grid">
          <div>
            {productReviews.length === 0 ? (
              <p className="page-note">{t("cust.reviews.empty")}</p>
            ) : (
              <ul className="review-list">
                {productReviews.map(review => (
                  <li key={review.id} className="page-card">
                    <Stars rating={review.rating} />
                    <p>“{review.comment}”</p>
                    <small>{review.name} · {new Date(review.date).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="page-card">
            <h3>{t("cust.review.write")}</h3>
            {!user ? (
              <p><Link href="/login">{t("cust.review.signIn")}</Link></p>
            ) : (
              <form onSubmit={submitReview} className="detail-review-form">
                <fieldset className="ord-rating">
                  <legend>{t("cust.review.rating")}</legend>
                  <div onMouseLeave={() => setHovered(0)}>
                    {[1, 2, 3, 4, 5].map(value => (
                      <label key={value} className={(hovered || rating) >= value ? "ord-star-filled" : ""} onMouseEnter={() => setHovered(value)}>
                        <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={t(countKey(value, "cust.review.stars_one"), { count: value })} />
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.64L21 9.55l-4.5 4.39 1.06 6.2L12 17.21l-5.56 2.93 1.06-6.2L3 9.55l6.22-.91L12 3Z" /></svg>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="ord-field">
                  {t("cust.review.comment")}
                  <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={t("cust.review.placeholder")} rows={4} required minLength={5} maxLength={1000} />
                </label>
                <p className="page-note">{t("cust.review.again")}</p>
                {feedback && <p className={feedback.ok ? "page-success" : "auth-error"} role={feedback.ok ? "status" : "alert"}>{feedback.text}</p>}
                <button className="page-button" type="submit" disabled={saving}>{saving ? t("cust.review.saving") : t("cust.review.submit")}</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
