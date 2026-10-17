import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderSkeleton } from "@/components/header/site-header";
import { OfflineBanner, ServiceWorkerRegister } from "@/components/pwa";
import { Container } from "@/components/ui/primitives";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Sakay: commute routes, fares & answers", template: "%s · Sakay" },
  description:
    "Find jeepney, bus, UV Express, tricycle and train routes with fares and travel times. Ask the community once instead of scrolling through Facebook groups.",
  applicationName: "Sakay",
  appleWebApp: { capable: true, title: "Sakay", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Sakay", locale: "en_PH" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>
        <OfflineBanner />
        <main id="main" className="flex-1 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-sm text-slate-500">
          <Container className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Sakay · Community-made commute guide. Fares and times are estimates.</p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/contributors" className="hover:text-slate-800">
                Contributors
              </Link>
              <Link href="/terminals" className="hover:text-slate-800">
                Terminals
              </Link>
              <Link href="/advisories" className="hover:text-slate-800">
                Advisories
              </Link>
              <a href="https://www.openstreetmap.org/copyright" className="hover:text-slate-800" rel="noreferrer" target="_blank">
                Map data © OpenStreetMap
              </a>
            </nav>
          </Container>
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
