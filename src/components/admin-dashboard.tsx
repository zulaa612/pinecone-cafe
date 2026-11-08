"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { useCafe } from "@/components/cafe-provider";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/modal";
import { money, type ActionResult, type Order, type OrderStatus, type Product } from "@/lib/cafe";
import type { ProductInput } from "@/components/cafe-provider";
import { signOutStaff } from "@/app/admin/actions";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher, ThemeToggle } from "@/components/preferences";

const categories: Product["category"][] = ["Coffee", "Non-Coffee", "Meal"];
const statuses = ["pending", "preparing", "ready", "completed"] as const;
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const ALL = "all";

export function AdminDashboard({ demo }: { demo: boolean }) {
  const {
    products,
    orders,
    addProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
  } = useCafe();
  const { t } = useI18n();
  const [tab, setTab] = useState<"orders" | "menu">("menu");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");
  const activeOrders = orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const revenue = orders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + order.total, 0);
  const visibleProducts = products.filter(
    (product) =>
      (category === ALL || product.category === category) &&
      `${product.name} ${product.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  async function saveProduct(product: ProductInput): Promise<ActionResult> {
    const result =
      editing && editing !== "new"
        ? await updateProduct(editing.id, product)
        : await addProduct(product);
    if (result.ok) {
      setNotice(
        t(editing === "new" ? "adm.notice.added" : "adm.notice.updated", {
          name: product.name,
        }),
      );
      setEditing(null);
    }
    return result;
  }

  async function report(result: ActionResult, success: string) {
    setNotice(result.ok ? success : result.error);
  }

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <Link href="/" className="adm-brand">
          <span className="adm-brand-mark">
            <Icon name="coffee" size={24} />
          </span>
          <span>
            Pine & Pour
            <span className="adm-brand-sub">{t("adm.brand.sub")}</span>
          </span>
        </Link>
        <span className="adm-access-label">
          <span /> {t("adm.nav.section")}
        </span>
        <nav className="adm-navigation" aria-label={t("adm.nav.label")}>
          <button
            className={
              tab === "orders" ? "adm-nav-item adm-nav-active" : "adm-nav-item"
            }
            aria-current={tab === "orders" ? "page" : undefined}
            onClick={() => setTab("orders")}
          >
            <Icon name="receipt" size={20} />
            {t("adm.nav.orders")}
            <span className="adm-nav-count">{activeOrders.length}</span>
          </button>
          <button
            className={
              tab === "menu" ? "adm-nav-item adm-nav-active" : "adm-nav-item"
            }
            aria-current={tab === "menu" ? "page" : undefined}
            onClick={() => setTab("menu")}
          >
            <Icon name="grid" size={20} />
            {t("adm.nav.menu")}
          </button>
        </nav>
        <div className="adm-sidebar-bottom">
          <div className="adm-sidebar-card">
            <span>{t("adm.sidebar.cardTitle")}</span>
            <p>{t("adm.sidebar.cardText")}</p>
            <Icon name="coffee" size={30} />
          </div>
          <Link href="/" className="adm-nav-item">
            <Icon name="arrow-left" size={19} />
            {t("adm.nav.customer")}
          </Link>
          <form action={signOutStaff}>
            <button className="adm-nav-item" type="submit">
              <Icon name="log-out" size={19} />
              {t("common.signOut")}
            </button>
          </form>
          <div className="adm-staff-profile">
            <span>PP</span>
            <div>
              <strong>{t("adm.profile.team")}</strong>
              <small>{t("adm.profile.role")}</small>
            </div>
            <span className="adm-online-dot" />
          </div>
        </div>
      </aside>

      <div className="adm-workspace">
        <header className="adm-topbar">
          <div>
            <span className="adm-topbar-label">{t("adm.top.label")}</span>
            <span className="adm-topbar-title">{t("adm.top.title")}</span>
          </div>
          <div className="adm-topbar-right">
            {demo && <span className="adm-demo-pill">{t("adm.top.demo")}</span>}
            <span className="adm-live-pill">
              <span />
              {t("adm.top.open")}
            </span>
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="adm-avatar">PP</span>
          </div>
        </header>
        <main className="adm-main">
          <div className="adm-page-heading">
            <div>
              <span className="adm-eyebrow">
                {t("adm.heading.eyebrow")}
              </span>
              <h1>
                {tab === "orders"
                  ? t("adm.heading.ordersTitle")
                  : t("adm.heading.menuTitle")}
              </h1>
              <p>
                {tab === "orders"
                  ? t("adm.heading.ordersText")
                  : t("adm.heading.menuText")}
              </p>
            </div>
            {tab === "menu" && (
              <button className="adm-primary" onClick={() => setEditing("new")}>
                <Icon name="plus" size={18} />
                {t("adm.action.addProduct")}
              </button>
            )}
          </div>
          {demo && (
            <div className="adm-workspace-note">
              <Icon name="lock" size={15} />
              <span>
                {t("adm.demo.note")}
              </span>
            </div>
          )}
          <div
            role="status"
            aria-live="polite"
            className={notice ? "adm-notice" : "adm-sr-only"}
          >
            {notice && (
              <>
                <Icon name="check" size={17} />
                <span>{notice}</span>
                <button
                  aria-label={t("adm.notice.dismiss")}
                  onClick={() => setNotice("")}
                >
                  <Icon name="close" size={16} />
                </button>
              </>
            )}
          </div>
          <section className="adm-stats" aria-label={t("adm.stats.label")}>
            <Stat
              label={t("adm.stats.active")}
              value={String(activeOrders.length).padStart(2, "0")}
              caption={t("adm.stats.activeCaption")}
              icon="receipt"
            />
            <Stat
              label={t("adm.stats.ready")}
              value={String(
                orders.filter((order) => order.status === "ready")
                  .length,
              ).padStart(2, "0")}
              caption={t("adm.stats.readyCaption")}
              icon="check"
            />
            <Stat
              label={t("adm.stats.sales")}
              value={money(revenue)}
              caption={t("adm.stats.salesCaption")}
              icon="coffee"
            />
            <Stat
              label={t("adm.stats.menu")}
              value={String(products.length).padStart(2, "0")}
              caption={t("adm.stats.menuCaption", {
                count: products.filter((product) => product.available).length,
              })}
              icon="grid"
            />
          </section>

          {tab === "orders" ? (
            <section
              className="adm-order-section"
              aria-labelledby="adm-orders-title"
            >
              <div className="adm-section-heading">
                <div>
                  <h2 id="adm-orders-title">
                    {t("adm.board.title")} <span>{orders.length}</span>
                  </h2>
                  <p>{t("adm.board.subtitle")}</p>
                </div>
                <span className="adm-updated">
                  <span />
                  {t("adm.board.saved")}
                </span>
              </div>
              <div className="adm-board">
                {statuses.map((status) => (
                  <section
                    key={status}
                    className={`adm-column adm-column-${status.toLowerCase()}`}
                    aria-label={t("adm.board.columnLabel", {
                      status: t(`status.${status}`),
                    })}
                  >
                    <div className="adm-column-heading">
                      <span className="adm-status-dot" />
                      <h3>{t(`status.${status}`)}</h3>
                      <span className="adm-column-count">
                        {
                          orders.filter(
                            (order) => order.status === status,
                          ).length
                        }
                      </span>
                    </div>
                    <div className="adm-order-list">
                      {orders
                        .filter((order) => order.status === status)
                        .map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onAdvance={async () => {
                              const next = nextStatus[status];
                              if (next) {
                                await report(
                                  await updateOrderStatus(order.id, next),
                                  t("adm.notice.orderMoved", {
                                    id: order.id,
                                    status: t(`status.${next}`).toLowerCase(),
                                  }),
                                );
                              }
                            }}
                          />
                        ))}
                      {!orders.some(
                        (order) => order.status === status,
                      ) && (
                        <div className="adm-empty-column">
                          <Icon
                            name={status === "completed" ? "check" : "coffee"}
                            size={25}
                          />
                          <p>
                            {status === "pending"
                              ? t("adm.board.emptyPending")
                              : t("adm.board.emptyColumn", {
                                  status: t(`status.${status}`).toLowerCase(),
                                })}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : (
            <section
              className="adm-menu-section"
              aria-labelledby="adm-menu-title"
            >
              <div className="adm-section-heading">
                <div>
                  <h2 id="adm-menu-title">
                    {t("adm.menu.title")} <span>{products.length}</span>
                  </h2>
                  <p>{t("adm.menu.subtitle")}</p>
                </div>
              </div>
              <div className="adm-menu-toolbar">
                <label className="adm-search">
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("adm.menu.searchPlaceholder")}
                    aria-label={t("adm.menu.searchLabel")}
                  />
                </label>
                <select
                  aria-label={t("adm.menu.filterLabel")}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value={ALL}>{t("adm.menu.allCategories")}</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {t(`category.${item}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adm-table-scroll">
                <table className="adm-product-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("adm.table.product")}</th>
                      <th scope="col">{t("adm.table.category")}</th>
                      <th scope="col">{t("adm.table.price")}</th>
                      <th scope="col">{t("adm.table.availability")}</th>
                      <th scope="col">
                        <span className="adm-sr-only">{t("adm.table.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="adm-table-product">
                            <Image
                              src={product.image}
                              alt=""
                              width={51}
                              height={51}
                              unoptimized
                            />
                            <div>
                              <strong>{product.name}</strong>
                              <p>{product.description}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="adm-category-tag">
                            {t(`category.${product.category}`)}
                          </span>
                        </td>
                        <td className="adm-price">{money(product.price)}</td>
                        <td>
                          <button
                            className={`adm-availability ${product.available ? "adm-available" : ""}`}
                            aria-label={t("adm.table.toggleLabel", {
                              name: product.name,
                              state: t(
                                product.available
                                  ? "adm.state.available"
                                  : "adm.state.unavailable",
                              ),
                            })}
                            aria-pressed={product.available}
                            onClick={async () => {
                              const { id, rating, reviewCount, badge, ...rest } = product;
                              void rating; void reviewCount; void badge;
                              await report(
                                await updateProduct(id, { ...rest, available: !product.available }),
                                t(
                                  product.available
                                    ? "adm.notice.nowUnavailable"
                                    : "adm.notice.nowAvailable",
                                  { name: product.name },
                                ),
                              );
                            }}
                          >
                            <span />
                            {product.available
                              ? t("adm.availability.available")
                              : t("adm.availability.soldOut")}
                          </button>
                        </td>
                        <td>
                          <div className="adm-row-actions">
                            <button
                              aria-label={t("adm.table.editLabel", { name: product.name })}
                              title={t("adm.table.editTitle")}
                              onClick={() => setEditing(product)}
                            >
                              <Icon name="edit" size={17} />
                            </button>
                            <button
                              className="adm-delete-action"
                              aria-label={t("adm.table.deleteLabel", { name: product.name })}
                              title={t("adm.table.deleteTitle")}
                              onClick={() => setDeleting(product)}
                            >
                              <Icon name="trash" size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleProducts.length && (
                  <div className="adm-no-results">
                    <Icon
                      name={products.length ? "search" : "coffee"}
                      size={32}
                    />
                    <h3>
                      {products.length
                        ? t("adm.empty.noneFound")
                        : t("adm.empty.first")}
                    </h3>
                    <p>
                      {products.length
                        ? t("adm.empty.tryOther")
                        : t("adm.empty.addHint")}
                    </p>
                    {products.length ? (
                      <button
                        className="adm-secondary"
                        onClick={() => {
                          setSearch("");
                          setCategory(ALL);
                        }}
                      >
                        {t("adm.empty.clear")}
                      </button>
                    ) : (
                      <button
                        className="adm-primary"
                        onClick={() => setEditing("new")}
                      >
                        <Icon name="plus" size={17} />
                        {t("adm.action.addFirst")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="adm-table-footer">
                {t("adm.table.showing", {
                  shown: visibleProducts.length,
                  total: products.length,
                })}
                <span>{t("adm.table.footer")}</span>
              </div>
            </section>
          )}
          <footer className="adm-footer">
            <span>{t("adm.footer.copy")}</span>
            <span>{t("adm.footer.tagline")}</span>
          </footer>
        </main>
      </div>
      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          fallbackImage="/images/product-placeholder.svg"
          onClose={() => setEditing(null)}
          onSave={saveProduct}
        />
      )}
      {deleting && (
        <Modal
          title={t("adm.delete.title")}
          onClose={() => setDeleting(null)}
          className="adm-confirm-modal"
        >
          <p className="adm-modal-copy">
            {t("adm.delete.body", { name: deleting.name })}
          </p>
          <div className="adm-form-actions">
            <button className="adm-secondary" onClick={() => setDeleting(null)}>
              {t("adm.delete.keep")}
            </button>
            <button
              className="adm-danger"
              onClick={async () => {
                await report(
                  await deleteProduct(deleting.id),
                  t("adm.notice.removed", { name: deleting.name }),
                );
                setDeleting(null);
              }}
            >
              {t("adm.delete.confirm")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: string;
}) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-top">
        <span>{label}</span>
        <span className="adm-stat-icon">
          <Icon name={icon} size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{caption}</p>
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: () => void;
}) {
  const { t, locale } = useI18n();
  const time = new Date(order.createdAt).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Ulaanbaatar",
  });
  const status = order.status;
  return (
    <article className="adm-order-card">
      <div className="adm-ticket-top">
        <strong>#{order.id.replace(/^#/, "")}</strong>
        <span>{time}</span>
      </div>
      <div className="adm-ticket-customer">
        <h4>{order.customerName}</h4>
        <span className={`adm-fulfillment adm-fulfillment-${order.customerType === "teacher" ? "delivery" : "pickup"}`}>
          {t(order.customerType === "teacher" ? "role.teacher" : "role.student")}
        </span>
      </div>
      <ul className="adm-ticket-items">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            <span>{item.quantity}×</span>
            {item.name}
          </li>
        ))}
      </ul>
      {order.classGrade && <p className="adm-order-note">{t("adm.order.class", { value: order.classGrade })}</p>}
      {order.location && <p className="adm-order-address">{t("adm.order.deliverTo", { value: order.location })}</p>}
      <div className="adm-ticket-total">
        <span>
          {t("adm.order.items", {
            count: order.items.reduce((total, item) => total + item.quantity, 0),
          })}
        </span>
        <strong>{money(order.total)}</strong>
      </div>
      <button
        className="adm-order-advance"
        onClick={onAdvance}
        disabled={!nextStatus[status]}
      >
        {nextStatus[status]
          ? t(`adm.next.${status as "pending" | "preparing" | "ready"}`)
          : t(`status.${status}`)}
        <Icon
          name={!nextStatus[status] ? "check" : "arrow-right"}
          size={15}
        />
      </button>
    </article>
  );
}

