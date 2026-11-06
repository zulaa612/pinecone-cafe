"use client";

import { useEffect, useRef, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";

export function Modal({ title, onClose, children, className = "", footer }: { title: string; onClose: () => void; children: ReactNode; className?: string; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
    const timer = setTimeout(() => focusable()[0]?.focus(), 20);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const list = focusable();
      if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length - 1]?.focus(); }
      else if (!e.shiftKey && document.activeElement === list[list.length - 1]) { e.preventDefault(); list[0]?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { clearTimeout(timer); document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div className={`modal-overlay ${className.includes("drawer") ? "drawer-overlay" : ""}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div><div className="modal-content">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>, document.body);
}
