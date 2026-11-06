import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { StaffSignIn } from "./sign-in";
import { isStaffAuthenticated } from "./session";

export const metadata: Metadata = {
  title: "Staff dashboard | Pine & Pour",
  robots: { index: false, follow: false },
};

async function StaffArea() {
  if (!(await isStaffAuthenticated())) return <StaffSignIn demo={!process.env.ADMIN_PASSWORD} />;
  return <AdminDashboard demo={!process.env.ADMIN_PASSWORD} />;
}

export default function AdminPage() {
  return <Suspense fallback={<main className="adm-loading"><span className="adm-loading-dot" /><p>Opening the café dashboard…</p></main>}><StaffArea /></Suspense>;
}
