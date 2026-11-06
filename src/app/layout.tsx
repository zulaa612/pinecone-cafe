import type { Metadata } from "next";
import { CafeProvider } from "@/components/cafe-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pine & Pour — A little cup of everyday happiness",
  description: "Thoughtfully brewed coffee, fresh pastries, and good little moments. Explore the Pine & Pour menu and order your next favorite for pickup or delivery.",
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
