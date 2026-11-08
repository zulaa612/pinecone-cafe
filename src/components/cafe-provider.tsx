"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as actions from "@/app/actions/cafe";
import type { ActionResult, AppUser, CafeState, CartItem, Order, OrderStatus, Product, Review } from "@/lib/cafe";
import { toCents } from "@/lib/cafe";
import { useI18n } from "@/components/i18n-provider";
import { computePricing } from "@/lib/pricing";

export type ProductInput = Pick<Product, "name" | "description" | "price" | "category" | "image" | "available" | "featured">;
type LoadStatus = "loading" | "ready" | "error";

type CafeContextValue = {
  user: AppUser | null; products: Product[]; orders: Order[]; reviews: Review[]; cart: CartItem[];
  status: LoadStatus; refresh: () => Promise<void>;
  cartCount: number; cartTotal: number;
  /** Preview only. The server recomputes every price and discount when the order is placed. */
  pricing: { subtotal: number; discount: number; total: number };
  addToCart: (id: string) => void;
  setCartQuantity: (id: string, quantity: number) => void;
  placeOrder: (details: { customerName: string; classGrade?: string; location?: string }) => Promise<ActionResult<{ id: string }>>;
  addReview: (review: { productId: string; rating: number; comment: string }) => Promise<ActionResult>;
  addProduct: (product: ProductInput) => Promise<ActionResult>;
  updateProduct: (id: string, product: ProductInput) => Promise<ActionResult>;
  deleteProduct: (id: string) => Promise<ActionResult>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<ActionResult>;
  deleteReview: (id: string) => Promise<ActionResult>;
};

const CART_KEY = "pine-and-pour-cart";
const LEGACY_KEYS = ["pine-and-pour-v1", "pine-and-pour-v2"];
const POLL_MS = 20_000;
const emptyState: CafeState = { user: null, products: [], orders: [], reviews: [] };
const CafeContext = createContext<CafeContextValue | null>(null);

export function CafeProvider({ sessionKey, children }: { sessionKey: string; children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<CafeState>(emptyState);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [cartLoaded, setCartLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setState(await response.json());
      setStatus("ready");
    } catch {
      // Keep showing the last good data; only flag an error if we never loaded anything.
      setStatus(current => (current === "ready" ? current : "error"));
    }
  }, []);

  // Server data: initial load, refresh on focus, and light polling while the tab is visible.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    const timer = setInterval(onFocus, POLL_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);

  // Sign-in/out changes sessionKey (from the server layout); refetch so the header and orders update at once.
  const lastSessionKey = useRef(sessionKey);
  useEffect(() => {
    if (lastSessionKey.current === sessionKey) return;
    lastSessionKey.current = sessionKey;
    void refresh();
  }, [sessionKey, refresh]);

  // Cart: the only client-side persistence. Legacy localStorage data from the prototype is discarded.
  useEffect(() => {
    try {
      LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
      const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate cart from localStorage after mount
        setCart(saved.filter((i): i is CartItem => typeof i?.productId === "string" && Number.isInteger(i.quantity) && i.quantity > 0).map(i => ({ ...i, quantity: Math.min(99, i.quantity) })));
      }
    } catch { /* Storage is optional. */ }
    setCartLoaded(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== CART_KEY || !event.newValue) return;
      try { const parsed = JSON.parse(event.newValue); if (Array.isArray(parsed)) setCart(parsed); } catch { /* ignore */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (cartLoaded) try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* quota/private mode */ }
  }, [cart, cartLoaded]);

  // Drop cart lines for products that were deleted, once real data has loaded.
  const liveCart = useMemo(
    () => (status === "ready" ? cart.filter(item => state.products.some(p => p.id === item.productId)) : cart),
    [cart, state.products, status],
  );

  const subtotalCents = liveCart.reduce((sum, item) => sum + toCents(state.products.find(p => p.id === item.productId)?.price ?? 0) * item.quantity, 0);
  const priced = computePricing(subtotalCents, state.user?.customerType ?? "student");
  const pricing = { subtotal: priced.subtotalCents / 100, discount: priced.discountCents / 100, total: priced.totalCents / 100 };
  const cartCount = liveCart.reduce((sum, item) => sum + item.quantity, 0);

  const setCartQuantity = (id: string, quantity: number) => setCart(prev => quantity <= 0 ? prev.filter(i => i.productId !== id) : prev.map(i => i.productId === id ? { ...i, quantity: Math.min(99, quantity) } : i));
  const addToCart = (id: string) => setCart(prev => {
    if (!state.products.find(p => p.id === id)?.available) return prev;
    const found = prev.find(i => i.productId === id);
    return found ? prev.map(i => i.productId === id ? { ...i, quantity: Math.min(99, i.quantity + 1) } : i) : [...prev, { productId: id, quantity: 1 }];
  });

  /** Runs a server action, then refreshes server data when it succeeded. */
  async function run<T extends ActionResult<object>>(action: () => Promise<T>): Promise<T> {
    try {
      const result = await action();
      if (result.ok) await refresh();
      return result;
    } catch {
      return { ok: false, error: t("err.network") } as T;
    }
  }

  const value: CafeContextValue = {
    ...state, cart: liveCart, status, refresh, cartCount, cartTotal: pricing.subtotal, pricing, addToCart, setCartQuantity,
    placeOrder: async details => {
      const result = await run(() => actions.placeOrder({ ...details, items: liveCart }));
      if (result.ok) setCart([]);
      return result;
    },
    addReview: review => run(() => actions.submitReview(review)),
    addProduct: product => run(() => actions.createProduct(product)),
    updateProduct: (id, product) => run(() => actions.updateProduct(id, product)),
    deleteProduct: id => run(() => actions.deleteProduct(id)),
    updateOrderStatus: (id, orderStatus) => run(() => actions.updateOrderStatus({ id, status: orderStatus })),
    deleteReview: id => run(() => actions.deleteReview(id)),
  };
  return <CafeContext.Provider value={value}>{children}</CafeContext.Provider>;
}

export function useCafe() {
  const context = useContext(CafeContext);
  if (!context) throw new Error("useCafe must be used inside CafeProvider");
  return context;
}
