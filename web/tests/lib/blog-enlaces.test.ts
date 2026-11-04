import { describe, expect, it } from "vitest";
import { listarArticulos } from "@/lib/blog";
import {
  ENLACES_DE_SIGUE_LEYENDO,
  GUIAS_POR_SECTOR,
  MINIMO_DE_ENLACES_ENTRANTES,
  SIGUE_LEYENDO,
} from "@/lib/blog-enlaces";
import { SECTORES } from "@/lib/sectores";

const publicados = new Set(listarArticulos().map((a) => a.slug));

describe("enlaces internos del blog", () => {
  it("«Sigue leyendo» a mano: artículos que existen, sin repetidos, sin enlazarse a sí mismo", () => {
    for (const [slug, enlaces] of Object.entries(SIGUE_LEYENDO)) {
      expect(publicados.has(slug), `${slug} no existe`).toBe(true);
      expect(enlaces, slug).toHaveLength(ENLACES_DE_SIGUE_LEYENDO);
      expect(new Set(enlaces).size, `${slug} repite un enlace`).toBe(
        enlaces.length
      );
      expect(enlaces, `${slug} se enlaza a sí mismo`).not.toContain(slug);
      for (const destino of enlaces) {
        expect(publicados.has(destino), `${slug} → ${destino} no existe`).toBe(
          true
        );
      }
    }
  });

  it("cada artículo de la lista recibe enlaces de al menos tres artículos distintos", () => {
    const entrantes = new Map<string, number>();
    for (const slug of Object.keys(SIGUE_LEYENDO)) entrantes.set(slug, 0);
    for (const enlaces of Object.values(SIGUE_LEYENDO)) {
      for (const destino of enlaces) {
        entrantes.set(destino, (entrantes.get(destino) ?? 0) + 1);
      }
    }
    for (const [slug, total] of entrantes) {
      expect(
        total,
        `${slug} solo recibe ${total} enlaces de otros artículos`
      ).toBeGreaterThanOrEqual(MINIMO_DE_ENLACES_ENTRANTES);
    }
  });

  it("las ocho landings de sector tienen sus tres guías, que existen y no se repiten", () => {
    expect(Object.keys(GUIAS_POR_SECTOR).sort()).toEqual(
      Object.keys(SECTORES).sort()
    );
    for (const [sector, guias] of Object.entries(GUIAS_POR_SECTOR)) {
      expect(guias, sector).toHaveLength(3);
      expect(new Set(guias).size, `${sector} repite una guía`).toBe(3);
      for (const slug of guias) {
        expect(publicados.has(slug), `${sector} → ${slug} no existe`).toBe(
          true
        );
      }
    }
  });

  it("entre las landings salen todos los artículos de la lista salvo los que no son de un oficio", () => {
    const enLandings = new Set(Object.values(GUIAS_POR_SECTOR).flat());
    // Ocho landings × tres guías son 24 huecos. El de precios y los dos de
    // la plataforma de WhatsApp (la web y el PC, la API) valen para todos los
    // oficios y no tienen landing propia; se enlazan desde otros artículos.
    const SIN_LANDING = new Set([
      "cuanto-cuesta-una-recepcionista-de-ia",
      "whatsapp-business-web-y-pc",
      "whatsapp-business-api",
    ]);
    for (const slug of Object.keys(SIGUE_LEYENDO)) {
      if (SIN_LANDING.has(slug)) continue;
      expect(enLandings.has(slug), `${slug} no sale en ninguna landing`).toBe(
        true
      );
    }
  });
});
