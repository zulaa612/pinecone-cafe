"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "@/components/icon";
import { signInStaff } from "./actions";

export function StaffSignIn({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(signInStaff, { error: "" });
  return (
    <main className="adm-login">
      <div className="adm-login-story">
        <Link href="/" className="adm-brand"><span className="adm-brand-mark"><Icon name="coffee" size={24} /></span><span>Pine & Pour<span className="adm-brand-sub">COFFEE & LITTLE MOMENTS</span></span></Link>
        <div className="adm-login-quote"><span className="adm-eyebrow">BEHIND EVERY GOOD CUP</span><h1>A little care.<br />A lot of coffee.</h1><p>Your place to keep the good things brewing.</p><span className="adm-login-line" /></div>
        <p className="adm-login-bottom">Made with intention. Served with love.</p>
      </div>
      <div className="adm-login-main">
        <Link href="/" className="adm-back"><Icon name="arrow-left" size={17} /> Back to the café</Link>
        <section className="adm-login-card">
          <span className="adm-lock"><Icon name="lock" size={23} /></span>
          <span className="adm-eyebrow">STAFF ACCESS</span>
          <h2>Welcome behind<br />the counter.</h2>
          <p>Sign in to manage your menu and keep every order moving.</p>
          <form action={action} className="adm-login-form">
            <label htmlFor="staff-password">Staff access code</label>
            <input id="staff-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your access code" required maxLength={256} aria-describedby={state.error ? "staff-error" : demo ? "staff-demo" : undefined} aria-invalid={Boolean(state.error)} />
            {state.error && <p id="staff-error" className="adm-field-error" role="alert">{state.error}</p>}
            <button className="adm-primary" disabled={pending} type="submit">{pending ? "Signing you in…" : "Enter dashboard"}<Icon name="arrow-right" size={17} /></button>
          </form>
          {demo && <div className="adm-demo-note" id="staff-demo"><strong>You’re exploring the demo.</strong><p>Use access code <code>pinecone</code>. Menu and order changes are saved in this browser.</p></div>}
          <p className="adm-login-help">Access is for authorized café staff.<br />Need a hand? Contact your café manager.</p>
        </section>
        <span className="adm-login-copyright">© 2026 Pine & Pour</span>
      </div>
    </main>
  );
}
