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

const categories: Product["category"][] = ["Coffee", "Non-Coffee", "Meal"];
const statuses = ["pending", "preparing", "ready", "completed"] as const;
const statusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "In preparation",
  ready: "Ready to go",
  completed: "Completed",
  cancelled: "Cancelled",
};
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};
const nextLabels: Record<OrderStatus, string> = {
  pending: "Start preparing",
  preparing: "Mark as ready",
  ready: "Complete order",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function AdminDashboard({ demo }: { demo: boolean }) {
  const {
    products,
    orders,
    addProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
  } = useCafe();
  const [tab, setTab] = useState<"orders" | "menu">("menu");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
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
      (category === "All categories" || product.category === category) &&
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
        `${product.name} ${editing === "new" ? "added to" : "updated on"} the menu.`,
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
            <span className="adm-brand-sub">COFFEE & LITTLE MOMENTS</span>
          </span>
        </Link>
        <span className="adm-access-label">
          <span /> ADMIN SECTION
        </span>
        <nav className="adm-navigation" aria-label="Admin navigation">
          <button
            className={
              tab === "orders" ? "adm-nav-item adm-nav-active" : "adm-nav-item"
            }
            aria-current={tab === "orders" ? "page" : undefined}
            onClick={() => setTab("orders")}
          >
            <Icon name="receipt" size={20} />
            Order board
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
            Menu management
          </button>
        </nav>
        <div className="adm-sidebar-bottom">
          <div className="adm-sidebar-card">
            <span>GOOD THINGS ARE BREWING</span>
            <p>A well-run café starts with a little care.</p>
            <Icon name="coffee" size={30} />
          </div>
          <Link href="/" className="adm-nav-item">
            <Icon name="arrow-left" size={19} />
            Customer section
          </Link>
          <form action={signOutStaff}>
            <button className="adm-nav-item" type="submit">
              <Icon name="log-out" size={19} />
              Sign out
            </button>
          </form>
          <div className="adm-staff-profile">
            <span>PP</span>
            <div>
              <strong>Pine & Pour team</strong>
              <small>Administrator</small>
            </div>
            <span className="adm-online-dot" />
          </div>
        </div>
      </aside>

      <div className="adm-workspace">
        <header className="adm-topbar">
          <div>
            <span className="adm-topbar-label">YOUR CA</span>
            <span className="adm-topbar-title">Admin dashboard</span>
          </div>
          <div className="adm-topbar-right">
            {demo && <span className="adm-demo-pill">Demo workspace</span>}
            <span className="adm-live-pill">
              <span />
              Café is open
            </span>
            <span className="adm-avatar">PP</span>
          </div>
        </header>
        <main className="adm-main">
          <div className="adm-page-heading">
            <div>
              <span className="adm-eyebrow">
                A LITTLE ORGANIZATION. A LOT OF GOOD COFFEE.
              </span>
              <h1>
                {tab === "orders"
                  ? "Keep the good things moving."
                  : "Something for every craving."}
              </h1>
              <p>
                {tab === "orders"
                  ? "Every order is a chance to make someone’s day."
                  : "Craft your menu, from the first sip to the last bite."}
              </p>
            </div>
            {tab === "menu" && (
              <button className="adm-primary" onClick={() => setEditing("new")}>
                <Icon name="plus" size={18} />
                Add new product
              </button>
            )}
          </div>
          {demo && (
            <div className="adm-workspace-note">
              <Icon name="lock" size={15} />
              <span>
                Demo workspace · Menu and order changes are saved in this
                browser.
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
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <Icon name="close" size={16} />
                </button>
              </>
            )}
          </div>
          <section className="adm-stats" aria-label="Café statistics">
            <Stat
              label="Active orders"
              value={String(activeOrders.length).padStart(2, "0")}
              caption="A little happiness in the making"
              icon="receipt"
            />
            <Stat
              label="Ready for collection"
              value={String(
                orders.filter((order) => order.status === "ready")
                  .length,
              ).padStart(2, "0")}
              caption="Freshly made and ready to go"
              icon="check"
            />
            <Stat
              label="Completed sales"
              value={money(revenue)}
              caption="From completed orders"
              icon="coffee"
            />
            <Stat
              label="On the menu"
              value={String(products.length).padStart(2, "0")}
              caption={`${products.filter((product) => product.available).length} delicious things available`}
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
                    The order board <span>{orders.length}</span>
                  </h2>
                  <p>From a fresh order to a happy customer.</p>
                </div>
                <span className="adm-updated">
                  <span />
                  Updates saved automatically
                </span>
              </div>
              <div className="adm-board">
                {statuses.map((status) => (
                  <section
                    key={status}
                    className={`adm-column adm-column-${status.toLowerCase()}`}
                    aria-label={`${statusLabels[status]} orders`}
                  >
                    <div className="adm-column-heading">
                      <span className="adm-status-dot" />
                      <h3>{statusLabels[status]}</h3>
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
                                  `Order ${order.id} moved to ${statusLabels[next].toLowerCase()}.`,
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
                              ? "Ready for the next good thing."
                              : `No ${statusLabels[status].toLowerCase()} orders yet.`}
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
                    Your menu <span>{products.length}</span>
                  </h2>
                  <p>Little details. Delicious possibilities.</p>
                </div>
              </div>
              <div className="adm-menu-toolbar">
                <label className="adm-search">
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find something on the menu…"
                    aria-label="Search menu products"
                  />
                </label>
                <select
                  aria-label="Filter products by category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option>All categories</option>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="adm-table-scroll">
                <table className="adm-product-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Category</th>
                      <th scope="col">Price</th>
                      <th scope="col">Availability</th>
                      <th scope="col">
                        <span className="adm-sr-only">Actions</span>
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
                            {product.category}
                          </span>
                        </td>
                        <td className="adm-price">{money(product.price)}</td>
                        <td>
                          <button
                            className={`adm-availability ${product.available ? "adm-available" : ""}`}
                            aria-label={`${product.name}: ${product.available ? "available" : "unavailable"}. Toggle availability`}
                            aria-pressed={product.available}
                            onClick={async () => {
                              const { id, rating, reviewCount, badge, ...rest } = product;
                              void rating; void reviewCount; void badge;
                              await report(
                                await updateProduct(id, { ...rest, available: !product.available }),
                                `${product.name} is now ${product.available ? "unavailable" : "available"}.`,
                              );
                            }}
                          >
                            <span />
                            {product.available ? "Available" : "Sold out"}
                          </button>
                        </td>
                        <td>
                          <div className="adm-row-actions">
                            <button
                              aria-label={`Edit ${product.name}`}
                              title="Edit product"
                              onClick={() => setEditing(product)}
                            >
                              <Icon name="edit" size={17} />
                            </button>
                            <button
                              className="adm-delete-action"
                              aria-label={`Delete ${product.name}`}
                              title="Delete product"
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
                        ? "No products found"
                        : "Your first product starts here."}
                    </h3>
                    <p>
                      {products.length
                        ? "Try another search or category."
                        : "Add a product to make it available in the customer section."}
                    </p>
                    {products.length ? (
                      <button
                        className="adm-secondary"
                        onClick={() => {
                          setSearch("");
                          setCategory("All categories");
                        }}
                      >
                        Clear filters
                      </button>
                    ) : (
                      <button
                        className="adm-primary"
                        onClick={() => setEditing("new")}
                      >
                        <Icon name="plus" size={17} />
                        Add your first product
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="adm-table-footer">
                Showing {visibleProducts.length} of {products.length} menu items
                <span>Thoughtfully made. Always.</span>
              </div>
            </section>
          )}
          <footer className="adm-footer">
            <span>© 2026 Pine & Pour</span>
            <span>Good coffee. Good company. Good days.</span>
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
          title="Take this off the menu?"
          onClose={() => setDeleting(null)}
          className="adm-confirm-modal"
        >
          <p className="adm-modal-copy">
            <strong>{deleting.name}</strong> will be removed from your menu.
            Existing orders will keep their original item details.
          </p>
          <div className="adm-form-actions">
            <button className="adm-secondary" onClick={() => setDeleting(null)}>
              Keep product
            </button>
            <button
              className="adm-danger"
              onClick={async () => {
                await report(
                  await deleteProduct(deleting.id),
                  `${deleting.name} removed from the menu.`,
                );
                setDeleting(null);
              }}
            >
              Remove product
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
  const time = new Date(order.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
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
          {order.customerType === "teacher" ? "Teacher" : "Student"}
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
      {order.classGrade && <p className="adm-order-note">Class: {order.classGrade}</p>}
      {order.location && <p className="adm-order-address">Deliver to: {order.location}</p>}
      {order.discount > 0 && (
        <p className="adm-order-note">
          {money(order.subtotal)} − 50% teacher discount ({money(order.discount)})
        </p>
      )}
      <div className="adm-ticket-total">
        <span>
          {order.items.reduce((total, item) => total + item.quantity, 0)} items
        </span>
        <strong>{money(order.total)}</strong>
      </div>
      <button
        className="adm-order-advance"
        onClick={onAdvance}
        disabled={!nextStatus[status]}
      >
        {nextLabels[status]}
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
      setImageError("Please choose an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setImageError("Choose an image smaller than 1 MB.");
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
      setImageError("We couldn’t read that image. Please try another.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Modal
      title={product ? "A little menu refresh." : "Something new is brewing."}
      onClose={onClose}
      className="adm-product-modal"
    >
      <p className="adm-modal-copy">
        {product
          ? "Make this favorite even better."
          : "Add your next customer favorite to the menu."}
      </p>
      <form className="adm-product-form" onSubmit={submit}>
        <div className="adm-upload-area">
          {image ? (
            <>
              <Image
                src={image}
                alt="Product image preview"
                width={73}
                height={73}
                unoptimized
              />
              <div>
                <strong>Looking delicious.</strong>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  Choose another photo
                </button>
              </div>
            </>
          ) : (
            <>
              <span>
                <Icon name="upload" size={23} />
              </span>
              <div>
                <strong>Add a product photo</strong>
                <p>JPG, PNG or WebP · Up to 1 MB</p>
                <button type="button" onClick={() => fileRef.current?.click()}>
                  Choose image
                </button>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Upload product image"
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </div>
        {imageError && (
          <p className="adm-field-error" role="alert">
            {imageError}
          </p>
        )}
        <label htmlFor="product-name">
          Item name
          <input
            id="product-name"
            name="name"
            defaultValue={product?.name}
            placeholder="e.g. Honey cinnamon latte"
            maxLength={70}
            required
          />
        </label>
        <div className="adm-form-two">
          <label htmlFor="product-category">
            Category
            <select
              id="product-category"
              name="category"
              defaultValue={product?.category || "Coffee"}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label htmlFor="product-price">
            Price ($)
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
          Description
          <textarea
            id="product-description"
            name="description"
            defaultValue={product?.description}
            placeholder="A few delicious details…"
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
          <span>Available for customers to order</span>
        </label>
        <label className="adm-checkbox">
          <input
            name="featured"
            type="checkbox"
            defaultChecked={product?.featured ?? false}
          />
          <span>Featured (shown when there are no recent bestsellers)</span>
        </label>
        {saveError && (
          <p className="adm-field-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="adm-form-actions">
          <button type="button" className="adm-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="adm-primary" type="submit" disabled={uploading || saving}>
            <Icon name={product ? "check" : "plus"} size={17} />
            {uploading
              ? "Reading image…"
              : saving
                ? "Saving…"
                : product
                ? "Save changes"
                : "Add to menu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
