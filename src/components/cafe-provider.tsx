"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialProducts, initialReviews, initialOrders, type Product, type Order, type Review, type CartItem, type OrderDetails, type OrderStatus } from "@/lib/cafe";

type CafeData = { products: Product[]; orders: Order[]; reviews: Review[]; cart: CartItem[] };
type CafeContextValue = CafeData & {
  cartCount: number; cartTotal: number; addToCart: (id: string) => void;
  setCartQuantity: (id: string, quantity: number) => void;
  placeOrder: (details: OrderDetails) => string;
  addReview: (review: Omit<Review, "id" | "date">) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
};
const initialData: CafeData = { products: initialProducts, orders: initialOrders, reviews: initialReviews, cart: [] };
const storageKey = "pine-and-pour-v2";
const CafeContext = createContext<CafeContextValue | null>(null);

export function CafeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CafeData>(initialData);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const current = localStorage.getItem(storageKey);
      const saved = current ?? localStorage.getItem("pine-and-pour-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.products) && Array.isArray(parsed.orders) && Array.isArray(parsed.reviews) && Array.isArray(parsed.cart)) {
          if (!current) {
            // Remove the earlier preview's sample records, preserving admin-created data.
            parsed.products = parsed.products.filter((p: Product) => !/^p[1-8]$/.test(p.id));
            parsed.orders = parsed.orders.filter((o: Order) => !["PP-1040", "PP-1041", "PP-1042"].includes(o.id));
            parsed.reviews = parsed.reviews.filter((r: Review) => !/^r[1-3]$/.test(r.id));
            parsed.cart = parsed.cart.filter((item: CartItem) => parsed.products.some((p: Product) => p.id === item.productId));
          }
          setData(parsed);
        }
      }
    } catch { /* Storage is optional; the session still works without it. */ }
    setLoaded(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed.products) && Array.isArray(parsed.orders) && Array.isArray(parsed.reviews) && Array.isArray(parsed.cart)) setData(parsed);
      } catch { /* Ignore malformed storage from another tab. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* Private browsing or storage quota may prevent persistence. */ }
    }
  }, [data, loaded]);
  const cartTotal = data.cart.reduce((sum, item) => sum + (data.products.find(p => p.id === item.productId)?.price ?? 0) * item.quantity, 0);
  const cartCount = data.cart.reduce((sum, item) => sum + item.quantity, 0);
  const setCartQuantity = (id: string, quantity: number) => setData(prev => ({ ...prev, cart: quantity <= 0 ? prev.cart.filter(item => item.productId !== id) : prev.cart.map(item => item.productId === id ? { ...item, quantity: Math.min(99, quantity) } : item) }));
  const addToCart = (id: string) => setData(prev => {
    if (!prev.products.find(p => p.id === id)?.available) return prev;
    const found = prev.cart.find(item => item.productId === id);
    return { ...prev, cart: found ? prev.cart.map(item => item.productId === id ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item) : [...prev.cart, { productId: id, quantity: 1 }] };
  });
  const placeOrder = (details: OrderDetails) => {
    const id = `PP-${Date.now().toString().slice(-6)}`;
    const items = data.cart.flatMap(item => {
      const product = data.products.find(p => p.id === item.productId && p.available);
      return product ? [{ product: { ...product }, quantity: item.quantity }] : [];
    });
    if (!items.length) throw new Error("Your bag is empty. Add a favorite before placing an order.");
    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) + (details.fulfillment === "delivery" ? 3.5 : 0);
    const order: Order = { ...details, id, items, total, status: "Pending", createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, orders: [order, ...prev.orders], cart: [] }));
    return id;
  };
  const value: CafeContextValue = {
    ...data, cartTotal, cartCount, addToCart, setCartQuantity, placeOrder,
    addReview: review => setData(prev => ({ ...prev, reviews: [{ ...review, id: crypto.randomUUID(), date: new Date().toISOString() }, ...prev.reviews] })),
    addProduct: product => setData(prev => ({ ...prev, products: [...prev.products, { ...product, id: crypto.randomUUID() }] })),
    updateProduct: (id, product) => setData(prev => ({ ...prev, products: prev.products.map(p => p.id === id ? { ...p, ...product } : p) })),
    deleteProduct: id => setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id), cart: prev.cart.filter(item => item.productId !== id) })),
    updateOrderStatus: (id, status) => setData(prev => ({ ...prev, orders: prev.orders.map(order => order.id === id ? { ...order, status } : order) })),
  };
  return <CafeContext.Provider value={value}>{children}</CafeContext.Provider>;
}

export function useCafe() {
  const context = useContext(CafeContext);
  if (!context) throw new Error("useCafe must be used inside CafeProvider");
  return context;
}
