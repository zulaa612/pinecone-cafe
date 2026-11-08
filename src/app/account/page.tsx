import type { Metadata } from "next";
import { AccountPage } from "@/components/account-page";

export const metadata: Metadata = { title: "My account | Pinecone cafe", robots: { index: false } };

export default function Account() {
  return <AccountPage />;
}
