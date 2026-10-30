import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { FranjaDemo } from "@/components/franja-demo";
import { Providers } from "@/components/providers";
import { noindexMetadata, siteName } from "@/lib/seo";
import { SCRIPT_DE_TEMA } from "@/lib/tema-inicial";
import { SeguidorDelTema } from "@/lib/tema";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: "%s | Growth",
  },
  description: "Panel interno de Alhabla Growth.",
  applicationName: siteName,
  ...noindexMetadata,
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

// La barra del navegador en el móvil sigue al tema del sistema.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `data-tema` lo pone el script antes de hidratar: React no debe quejarse.
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Antes del primer pintado: sin él, el modo oscuro arrancaría con
            un destello blanco. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DE_TEMA }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SeguidorDelTema />
        <Providers>{children}</Providers>
        <FranjaDemo />
      </body>
    </html>
  );
}
