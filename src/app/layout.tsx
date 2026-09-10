import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "raddi. — the recyclable scrap marketplace",
    template: "%s · raddi.",
  },
  description:
    "A working ledger for households, kabadiwalas, dealers, businesses and recyclers to move ordinary recyclable scrap.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh font-sans text-ink antialiased">
        <ThemeProvider>
          {/* Skip to content — first tab-stop for keyboard users. */}
          <a
            href="#main-content"
            className="focus-ring sr-only rounded-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
          >
            Skip to content
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <div id="main-content" className="flex-1">
              {children}
            </div>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
