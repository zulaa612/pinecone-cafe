"use client";

import { useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import { money } from "@/lib/cafe";

const deliveryFee = 3.5;

export function CartDrawer({ onClose, onTrack }: { onClose: () => void; onTrack: (id: string) => void }) {
  const { cart, products, setCartQuantity, cartTotal, cartCount, placeOrder } = useCafe();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [placedId, setPlacedId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState("");
  const items = cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const unavailable = items.some(({ product }) => !product.available);
  const total = cartTotal + (fulfillment === "delivery" ? deliveryFee : 0);

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || unavailable || placing) return;
    const fields = new FormData(event.currentTarget);
    const address = String(fields.get("address") || "").trim();
    if (fulfillment === "delivery" && !address) {
      const input = event.currentTarget.elements.namedItem("address") as HTMLTextAreaElement;
      input.setCustomValidity("Please enter your delivery address.");
      input.reportValidity();
      return;
    }
    setPlacing(true);
    setFormError("");
    try {
      const id = placeOrder({
        customer: String(fields.get("customer") || "").trim(),
        email: String(fields.get("email") || "").trim(),
        phone: String(fields.get("phone") || "").trim(),
        fulfillment,
        address: fulfillment === "delivery" ? address : undefined,
        notes: String(fields.get("notes") || "").trim(),
      });
      setPlacedId(id);
      setStep("success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn’t place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Modal title={step === "checkout" ? "A little closer to coffee." : step === "success" ? "Order received." : "Your coffee break"} onClose={onClose} className="ord-drawer">
      {step === "success" ? (
        <div className="ord-success">
          <span className="ord-success-icon"><Icon name="check" size={30} /></span>
          <span className="ord-eyebrow">GOOD THINGS ARE BREWING</span>
          <h3>Thanks for ordering.</h3>
          <p>Your order <strong>{placedId}</strong> has been received. Follow its progress here as our team updates it.</p>
          <div className="ord-demo-note"><Icon name="info" size={17} /><span>This is a demo order saved in this browser. No payment has been taken.</span></div>
          <button className="ord-button ord-button-primary" onClick={() => onTrack(placedId)}>Track my order <Icon name="arrow-right" size={18} /></button>
          <button className="ord-text-button" onClick={onClose}>Back to the menu</button>
        </div>
      ) : !items.length ? (
        <div className="ord-empty">
          <span className="ord-empty-icon"><Icon name="bag" size={32} /></span>
          <h3>A little empty in here.</h3>
          <p>A freshly brewed coffee or a buttery pastry? Your next favorite is waiting.</p>
          <button className="ord-button ord-button-primary" onClick={onClose}>Explore the menu <Icon name="arrow-right" size={18} /></button>
        </div>
      ) : (
        <>
          <div className="ord-cart-intro">
            {step === "checkout" ? <button className="ord-text-button" onClick={() => setStep("cart")}><span aria-hidden="true">←</span> Back to your bag</button> : <p>{cartCount} {cartCount === 1 ? "lovely thing" : "lovely things"} for your day.</p>}
            <span><Icon name="coffee" size={16} /> Made with care</span>
          </div>
          {step === "cart" ? (
            <div className="ord-cart-items">
              {items.map(({ product, quantity }) => (
                <article className="ord-cart-item" key={product.id}>
                  {/* Product photography is served from the menu's image URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ord-item-image" src={product.image} alt={product.name} />
                  <div className="ord-item-details">
                    <h3>{product.name}</h3>
                    <p>{money(product.price)}</p>
                    {!product.available && <span className="ord-unavailable">Currently unavailable · please remove</span>}
                    <div className="ord-item-actions">
                      <div className="ord-quantity" aria-label={`Quantity for ${product.name}`}>
                        <button aria-label={`Decrease ${product.name} quantity`} onClick={() => setCartQuantity(product.id, quantity - 1)}><Icon name="minus" size={14} /></button>
                        <span aria-live="polite">{quantity}</span>
                        <button aria-label={`Increase ${product.name} quantity`} disabled={quantity >= 99 || !product.available} onClick={() => setCartQuantity(product.id, quantity + 1)}><Icon name="plus" size={14} /></button>
                      </div>
                      <button className="ord-remove" aria-label={`Remove ${product.name} from bag`} onClick={() => setCartQuantity(product.id, 0)}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                  <strong className="ord-item-total">{money(product.price * quantity)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <form id="ord-checkout-form" className="ord-checkout-form" onSubmit={submitOrder}>
              <fieldset className="ord-fulfillment">
                <legend>How would you like your order?</legend>
                <label className={fulfillment === "pickup" ? "ord-selected" : ""}>
                  <input type="radio" name="fulfillment" value="pickup" checked={fulfillment === "pickup"} onChange={() => setFulfillment("pickup")} />
                  <Icon name="bag" size={21} /><span><strong>Pick up</strong><small>At our café · Free</small></span>
                </label>
                <label className={fulfillment === "delivery" ? "ord-selected" : ""}>
                  <input type="radio" name="fulfillment" value="delivery" checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} />
                  <Icon name="truck" size={21} /><span><strong>Delivery</strong><small>To your door · {money(deliveryFee)}</small></span>
                </label>
              </fieldset>
              <div className="ord-form-heading"><h3>Your details</h3><span>All fields required unless marked</span></div>
              <label className="ord-field">Full name<input name="customer" autoComplete="name" placeholder="Alex Morgan" maxLength={80} required pattern=".*\S.*" /></label>
              <label className="ord-field">Email address<input name="email" type="email" autoComplete="email" placeholder="alex@example.com" maxLength={120} required /></label>
              <label className="ord-field">Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="Your contact number" maxLength={30} required pattern=".*\S.*" /></label>
              {fulfillment === "delivery" && <label className="ord-field">Delivery address<textarea name="address" autoComplete="street-address" placeholder="Street, building, unit and postal code" rows={2} maxLength={300} required onInput={(event) => event.currentTarget.setCustomValidity("")} /></label>}
              <label className="ord-field">Anything we should know? <span>(optional)</span><textarea name="notes" placeholder="Special requests or delivery instructions…" rows={2} maxLength={500} /></label>
              <div className="ord-payment"><Icon name="credit-card" size={20} /><span><strong>{fulfillment === "pickup" ? "Pay when you collect" : "Pay on delivery"}</strong><small>No online payment is required.</small></span><Icon name="check" size={17} /></div>
            </form>
          )}
          <div className="ord-cart-bottom">
            <div className="ord-total-row"><span>Subtotal</span><span>{money(cartTotal)}</span></div>
            <div className="ord-total-row"><span>{step === "checkout" ? fulfillment === "delivery" ? "Delivery" : "Pickup" : "Pickup"}</span><span>{step === "checkout" && fulfillment === "delivery" ? money(deliveryFee) : <span className="ord-free">On us</span>}</span></div>
            {step === "cart" && <p className="ord-delivery-hint">Prefer delivery? Choose it at checkout for {money(deliveryFee)}.</p>}
            <div className="ord-total-row ord-grand-total"><span>Total</span><strong>{money(step === "checkout" ? total : cartTotal)}</strong></div>
            {unavailable && <p className="ord-error" role="alert">Please remove unavailable items before checking out.</p>}
            {formError && <p className="ord-error" role="alert">{formError}</p>}
            {step === "cart" ? <button className="ord-button ord-button-primary" disabled={unavailable} onClick={() => setStep("checkout")}>Continue to checkout <Icon name="arrow-right" size={18} /></button> : <button className="ord-button ord-button-primary" type="submit" form="ord-checkout-form" disabled={unavailable || placing}>{placing ? "Placing your order…" : `Place order · ${money(total)}`} <Icon name="arrow-right" size={18} /></button>}
            <p className="ord-fine-print">{step === "checkout" ? "Demo checkout · Orders are saved on this device. No real charge." : "Freshly made. Thoughtfully packed. Always delicious."}</p>
          </div>
        </>
      )}
    </Modal>
  );
}

const progress = [
  { status: "Pending", label: "Received", icon: "check" },
  { status: "Preparing", label: "Preparing", icon: "coffee" },
  { status: "Ready", label: "Ready", icon: "bag" },
  { status: "Completed", label: "Completed", icon: "heart" },
] as const;

export function OrderTracker({ orderId, onClose }: { orderId?: string; onClose: () => void }) {
  const { orders } = useCafe();
  const [query, setQuery] = useState(orderId || "");
  const [lookup, setLookup] = useState(orderId || "");
  const order = orders.find((item) => item.id.toLowerCase() === lookup.trim().toLowerCase());
  const currentStep = progress.findIndex((step) => step.status === order?.status);
  const messages = order ? {
    Pending: "You're in! Your order is with our café team.",
    Preparing: "A little care, a little craft. We're preparing your order.",
    Ready: order.fulfillment === "pickup" ? "Your order is ready. See you at the counter!" : "Your order is ready for delivery.",
    Completed: "All yours. We hope it made your day a little better.",
  } : undefined;

  function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookup(query.trim());
  }

  return (
    <Modal title="Good things take a little time." onClose={onClose} className="ord-tracker">
      <p className="ord-dialog-description">Follow your coffee, from our counter to your hands.</p>
      <form className="ord-lookup" onSubmit={findOrder}>
        <label className="ord-field">Order number<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. PP-1042" required pattern=".*\S.*" aria-describedby="ord-lookup-help" maxLength={60} /></label>
        <button className="ord-button ord-button-primary" type="submit">Find order <Icon name="arrow-right" size={16} /></button>
      </form>
      <p id="ord-lookup-help" className="ord-lookup-help">Use the order number from your confirmation. Demo orders are available on this device.</p>
      <div aria-live="polite">
        {lookup && !order && <div className="ord-not-found"><Icon name="search" size={25} /><h3>We couldn’t find that order.</h3><p>Check the order number and try again.</p></div>}
        {order && <div className="ord-order-result">
          <div className="ord-order-heading"><div><span className="ord-eyebrow">YOUR ORDER</span><h3>{order.id}</h3></div><span className={`ord-status ord-status-${order.status.toLowerCase()}`}>{order.status === "Pending" ? "Order received" : order.status === "Preparing" ? "In preparation" : order.status}</span></div>
          <ol className="ord-progress" aria-label="Order progress">
            {progress.map((step, index) => <li key={step.status} className={index <= currentStep ? "ord-step-active" : ""} aria-current={index === currentStep ? "step" : undefined}><span className="ord-progress-icon"><Icon name={index < currentStep ? "check" : step.icon} size={19} /></span><span>{step.label}</span></li>)}
          </ol>
          <p className="ord-progress-message">{messages?.[order.status]}</p>
          <div className="ord-order-meta"><span><Icon name={order.fulfillment === "pickup" ? "map-pin" : "truck"} size={17} />{order.fulfillment === "pickup" ? "Café pickup" : "Delivery"}</span><span><Icon name="clock" size={16} />{new Date(order.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
          {order.address && <p className="ord-order-address">{order.address}</p>}
          <div className="ord-order-summary"><h4>Something to look forward to</h4>{order.items.map(({ product, quantity }) => <div className="ord-total-row" key={product.id}><span><span className="ord-order-qty">{quantity}×</span> {product.name}</span><span>{money(product.price * quantity)}</span></div>)}{order.fulfillment === "delivery" && <div className="ord-total-row"><span>Delivery</span><span>{money(deliveryFee)}</span></div>}<div className="ord-total-row ord-grand-total"><span>Total</span><strong>{money(order.total)}</strong></div></div>
          {order.notes && <p className="ord-order-notes"><strong>Your note:</strong> {order.notes}</p>}
          <p className="ord-fine-print">Status reflects updates made by the café team in this demo.</p>
        </div>}
        {!lookup && <div className="ord-tracking-empty"><Icon name="coffee" size={38} /><p>Your next coffee break is worth following.</p></div>}
      </div>
    </Modal>
  );
}

export function ReviewDialog({ onClose }: { onClose: () => void }) {
  const { addReview } = useCafe();
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const comment = String(fields.get("comment") || "").trim();
    if (comment.length < 5) {
      const input = event.currentTarget.elements.namedItem("comment") as HTMLTextAreaElement;
      input.setCustomValidity("Tell us a little more, using at least 5 characters.");
      input.reportValidity();
      return;
    }
    addReview({ name: String(fields.get("name") || "").trim(), rating, comment });
    setSubmitted(true);
  }

  return (
    <Modal title={submitted ? "You made our day." : "How was your coffee break?"} onClose={onClose} className="ord-review">
      {submitted ? <div className="ord-success"><span className="ord-success-icon"><Icon name="heart" size={29} /></span><h3>A little love goes a long way.</h3><p>Thank you for sharing your experience. Your review is now part of our community.</p><button className="ord-button ord-button-primary" onClick={onClose}>Back to the good stuff <Icon name="arrow-right" size={17} /></button></div> : <>
        <p className="ord-dialog-description">The good, the great, and what we can do better. We’re all ears.</p>
        <form className="ord-review-form" onSubmit={submitReview}>
          <fieldset className="ord-rating"><legend>Your rating</legend><div onMouseLeave={() => setHovered(0)}>{[1, 2, 3, 4, 5].map((value) => <label key={value} className={(hovered || rating) >= value ? "ord-star-filled" : ""} onMouseEnter={() => setHovered(value)}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.64L21 9.55l-4.5 4.39 1.06 6.2L12 17.21l-5.56 2.93 1.06-6.2L3 9.55l6.22-.91L12 3Z" /></svg></label>)}</div><span>{["", "Could be better", "A little underwhelming", "A lovely little break", "A really good day", "Love at first sip"][hovered || rating]}</span></fieldset>
          <label className="ord-field">Your name<input name="name" autoComplete="name" placeholder="What should we call you?" required maxLength={80} pattern=".*\S.*" /></label>
          <label className="ord-field">Your experience<textarea name="comment" placeholder="Tell us about your visit, your favorite order, or that first sip…" rows={4} required minLength={5} maxLength={1000} onInput={(event) => event.currentTarget.setCustomValidity("")} /></label>
          <p className="ord-review-note">Your name and review will appear in our community feed on this device.</p>
          <button className="ord-button ord-button-primary" type="submit">Share a little love <Icon name="arrow-right" size={18} /></button>
        </form>
      </>}
    </Modal>
  );
}
