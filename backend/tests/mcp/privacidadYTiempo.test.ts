import { describe, expect, it } from "vitest";
import {
  enmascararEnTodo,
  enmascararTelefonos,
  recortar,
} from "../../mcp/privacidad.js";
import { momentoDesde } from "../../mcp/tiempo.js";

describe("enmascararTelefonos", () => {
  it("deja el prefijo y las 3 últimas cifras de cada número E.164", () => {
    expect(
      enmascararTelefonos("Cliente +34600123572 llamó a +34930453219.")
    ).toBe("Cliente +34••••••572 llamó a +34••••••219.");
  });

  it("no toca lo que no empieza por +: ids, horas, importes", () => {
    const texto = "cmu7201ag001is601 a las 09:00, 4000 céntimos, 917657561";
    expect(enmascararTelefonos(texto)).toBe(texto);
  });

  it("recorre objetos y listas sin tocar lo que no es texto", () => {
    expect(
      enmascararEnTodo({
        a: ["+34600123572", 3],
        b: { c: "tel +34691325557", d: null, e: true },
      })
    ).toEqual({
      a: ["+34••••••572", 3],
      b: { c: "tel +34••••••557", d: null, e: true },
    });
  });
});

describe("recortar", () => {
  it("dice cuánto medía lo recortado", () => {
    expect(recortar("abcdef", 3)).toBe("abc… (6 caracteres)");
    expect(recortar("abc", 3)).toBe("abc");
  });
});

describe("momentoDesde", () => {
  const ahora = Date.parse("2026-10-15T12:00:00Z");

  it("acepta duraciones en segundos, minutos, horas y días", () => {
    expect(momentoDesde("30s", ahora)).toBe("2026-10-15T11:59:30.000Z");
    expect(momentoDesde("10m", ahora)).toBe("2026-10-15T11:50:00.000Z");
    expect(momentoDesde("2h", ahora)).toBe("2026-10-15T10:00:00.000Z");
    expect(momentoDesde("1d", ahora)).toBe("2026-10-14T12:00:00.000Z");
  });

  it("acepta una fecha ISO y la normaliza", () => {
    expect(momentoDesde("2026-10-14T00:15:00Z", ahora)).toBe(
      "2026-10-14T00:15:00.000Z"
    );
    expect(momentoDesde("2026-10-14", ahora)).toBe("2026-10-14T00:00:00.000Z");
  });

  it("rechaza todo lo demás: nada raro llega a un filtro de Cloud Logging", () => {
    for (const malo of ['1h" OR true', "ayer", "10 min", "", "2026-13-45"]) {
      expect(() => momentoDesde(malo, ahora), malo).toThrow(
        /no es una duración/
      );
    }
  });
});
