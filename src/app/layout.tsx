import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { CafeProvider } from "@/components/cafe-provider";
import { LanguageProvider } from "@/components/i18n-provider";
import { readSessionUserId } from "@/lib/auth/session";
import { getLang } from "@/lib/i18n-server";
import "./globals.css";
import "./storefront.css";

export const metadata: Metadata = {
  title: "Pinecone cafe",
  description: "Thoughtfully brewed coffee, fresh treats and a well-earned break. Order at Pinecone cafe. / Кофе, хоол, амралт — Pinecone cafe.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#16110d" },
  ],
};

/**
 * Runs synchronously while the HTML is parsed, before first paint: applies the saved
 * (or system) theme and the saved language to <html> so nothing flashes on load.
 */
const initScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("pine-theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;d.style.colorScheme=t;var m=document.cookie.match(/(?:^|; )lang=(mn|en)/);if(m)d.lang=m[1]}catch(e){}})()`;

/** Reads the language cookie at request time, so it must sit behind Suspense. */
async function LocaleShell({ children }: { children: ReactNode }) {
  const [lang, sessionKey] = await Promise.all([getLang(), readSessionUserId()]);
  // sessionKey changes when a server action signs the visitor in or out, which tells the client to refetch.
  return (
    <LanguageProvider initialLang={lang}>
      <CafeProvider sessionKey={sessionKey ?? ""}>{children}</CafeProvider>
    </LanguageProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <LocaleShell>{children}</LocaleShell>
        </Suspense>
      </body>
    </html>
  );
}
