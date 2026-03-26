import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "@/components/providers";
import { generateTenantMetadata, generateTenantColorsCSS } from "@/lib/tenant-metadata";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = generateTenantMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenantColorsCSS = generateTenantColorsCSS();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Injetar CSS variables do tenant para evitar flash */}
        <style>{tenantColorsCSS}</style>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rastrear" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
