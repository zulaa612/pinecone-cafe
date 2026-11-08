"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import { money } from "@/lib/cafe";

export function CartDrawer({
  onClose,
  onTrack,
}: {
  onClose: () => void;
  onTrack: (id: string) => void;
}) {
  const { user, cart, products, setCartQuantity, pricing, cartCount, placeOrder } =
    useCafe();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [placedId, setPlacedId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState("");
  const items = cart.flatMap((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.productId,
    );
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const unavailable = items.some(({ product }) => !product.available);
  const isTeacher = user?.customerType === "teacher";
  const canOrder = user?.role === "customer";

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || unavailable || placing) return;
    const fields = new FormData(event.currentTarget);
    setPlacing(true);
    setFormError("");
    const result = await placeOrder({
      customerName: String(fields.get("customer") || "").trim(),
      classGrade: String(fields.get("classGrade") || "").trim() || undefined,
      location: String(fields.get("location") || "").trim() || undefined,
    });
    setPlacing(false);
    if (result.ok) {
      setPlacedId(result.id);
      setStep("success");
    } else {
      setFormError(result.error);
    }
  }

  return (
    <Modal
      title={
        step === "checkout"
          ? "A little closer to coffee."
          : step === "success"
            ? "Order received."
            : "Your coffee break"
      }
      onClose={onClose}
      className="ord-drawer"
    >
      {step === "success" ? (
        <div className="ord-success">
          <span className="ord-success-icon">
            <Icon name="check" size={30} />
          </span>
          <span className="ord-eyebrow">GOOD THINGS ARE BREWING</span>
          <h3>Захиалга өгсөнд баярлалаа.</h3>
          <p>
            Таны захиалга <strong>{placedId}</strong> бэлэн болсон.
          </p>
          <div className="ord-demo-note">
            <Icon name="info" size={17} />
            <span>No payment has been taken. Pay when you collect.</span>
          </div>
          <button
            className="ord-button ord-button-primary"
            onClick={() => onTrack(placedId)}
          >
            Захиалга хянах <Icon name="arrow-right" size={18} />
          </button>
          <button className="ord-text-button" onClick={onClose}>
            Меню рүү очих
          </button>
        </div>
      ) : !items.length ? (
        <div className="ord-empty">
          <span className="ord-empty-icon">
            <Icon name="bag" size={32} />
          </span>
          <h3>Таны сагс хоосон байна.</h3>
          <p>Your next favorite is waiting.</p>
          <button className="ord-button ord-button-primary" onClick={onClose}>
            Меню харах <Icon name="arrow-right" size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="ord-cart-intro">
            {step === "checkout" ? (
              <button
                className="ord-text-button"
                onClick={() => setStep("cart")}
              >
                <span aria-hidden="true">←</span> Сагсруу буцах
              </button>
            ) : (
              <p>
                {cartCount} {cartCount === 1 ? "lovely thing" : "lovely things"}{" "}
                for your day.
              </p>
            )}
            <span>
              <Icon name="coffee" size={16} /> Made with care
            </span>
          </div>
          {step === "cart" ? (
            <div className="ord-cart-items">
              {items.map(({ product, quantity }) => (
                <article className="ord-cart-item" key={product.id}>
                  {/* Product photography is served from the menu's image URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="ord-item-image"
                    src={product.image}
                    alt={product.name}
                  />
                  <div className="ord-item-details">
                    <h3>{product.name}</h3>
                    <p>{money(product.price)}</p>
                    {!product.available && (
                      <span className="ord-unavailable">
                        Одоогоор захиалах боломжгүй байна.
                      </span>
                    )}
                    <div className="ord-item-actions">
                      <div
                        className="ord-quantity"
                        aria-label={`Quantity for ${product.name}`}
                      >
                        <button
                          aria-label={`Decrease ${product.name} quantity`}
                          onClick={() =>
                            setCartQuantity(product.id, quantity - 1)
                          }
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <span aria-live="polite">{quantity}</span>
                        <button
                          aria-label={`Increase ${product.name} quantity`}
                          disabled={quantity >= 99 || !product.available}
                          onClick={() =>
                            setCartQuantity(product.id, quantity + 1)
                          }
                        >
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      <button
                        className="ord-remove"
                        aria-label={`Remove ${product.name} from bag`}
                        onClick={() => setCartQuantity(product.id, 0)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                  <strong className="ord-item-total">
                    {money(product.price * quantity)}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <form
              id="ord-checkout-form"
              className="ord-checkout-form"
              onSubmit={submitOrder}
            >
              {!canOrder ? (
                <div className="ord-signin-prompt">
                  <h3>Sign in to place your order</h3>
                  <p>
                    {user
                      ? "Staff accounts can’t place customer orders."
                      : "Student and teacher accounts get the right details and pricing automatically."}
                  </p>
                  {!user && (
                    <p>
                      <Link href="/login">Sign in</Link> · <Link href="/register">Create an account</Link>
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="ord-form-heading">
                    <h3>Таны мэдээлэл</h3>
                    <p>{isTeacher ? "Teacher · 50% discount applied" : "Student"}</p>
                  </div>
                  <label className="ord-field">
                    Full name
                    <input
                      name="customer"
                      autoComplete="name"
                      defaultValue={user.name}
                      maxLength={80}
                      minLength={2}
                      required
                      pattern=".*\S.*"
                    />
                  </label>
                  {isTeacher ? (
                    <label className="ord-field">
                      Current location / delivery spot
                      <input name="location" placeholder="e.g. Room 204, staff room" maxLength={100} required pattern=".*\S.*" />
                    </label>
                  ) : (
                    <label className="ord-field">
                      Class / Grade (Анги)
                      <input name="classGrade" placeholder="e.g. 10A" maxLength={30} required pattern=".*\S.*" />
                    </label>
                  )}
                </>
              )}
              <div className="ord-payment">
                <Icon name="credit-card" size={20} />
                <span>
                  <strong>Pay when you collect</strong>
                  <small>No online payment is required.</small>
                </span>
                <Icon name="check" size={17} />
              </div>
            </form>
          )}
          <div className="ord-cart-bottom">
            <div className="ord-total-row">
              <span>{isTeacher ? "Original price" : "Subtotal"}</span>
              <span>{money(pricing.subtotal)}</span>
            </div>
            {isTeacher && (
              <div className="ord-total-row">
                <span>Teacher discount (50%)</span>
                <span>−{money(pricing.discount)}</span>
              </div>
            )}
            <div className="ord-total-row ord-grand-total">
              <span>{isTeacher ? "Final price" : "Total"}</span>
              <strong>{money(pricing.total)}</strong>
            </div>
            {unavailable && (
              <p className="ord-error" role="alert">
                Please remove unavailable items before checking out.
              </p>
            )}
            {formError && (
              <p className="ord-error" role="alert">
                {formError}
              </p>
            )}
            {step === "cart" ? (
              <button
                className="ord-button ord-button-primary"
                disabled={unavailable}
                onClick={() => setStep("checkout")}
              >
                Continue to checkout <Icon name="arrow-right" size={18} />
              </button>
            ) : (
              <button
                className="ord-button ord-button-primary"
                type="submit"
                form="ord-checkout-form"
                disabled={unavailable || placing || !canOrder}
              >
                {placing
                  ? "Placing your order…"
                  : `Place order · ${money(pricing.total)}`}{" "}
                <Icon name="arrow-right" size={18} />
              </button>
            )}
            <p className="ord-fine-print">
              {step === "checkout"
                ? "No payment is taken online. The total is confirmed by the café."
                : "Freshly made. Thoughtfully packed. Always delicious."}
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

const progress = [
  { status: "pending", label: "Received", icon: "check" },
  { status: "preparing", label: "Preparing", icon: "coffee" },
  { status: "ready", label: "Ready", icon: "bag" },
  { status: "completed", label: "Completed", icon: "heart" },
] as const;

const statusLabel = {
  pending: "Order received",
  preparing: "In preparation",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;

export function OrderTracker({
  orderId,
  onClose,
}: {
  orderId?: string;
  onClose: () => void;
}) {
  const { user, orders } = useCafe();
  const [query, setQuery] = useState(orderId || "");
  const [lookup, setLookup] = useState(orderId || "");
  const order = orders.find(
    (item) => item.id.toLowerCase() === lookup.trim().toLowerCase(),
  );
  const currentStep = progress.findIndex(
    (step) => step.status === order?.status,
  );
  const messages = {
    pending: "You're in! Your order is with our café team.",
    preparing: "A little care, a little craft. We're preparing your order.",
    ready: "Your order is ready. See you at the counter!",
    completed: "All yours. We hope it made your day a little better.",
    cancelled: "This order was cancelled. Please ask the café team if you have questions.",
  };

  function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookup(query.trim());
  }

  return (
    <Modal
      title="Good things take a little time."
      onClose={onClose}
      className="ord-tracker"
    >
      <p className="ord-dialog-description">
        Follow your coffee, from our counter to your hands.
      </p>
      <form className="ord-lookup" onSubmit={findOrder}>
        <label className="ord-field">
          Order number
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. PP-1042"
            required
            pattern=".*\S.*"
            aria-describedby="ord-lookup-help"
            maxLength={60}
          />
        </label>
        <button className="ord-button ord-button-primary" type="submit">
          Find order <Icon name="arrow-right" size={16} />
        </button>
      </form>
      <p id="ord-lookup-help" className="ord-lookup-help">
        {user
          ? "Use the order number from your confirmation. You can see your own orders."
          : "Sign in to look up your orders."}
      </p>
      <div aria-live="polite">
        {lookup && !order && (
          <div className="ord-not-found">
            <Icon name="search" size={25} />
            <h3>We couldn’t find that order.</h3>
            <p>Check the order number and try again.</p>
          </div>
        )}
        {order && (
          <div className="ord-order-result">
            <div className="ord-order-heading">
              <div>
                <span className="ord-eyebrow">YOUR ORDER</span>
                <h3>{order.id}</h3>
              </div>
              <span
                className={`ord-status ord-status-${order.status}`}
              >
                {statusLabel[order.status]}
              </span>
            </div>
            <ol className="ord-progress" aria-label="Order progress">
              {progress.map((step, index) => (
                <li
                  key={step.status}
                  className={index <= currentStep ? "ord-step-active" : ""}
                  aria-current={index === currentStep ? "step" : undefined}
                >
                  <span className="ord-progress-icon">
                    <Icon
                      name={index < currentStep ? "check" : step.icon}
                      size={19}
                    />
                  </span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
            <p className="ord-progress-message">{messages[order.status]}</p>
            <div className="ord-order-meta">
              <span>
                <Icon name="map-pin" size={17} />
                {order.customerType === "teacher" ? "Teacher" : "Student"}
              </span>
              <span>
                <Icon name="clock" size={16} />
                {new Date(order.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {(order.location || order.classGrade) && (
              <p className="ord-order-address">
                {order.location ? `Deliver to: ${order.location}` : `Class: ${order.classGrade}`}
              </p>
            )}
            <div className="ord-order-summary">
              <h4>Something to look forward to</h4>
              {order.items.map((item, index) => (
                <div className="ord-total-row" key={`${item.productId}-${index}`}>
                  <span>
                    <span className="ord-order-qty">{item.quantity}×</span>{" "}
                    {item.name}
                  </span>
                  <span>{money(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              {order.discount > 0 && (
                <>
                  <div className="ord-total-row">
                    <span>Original price</span>
                    <span>{money(order.subtotal)}</span>
                  </div>
                  <div className="ord-total-row">
                    <span>Teacher discount (50%)</span>
                    <span>−{money(order.discount)}</span>
                  </div>
                </>
              )}
              <div className="ord-total-row ord-grand-total">
                <span>{order.discount > 0 ? "Final price" : "Total"}</span>
                <strong>{money(order.total)}</strong>
              </div>
            </div>
            <p className="ord-fine-print">
              Status reflects updates made by the café team.
            </p>
          </div>
        )}
        {!lookup && (
          <div className="ord-tracking-empty">
            <Icon name="coffee" size={38} />
            <p>Your next coffee break is worth following.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ReviewDialog({ onClose }: { onClose: () => void }) {
  const { user, products, addReview } = useCafe();
  const [rating, setRating] = useState(5);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const comment = String(fields.get("comment") || "").trim();
    if (comment.length < 5) {
      const input = event.currentTarget.elements.namedItem(
        "comment",
      ) as HTMLTextAreaElement;
      input.setCustomValidity(
        "Tell us a little more, using at least 5 characters.",
      );
      input.reportValidity();
      return;
    }
    setSaving(true);
    setError("");
    const result = await addReview({
      productId: String(fields.get("productId") || ""),
      rating,
      comment,
    });
    setSaving(false);
    if (result.ok) setSubmitted(true);
    else setError(result.error);
  }

  return (
    <Modal
      title={submitted ? "You made our day." : "How was your coffee break?"}
      onClose={onClose}
      className="ord-review"
    >
      {!user ? (
        <div className="ord-signin-prompt">
          <h3>Sign in to leave a review</h3>
          <p>
            <Link href="/login">Sign in</Link> · <Link href="/register">Create an account</Link>
          </p>
        </div>
      ) : submitted ? (
        <div className="ord-success">
          <span className="ord-success-icon">
            <Icon name="heart" size={29} />
          </span>
          <h3>A little love goes a long way.</h3>
          <p>
            Thank you for sharing your experience. Your review is now part of
            our community.
          </p>
          <button className="ord-button ord-button-primary" onClick={onClose}>
            Back to the good stuff <Icon name="arrow-right" size={17} />
          </button>
        </div>
      ) : (
        <>
          <p className="ord-dialog-description">
            The good, the great, and what we can do better. We’re all ears.
          </p>
          <form className="ord-review-form" onSubmit={submitReview}>
            <fieldset className="ord-rating">
              <legend>Your rating</legend>
              <div onMouseLeave={() => setHovered(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className={
                      (hovered || rating) >= value ? "ord-star-filled" : ""
                    }
                    onMouseEnter={() => setHovered(value)}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                      aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    />
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m12 3 2.78 5.64L21 9.55l-4.5 4.39 1.06 6.2L12 17.21l-5.56 2.93 1.06-6.2L3 9.55l6.22-.91L12 3Z" />
                    </svg>
                  </label>
                ))}
              </div>
              <span>
                {
                  [
                    "",
                    "Could be better",
                    "A little underwhelming",
                    "A lovely little break",
                    "A really good day",
                    "Love at first sip",
                  ][hovered || rating]
                }
              </span>
            </fieldset>
            <label className="ord-field">
              Product
              <select name="productId" required defaultValue="">
                <option value="" disabled>Choose what you tried</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="ord-field">
              Your experience
              <textarea
                name="comment"
                placeholder="Tell us about your visit, your favorite order, or that first sip…"
                rows={4}
                required
                minLength={5}
                maxLength={1000}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
            </label>
            <p className="ord-review-note">
              Your name and review will appear in our community feed.
            </p>
            {error && <p className="ord-error" role="alert">{error}</p>}
            <button className="ord-button ord-button-primary" type="submit" disabled={saving}>
              {saving ? "Sharing…" : "Share a little love"} <Icon name="arrow-right" size={18} />
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
