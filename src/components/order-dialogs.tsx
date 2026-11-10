"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { Icon } from "@/components/icon";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/modal";
import { money, toCents, type CustomerType } from "@/lib/cafe";
import { computePricing } from "@/lib/pricing";

export function CartDrawer({
  onClose,
  onTrack,
}: {
  onClose: () => void;
  onTrack: (id: string) => void;
}) {
  const { cart, products, orders, setCartQuantity, cartCount, placeOrder, startPayment } =
    useCafe();
  const { t } = useI18n();
  const [step, setStep] = useState<"cart" | "checkout" | "confirm" | "success">("cart");
  const [details, setDetails] = useState<{
    customer: string;
    classGrade: string;
    customerType: CustomerType;
  }>({ customer: "", classGrade: "", customerType: "student" });
  const [placedId, setPlacedId] = useState("");
  const [placedTotal, setPlacedTotal] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState("");
  const placedPaid = orders.find((order) => order.id === placedId)?.paymentStatus === "paid";
  const items = cart.flatMap((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.productId,
    );
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const unavailable = items.some(({ product }) => !product.available);
  const subtotalCents = items.reduce(
    (total, { product, quantity }) => total + toCents(product.price) * quantity,
    0,
  );
  const pricing = computePricing(
    subtotalCents,
    step === "cart" ? "student" : details.customerType,
  );
  const total = pricing.totalCents / 100;

  /** Details belong to this checkout and survive returning from confirmation. */
  function reviewOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || unavailable) return;
    const customer = details.customer.trim();
    const classGrade = details.classGrade.trim();
    setDetails((current) => ({ ...current, customer, classGrade }));
    if (customer.length < 2 || !classGrade) {
      setFormError(t("ord.checkout.requiredDetails"));
      return;
    }
    setFormError("");
    setStep("confirm");
  }

  async function continuePayment(id: string) {
    setPlacing(true);
    setFormError("");
    const payment = await startPayment(id);
    if (!payment.ok) setFormError(payment.error);
    else if (payment.checkoutUrl) window.location.assign(payment.checkoutUrl);
    else if (payment.paymentStatus !== "paid") setFormError(t("err.paymentUnavailable"));
    setPlacing(false);
  }

  /** Save the server-priced order before opening hosted payment, so a failure can be retried. */
  async function confirmOrder() {
    if (!items.length || unavailable || placing) return;
    setPlacing(true);
    setFormError("");
    const result = await placeOrder({
      customerName: details.customer,
      classGrade: details.classGrade,
      customerType: details.customerType,
    });
    if (result.ok) {
      setPlacedId(result.id);
      setPlacedTotal(result.totalCents / 100);
      setStep("success");
      await continuePayment(result.id);
    } else {
      setFormError(result.error);
      setPlacing(false);
    }
  }

  const summary = (
    <div className="ord-order-summary ord-summary-list">
      <h4>{t("ord.checkout.summary")}</h4>
      {items.map(({ product, quantity }) => (
        <div className="ord-total-row" key={product.id}>
          <span><span className="ord-order-qty">{quantity}×</span> {product.name}</span>
          <span>{money(product.price * quantity)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      title={
        step === "checkout"
          ? t("ord.title.checkout")
          : step === "confirm"
            ? t("ord.title.confirm")
            : step === "success"
            ? t("ord.title.success")
            : t("ord.title.cart")
      }
      onClose={onClose}
      className="ord-drawer"
    >
      {step !== "success" && items.length > 0 && (
        <ol className="ord-checkout-steps" aria-label={t("ord.steps.label")}>
          {(["cart", "checkout", "confirm"] as const).map((item, index) => {
            const activeIndex = ["cart", "checkout", "confirm"].indexOf(step);
            const done = index < activeIndex;
            return (
              <li key={item} aria-current={step === item ? "step" : undefined} className={done ? "ord-checkout-step-done" : undefined}>
                <span aria-hidden="true">{done ? <Icon name="check" size={16} /> : index + 1}</span>
                <span>{t(item === "cart" ? "ord.steps.bag" : item === "checkout" ? "ord.steps.details" : "ord.steps.payment")}</span>
              </li>
            );
          })}
        </ol>
      )}
      {step === "success" ? (
        <div className="ord-success">
          <span className={`ord-success-icon${placedPaid ? "" : " ord-payment-pending-icon"}`}>
            <Icon name={placedPaid ? "check" : "credit-card"} size={30} />
          </span>
          <span className="ord-eyebrow">{t("ord.success.eyebrow")}</span>
          <h3>{t(placedPaid ? "ord.payment.completeHeading" : "ord.success.heading")}</h3>
          <p>
            {t("ord.success.orderPre")} <strong>{placedId}</strong> {t("ord.success.orderPost")}
          </p>
          {placedTotal !== null && (
            <div className="ord-total-row ord-grand-total">
              <span>{t("price.total")}</span>
              <strong>{money(placedTotal)}</strong>
            </div>
          )}
          <div className="ord-demo-note">
            <Icon name="info" size={17} />
            <span>{t(placedPaid ? "ord.payment.paidNote" : "ord.success.note")}</span>
          </div>
          {formError && <p className="ord-error" role="alert">{formError}</p>}
          {!placedPaid && (
            <button
              className="ord-button ord-button-primary"
              onClick={() => void continuePayment(placedId)}
              disabled={placing}
            >
              {t(placing ? "ord.payment.opening" : "ord.payment.continue")} <Icon name="arrow-right" size={18} />
            </button>
          )}
          <button
            className="ord-button ord-button-secondary"
            onClick={() => onTrack(placedId)}
          >
            {t("ord.success.track")} <Icon name="arrow-right" size={18} />
          </button>
          <button className="ord-text-button" onClick={onClose}>
            {t("ord.success.toMenu")}
          </button>
        </div>
      ) : !items.length ? (
        <div className="ord-empty">
          <span className="ord-empty-icon">
            <Icon name="bag" size={32} />
          </span>
          <h3>{t("ord.empty.title")}</h3>
          <p>{t("ord.empty.text")}</p>
          <button className="ord-button ord-button-primary" onClick={onClose}>
            {t("ord.empty.cta")} <Icon name="arrow-right" size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="ord-cart-intro">
            {step === "checkout" || step === "confirm" ? (
              <button
                className="ord-text-button"
                onClick={() => { setFormError(""); setStep(step === "confirm" ? "checkout" : "cart"); }}
              >
                <span aria-hidden="true">←</span> {step === "confirm" ? t("ord.confirm.edit") : t("ord.cart.backToBag")}
              </button>
            ) : (
              <p>
                {cartCount === 1
                  ? t("ord.cart.items_one", { count: cartCount })
                  : t("ord.cart.items_other", { count: cartCount })}
              </p>
            )}
            <span>
              <Icon name="coffee" size={16} /> {t("ord.cart.madeWithCare")}
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
                        {t("ord.cart.unavailable")}
                      </span>
                    )}
                    <div className="ord-item-actions">
                      <div
                        className="ord-quantity"
                        aria-label={t("ord.cart.quantityFor", { name: product.name })}
                      >
                        <button
                          aria-label={t("ord.cart.decrease", { name: product.name })}
                          onClick={() =>
                            setCartQuantity(product.id, quantity - 1)
                          }
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <span aria-live="polite">{quantity}</span>
                        <button
                          aria-label={t("ord.cart.increase", { name: product.name })}
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
                        aria-label={t("ord.cart.remove", { name: product.name })}
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
          ) : step === "confirm" ? (
            <div className="ord-confirm">
              <p className="ord-dialog-description">{t("ord.confirm.intro")}</p>
              {summary}
              <dl className="ord-confirm-details">
                <div><dt>{t("ord.checkout.fullName")}</dt><dd>{details.customer}</dd></div>
                <div><dt>{t("ord.checkout.userRole")}</dt><dd>{details.customerType === "teacher" ? t("role.teacher") : t("role.student")}</dd></div>
                <div><dt>{t("ord.checkout.classGrade")}</dt><dd>{details.classGrade}</dd></div>
              </dl>
            </div>
          ) : (
            <form
              id="ord-checkout-form"
              className="ord-checkout-form"
              onSubmit={reviewOrder}
            >
              <div className="ord-form-heading">
                <h3>{t("ord.checkout.yourDetails")}</h3>
              </div>
              <label className="ord-field">
                {t("ord.checkout.fullName")}
                <input
                  name="customer"
                  autoComplete="name"
                  value={details.customer}
                  onChange={(event) => setDetails((current) => ({ ...current, customer: event.target.value }))}
                  maxLength={80}
                  minLength={2}
                  required
                  pattern=".*\S.*"
                />
              </label>
              <label className="ord-field">
                {t("ord.checkout.classGrade")}
                <input
                  name="classGrade"
                  value={details.classGrade}
                  onChange={(event) => setDetails((current) => ({ ...current, classGrade: event.target.value }))}
                  placeholder={t("ord.checkout.classPlaceholder")}
                  maxLength={30}
                  required
                  pattern=".*\S.*"
                />
              </label>
              <fieldset className="ord-user-role">
                <legend>{t("ord.checkout.userRole")}</legend>
                {(["student", "teacher"] as const).map((customerType) => (
                  <label key={customerType} className={details.customerType === customerType ? "ord-selected" : ""}>
                    <input
                      type="radio"
                      name="customerType"
                      value={customerType}
                      checked={details.customerType === customerType}
                      onChange={() => setDetails((current) => ({ ...current, customerType }))}
                      required
                    />
                    <span>{t(customerType === "teacher" ? "role.teacher" : "role.student")}</span>
                  </label>
                ))}
              </fieldset>
              {summary}
              <div className="ord-payment">
                <Icon name="credit-card" size={20} />
                <span>
                  <strong>{t("ord.checkout.payTitle")}</strong>
                  <small>{t("ord.checkout.payText")}</small>
                </span>
                <Icon name="check" size={17} />
              </div>
            </form>
          )}
          <div className="ord-cart-bottom">
            <div className="ord-total-row ord-grand-total" aria-live="polite" aria-atomic="true">
              <span>{t("price.total")}</span>
              <strong>{money(total)}</strong>
            </div>
            {unavailable && (
              <p className="ord-error" role="alert">
                {t("ord.cart.removeUnavailable")}
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
                {t("ord.cart.continue")} <Icon name="arrow-right" size={18} />
              </button>
            ) : step === "checkout" ? (
              <button
                className="ord-button ord-button-primary"
                type="submit"
                form="ord-checkout-form"
                disabled={unavailable}
              >
                {t("ord.checkout.review")} <Icon name="arrow-right" size={18} />
              </button>
            ) : (
              <button
                className="ord-button ord-button-primary"
                onClick={confirmOrder}
                disabled={unavailable || placing}
              >
                {placing
                  ? t("ord.cart.placing")
                  : t("ord.confirm.place", { total: money(total) })}{" "}
                <Icon name="check" size={18} />
              </button>
            )}
            <p className="ord-fine-print">
              {step === "confirm"
                ? t("ord.confirm.fine")
                : step === "checkout"
                  ? t("ord.cart.fineCheckout")
                  : t("ord.cart.fineCart")}
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

const progress = [
  { status: "pending", label: "ord.track.step.pending", icon: "check" },
  { status: "preparing", label: "ord.track.step.preparing", icon: "coffee" },
  { status: "ready", label: "ord.track.step.ready", icon: "bag" },
  { status: "completed", label: "ord.track.step.completed", icon: "heart" },
] as const;

const statusKey = {
  pending: "status.pending",
  preparing: "status.preparing",
  ready: "status.ready",
  completed: "status.completed",
  cancelled: "status.cancelled",
} as const;

const messageKey = {
  pending: "ord.track.msg.pending",
  preparing: "ord.track.msg.preparing",
  ready: "ord.track.msg.ready",
  completed: "ord.track.msg.completed",
  cancelled: "ord.track.msg.cancelled",
} as const;

export function OrderTracker({
  orderId,
  onClose,
  paymentReturn,
  paymentReturnError,
  verifyingPayment = false,
}: {
  orderId?: string;
  onClose: () => void;
  paymentReturn?: "return" | "canceled";
  paymentReturnError?: string;
  verifyingPayment?: boolean;
}) {
  const { orders, status, startPayment, checkPayment } = useCafe();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(orderId || "");
  const [lookup, setLookup] = useState(orderId || "");
  const [paymentBusy, setPaymentBusy] = useState<"start" | "check" | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentInteracted, setPaymentInteracted] = useState(false);
  const order = orders.find(
    (item) => item.id.toLowerCase() === lookup.trim().toLowerCase(),
  );
  const currentStep = progress.findIndex(
    (step) => step.status === order?.status,
  );

  // Keep the result current even when Wire settles after the redirect or no webhook is configured.
  useEffect(() => {
    if (!order || order.paymentStatus !== "pending" || order.status === "cancelled") return;
    const id = order.id;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try { await checkPayment(id); } finally { checking = false; }
    };
    const timer = setInterval(() => void check(), 8000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [order?.id, order?.paymentStatus, order?.status, checkPayment]);

  function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError("");
    setPaymentMessage("");
    setPaymentInteracted(true);
    setLookup(query.trim());
  }

  async function payForOrder() {
    if (!order || paymentBusy || verifyingPayment) return;
    setPaymentInteracted(true);
    setPaymentBusy("start");
    setPaymentError("");
    setPaymentMessage("");
    const result = await startPayment(order.id);
    if (!result.ok) setPaymentError(result.error);
    else if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    else if (result.paymentStatus !== "paid") setPaymentError(t("err.paymentUnavailable"));
    setPaymentBusy(null);
  }

  async function verifyPayment() {
    if (!order || paymentBusy || verifyingPayment) return;
    setPaymentInteracted(true);
    setPaymentBusy("check");
    setPaymentError("");
    setPaymentMessage("");
    const result = await checkPayment(order.id);
    if (!result.ok) setPaymentError(result.error);
    else setPaymentMessage(t(result.paymentStatus === "paid" ? "ord.payment.paidNote" : "ord.payment.checked"));
    setPaymentBusy(null);
  }

  return (
    <Modal
      title={t("ord.track.title")}
      onClose={onClose}
      className="ord-tracker"
    >
      <p className="ord-dialog-description">
        {t("ord.track.description")}
      </p>
      <form className="ord-lookup" onSubmit={findOrder}>
        <label className="ord-field">
          {t("ord.track.orderNumber")}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("ord.track.placeholder")}
            required
            pattern=".*\S.*"
            aria-describedby="ord-lookup-help"
            maxLength={60}
          />
        </label>
        <button className="ord-button ord-button-primary" type="submit">
          {t("ord.track.find")} <Icon name="arrow-right" size={16} />
        </button>
      </form>
      <p id="ord-lookup-help" className="ord-lookup-help">
        {t("ord.track.help")}
      </p>
      {paymentReturn && lookup === orderId && (
        <p className="ord-payment-notice" role="status">
          {t(verifyingPayment ? "ord.payment.verifying" : paymentReturn === "canceled" ? "ord.payment.canceledReturn" : "ord.payment.returned")}
        </p>
      )}
      {paymentReturnError && !paymentInteracted && lookup === orderId && <p className="ord-error" role="alert">{paymentReturnError}</p>}
      <div aria-live="polite">
        {lookup && !order && status === "loading" && <p className="ord-payment-notice">{t("common.loading")}</p>}
        {lookup && !order && status !== "loading" && (
          <div className="ord-not-found">
            <Icon name="search" size={25} />
            <h3>{t("ord.track.notFound")}</h3>
            <p>{t("ord.track.notFoundHint")}</p>
          </div>
        )}
        {order && (
          <div className="ord-order-result">
            <div className="ord-order-heading">
              <div>
                <span className="ord-eyebrow">{t("ord.track.eyebrow")}</span>
                <h3>{order.id}</h3>
              </div>
              <span
                className={`ord-status ord-status-${order.status}`}
              >
                {t(statusKey[order.status])}
              </span>
            </div>
            <div className={`ord-payment-state ord-payment-state-${order.paymentStatus}`}>
              <div className="ord-payment-state-heading">
                <Icon name={order.paymentStatus === "paid" ? "check" : "credit-card"} size={20} />
                <div>
                  <strong>{t(`payment.${order.paymentStatus}`)}</strong>
                  <p>{t(order.paymentStatus === "paid" ? "ord.payment.paidNote" : order.paymentStatus === "pay_at_collection" ? "ord.payment.collectionNote" : "ord.payment.pendingNote")}</p>
                </div>
              </div>
              {order.paymentStatus !== "pay_at_collection" && (
                <div className="ord-payment-actions">
                  {order.paymentStatus !== "paid" && order.status !== "cancelled" && (
                    <button
                      className="ord-button ord-button-primary"
                      onClick={() => void payForOrder()}
                      disabled={paymentBusy !== null || verifyingPayment}
                    >
                      {t(paymentBusy === "start" ? "ord.payment.opening" : order.paymentStatus === "canceled" ? "ord.payment.retry" : "ord.payment.continue")}
                      <Icon name="arrow-right" size={16} />
                    </button>
                  )}
                  {order.paymentStatus !== "paid" && (
                    <button
                      className="ord-button ord-button-secondary"
                      onClick={() => void verifyPayment()}
                      disabled={paymentBusy !== null || verifyingPayment}
                    >
                      {t(paymentBusy === "check" || verifyingPayment ? "ord.payment.verifying" : "ord.payment.check")}
                    </button>
                  )}
                </div>
              )}
              {paymentError && <p className="ord-error" role="alert">{paymentError}</p>}
              {paymentMessage && <p className="ord-payment-notice" role="status">{paymentMessage}</p>}
            </div>
            <ol className="ord-progress" aria-label={t("ord.track.progress")}>
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
                  <span>{t(step.label)}</span>
                </li>
              ))}
            </ol>
            <p className="ord-progress-message">{t(messageKey[order.status])}</p>
            <div className="ord-order-meta">
              <span>
                <Icon name="map-pin" size={17} />
                {order.customerType === "teacher" ? t("role.teacher") : t("role.student")}
              </span>
              <span>
                <Icon name="clock" size={16} />
                {new Date(order.createdAt).toLocaleString(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {(order.location || order.classGrade) && (
              <p className="ord-order-address">
                {order.location
                  ? t("ord.track.deliverTo", { location: order.location })
                  : t("ord.track.class", { classGrade: order.classGrade ?? "" })}
              </p>
            )}
            <div className="ord-order-summary">
              <h4>{t("ord.track.summary")}</h4>
              {order.items.map((item, index) => (
                <div className="ord-total-row" key={`${item.productId}-${index}`}>
                  <span>
                    <span className="ord-order-qty">{item.quantity}×</span>{" "}
                    {item.name}
                  </span>
                  <span>{money(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              <div className="ord-total-row ord-grand-total">
                <span>{t("price.total")}</span>
                <strong>{money(order.total)}</strong>
              </div>
            </div>
            <p className="ord-fine-print">
              {t("ord.track.fine")}
            </p>
          </div>
        )}
        {!lookup && (
          <div className="ord-tracking-empty">
            <Icon name="coffee" size={38} />
            <p>{t("ord.track.empty")}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ReviewDialog({ onClose }: { onClose: () => void }) {
  const { products, addReview } = useCafe();
  const { t } = useI18n();
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
      input.setCustomValidity(t("ord.review.tooShort"));
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
      title={submitted ? t("ord.review.titleDone") : t("ord.review.title")}
      onClose={onClose}
      className="ord-review"
    >
      {submitted ? (
        <div className="ord-success">
          <span className="ord-success-icon">
            <Icon name="heart" size={29} />
          </span>
          <h3>{t("ord.review.thanksTitle")}</h3>
          <p>{t("ord.review.thanksText")}</p>
          <button className="ord-button ord-button-primary" onClick={onClose}>
            {t("ord.review.back")} <Icon name="arrow-right" size={17} />
          </button>
        </div>
      ) : (
        <>
          <p className="ord-dialog-description">
            {t("ord.review.description")}
          </p>
          <form className="ord-review-form" onSubmit={submitReview}>
            <fieldset className="ord-rating">
              <legend>{t("ord.review.rating")}</legend>
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
                      aria-label={
                        value === 1
                          ? t("ord.review.star_one", { count: value })
                          : t("ord.review.star_other", { count: value })
                      }
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
                    t("ord.review.caption.1"),
                    t("ord.review.caption.2"),
                    t("ord.review.caption.3"),
                    t("ord.review.caption.4"),
                    t("ord.review.caption.5"),
                  ][hovered || rating]
                }
              </span>
            </fieldset>
            <label className="ord-field">
              {t("ord.review.product")}
              <select name="productId" required defaultValue="">
                <option value="" disabled>{t("ord.review.chooseProduct")}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="ord-field">
              {t("ord.review.experience")}
              <textarea
                name="comment"
                placeholder={t("ord.review.placeholder")}
                rows={4}
                required
                minLength={5}
                maxLength={1000}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
            </label>
            <p className="ord-review-note">
              {t("ord.review.note")}
            </p>
            {error && <p className="ord-error" role="alert">{error}</p>}
            <button className="ord-button ord-button-primary" type="submit" disabled={saving}>
              {saving ? t("ord.review.sharing") : t("ord.review.share")} <Icon name="arrow-right" size={18} />
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
