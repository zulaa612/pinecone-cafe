import type { Metadata } from "next";
import { CafeProvider } from "@/components/cafe-provider";
import "./globals.css";
import "./storefront.css";

export const metadata: Metadata = {
  title: "Pinecone cafe — A good day is brewing",
  description: "Thoughtfully brewed coffee, fresh treats, and a well-earned break. Explore the Pinecone cafe menu and order your next favorite for café pickup.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body><CafeProvider>{children}</CafeProvider></body>
    </html>
  );
}
