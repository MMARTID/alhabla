import { describe, it, expect } from "vitest";
import { absoluteUrl } from "@/lib/seo";

describe("absoluteUrl", () => {
  it("sin NEXT_PUBLIC_SITE_URL configurado, usa https://alhabla.ai", () => {
    // No hay .env.local en el entorno de test: sin el respaldo saldría una
    // ruta relativa y el sitemap dejaría de ser válido.
    expect(absoluteUrl("/planes")).toBe("https://alhabla.ai/planes");
  });

  it("usa '/' como path por defecto", () => {
    expect(absoluteUrl()).toBe("https://alhabla.ai/");
  });
});
