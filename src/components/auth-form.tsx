"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginCustomer, registerCustomer } from "@/app/auth/actions";
import type { FormState } from "@/lib/validation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [state, action, pending] = useActionState(register ? registerCustomer : loginCustomer, {} as FormState);
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="auth-back">← Back to the café</Link>
        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p>{register ? "Choose your role so we can show the right pricing and checkout details." : "Sign in to order, track and review."}</p>
        <form action={action} className="auth-form" noValidate={false}>
          {register && (
            <label>Full name
              <input name="name" autoComplete="name" required minLength={2} maxLength={80} aria-invalid={Boolean(fieldError("name"))} />
              {fieldError("name") && <small role="alert">{fieldError("name")}</small>}
            </label>
          )}
          <label>Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(fieldError("email"))} />
            {fieldError("email") && <small role="alert">{fieldError("email")}</small>}
          </label>
          <label>Password
            <input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 8 : 1} maxLength={256} aria-invalid={Boolean(fieldError("password"))} />
            {fieldError("password") && <small role="alert">{fieldError("password")}</small>}
          </label>
          {register && (
            <fieldset className="auth-roles">
              <legend>I am a…</legend>
              <label><input type="radio" name="customerType" value="student" defaultChecked /> <span><strong>Student</strong><small>Standard pricing</small></span></label>
              <label><input type="radio" name="customerType" value="teacher" /> <span><strong>Teacher</strong><small>50% discount, applied automatically</small></span></label>
            </fieldset>
          )}
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          <button type="submit" disabled={pending}>{pending ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
        </form>
        <p className="auth-switch">
          {register ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New here? <Link href="/register">Create an account</Link></>}
        </p>
      </section>
    </main>
  );
}
