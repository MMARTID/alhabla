import { describe, it, expect } from "vitest";
import { NICHE_SLUG_TO_BUSINESS_TYPE } from "@/lib/business-type";
import nextConfig from "../../next.config.mjs";

// La página de cada sector vive en la web (docs/historico/PLAN-APP-DOMINIO.md):
// quien llegue a la app con /<sector> va allí. Pestañas, spa y peluquería
// canina se quedaron sin redirección al añadirse (auditoría del 2026-11-02).
describe("redirecciones de la app a la web", () => {
  it("manda la página de cada sector a la web", async () => {
    const reglas = await nextConfig.redirects();
    for (const sector of Object.keys(NICHE_SLUG_TO_BUSINESS_TYPE)) {
      const regla = reglas.find((r) => r.source === `/${sector}`);
      expect(regla, sector).toBeDefined();
      expect(regla?.destination.endsWith(`/${sector}`), sector).toBe(true);
      expect(regla?.permanent, sector).toBe(true);
    }
  });
});
