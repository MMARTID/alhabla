import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import nextConfig from "../../next.config.mjs";

// La app no se indexa, pero se deja rastrear: si robots.txt la bloquea, los
// buscadores no ven el noindex y la URL sale igual, sin descripción
// (Search Console «Bloqueada por robots.txt», 2026-10-22).
describe("robots de la app", () => {
  it("deja rastrear todo", () => {
    expect(robots().rules).toEqual([{ userAgent: "*", allow: "/" }]);
  });

  it("marca todas las respuestas con X-Robots-Tag noindex", async () => {
    const reglas = await nextConfig.headers();
    expect(reglas).toContainEqual({
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    });
  });
});