function ProductEditor({
  product,
  fallbackImage,
  onClose,
  onSave,
}: {
  product: Product | null;
  fallbackImage: string;
  onClose: () => void;
  onSave: (value: ProductInput) => Promise<ActionResult>;
}) {
  const { t } = useI18n();
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(product?.image || "");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const price = Number(form.get("price"));
    if (!name || !description || !Number.isFinite(price) || price <= 0) return;
    setSaving(true);
    setSaveError("");
    const result = await onSave({
      name,
      description,
      price,
      category: String(form.get("category")) as Product["category"],
      image: image || fallbackImage,
      available: form.get("available") === "on",
      featured: form.get("featured") === "on",
    });
    setSaving(false);
    if (!result.ok) setSaveError(result.error);
  }

  function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError(t("adm.form.errNotImage"));
      return;
    }
    if (file.size > 1024 * 1024) {
      setImageError(t("adm.form.errTooLarge"));
      return;
    }
    setImageError("");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setUploading(false);
    };
    reader.onerror = () => {
      setImageError(t("adm.form.errRead"));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Modal
      title={product ? t("adm.form.titleEdit") : t("adm.form.titleNew")}
      onClose={onClose}
      className="adm-product-modal"
    >
      <p className="adm-modal-copy">
        {product
          ? t("adm.form.copyEdit")
          : t("adm.form.copyNew")}
      </p>
      <form className="adm-product-form" onSubmit={submit}>
        <div className="adm-upload-area">
          {image ? (
            <>
              <Image
                src={image}
                alt={t("adm.form.previewAlt")}
                width={73}
                height={73}
                unoptimized
              />
              <div>
                <strong>{t("adm.form.looksGood")}</strong>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  {t("adm.form.chooseAnother")}
                </button>
              </div>
            </>
          ) : (
            <>
              <span>
                <Icon name="upload" size={23} />
              </span>
              <div>
                <strong>{t("adm.form.addPhoto")}</strong>
                <p>{t("adm.form.photoHint")}</p>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  {t("adm.form.chooseImage")}
                </button>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label={t("adm.form.uploadLabel")}
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </div>
        {imageError && (
          <p className="adm-field-error" role="alert">
            {imageError}
          </p>
        )}
        <label htmlFor="product-name">
          {t("adm.form.name")}
          <input
            id="product-name"
            name="name"
            defaultValue={product?.name}
            placeholder={t("adm.form.namePlaceholder")}
            maxLength={70}
            required
          />
        </label>
        <div className="adm-form-two">
          <label htmlFor="product-category">
            {t("adm.form.category")}
            <select
              id="product-category"
              name="category"
              defaultValue={product?.category || "Coffee"}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`category.${category}`)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="product-price">
            {t("adm.form.price")}
            <input
              id="product-price"
              name="price"
              type="number"
              min="0.01"
              max="9999"
              step="0.01"
              defaultValue={product?.price}
              placeholder="0.00"
              required
            />
          </label>
        </div>
        <label htmlFor="product-description">
          {t("adm.form.description")}
          <textarea
            id="product-description"
            name="description"
            defaultValue={product?.description}
            placeholder={t("adm.form.descriptionPlaceholder")}
            maxLength={240}
            rows={3}
            required
          />
        </label>
        <label className="adm-checkbox">
          <input
            name="available"
            type="checkbox"
            defaultChecked={product?.available ?? true}
          />
          <span>{t("adm.form.available")}</span>
        </label>
        <label className="adm-checkbox">
          <input
            name="featured"
            type="checkbox"
            defaultChecked={product?.featured ?? false}
          />
          <span>{t("adm.form.featured")}</span>
        </label>
        {saveError && (
          <p className="adm-field-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="adm-form-actions">
          <button type="button" className="adm-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="adm-primary" type="submit" disabled={uploading || saving}>
            <Icon name={product ? "check" : "plus"} size={17} />
            {uploading
              ? t("adm.form.reading")
              : saving
                ? t("adm.form.saving")
                : product
                ? t("adm.form.save")
                : t("adm.form.add")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
