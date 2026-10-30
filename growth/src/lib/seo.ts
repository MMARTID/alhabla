export const siteName = "Growth | Alhabla";

/**
 * Este panel es interno: fuera del índice de los buscadores. Va con robots.txt
 * abierto (app/robots.ts) y la cabecera `X-Robots-Tag` de next.config.mjs.
 */
export const noindexMetadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false, noarchive: true },
  },
} as const;
