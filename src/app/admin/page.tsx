import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser } from "@/lib/auth/dal";
import { StaffSignIn } from "./sign-in";

export const metadata: Metadata = {
  title: "Staff dashboard | Pine & Pour",
  robots: { index: false, follow: false },
};

async function StaffArea() {
  const user = await getCurrentUser();
  if (!user) return <StaffSignIn />;
  // Signed in but not an admin: send them back to the storefront.
  if (user.role !== "admin") redirect("/");
  return <AdminDashboard demo={false} />;
}

export default function AdminPage() {
  return <Suspense fallback={<main className="adm-loading"><span className="adm-loading-dot" /><p>Opening the café dashboard…</p></main>}><StaffArea /></Suspense>;
}
