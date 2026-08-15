import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Outfit } from "next/font/google";

import { isConfigured, missingEnv } from "@/lib/env";
import { SetupRequired } from "@/components/SetupRequired";
import { getLang } from "@/lib/lang";
import { dir, t } from "@/lib/i18n";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/**
 * next/font emits each family as "Outfit, Outfit Fallback" behind one CSS
 * variable. That generated fallback is a local system face which *does* carry
 * Arabic glyphs, so it captured Arabic before the cascade reached IBM Plex
 * Sans Arabic — Arabic silently rendered in the system font.
 *
 * Splitting off the primary name lets the stack be ordered exactly:
 * Outfit (Latin) -> Plex Arabic (Arabic) -> the metric fallbacks.
 */
const primary = (family: string) => family.split(",")[0].trim();

export const metadata: Metadata = {
  title: "قِرطاس · Qirtas",
  description:
    "A QR code for every product on your shelf. Customers scan, buy, and pay you directly.",
};

export const viewport: Viewport = {
  themeColor: "#f2efe8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  const configured = isConfigured();

  return (
    <html
      lang={lang}
      dir={dir(lang)}
      className={`${outfit.variable} ${plexArabic.variable} ${jetbrains.variable}`}
      style={
        {
          "--font-outfit-primary": primary(outfit.style.fontFamily),
          "--font-jetbrains-primary": primary(jetbrains.style.fontFamily),
        } as React.CSSProperties
      }
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          {lang === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
        </a>
        {configured ? children : <SetupRequired missing={missingEnv()} />}
      </body>
    </html>
  );
}
