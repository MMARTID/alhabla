import { describe, expect, it } from "vitest";
import { REL_EXTERNO, esUrlWeb, urlSegura } from "@/lib/url-segura";

describe("esUrlWeb", () => {
  it("acepta http y https absolutas", () => {
    expect(esUrlWeb("https://alhabla.ai/planes")).toBe(true);
    expect(esUrlWeb("http://ejemplo.example")).toBe(true);
    expect(esUrlWeb("  https://ejemplo.example/con-espacios  ")).toBe(true);
    expect(esUrlWeb("HTTPS://EJEMPLO.EXAMPLE")).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    [" javascript:alert(1)"],
    ["\tjavascript:alert(1)"],
    ["java\nscript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["file:///etc/passwd"],
    ["mailto:alguien@ejemplo.example"],
    ["tel:+34600000000"],
    ["blob:https://ejemplo.example/uuid"],
    ["//ejemplo.example/sin-esquema"],
    ["/ruta/relativa"],
    ["ejemplo.example"],
    [""],
    ["   "],
  ])("rechaza %j", (valor) => {
    expect(esUrlWeb(valor)).toBe(false);
    expect(urlSegura(valor)).toBeNull();
  });

  it("rechaza lo que no es texto", () => {
    expect(esUrlWeb(undefined)).toBe(false);
    expect(esUrlWeb(null)).toBe(false);
    expect(esUrlWeb(42)).toBe(false);
    expect(esUrlWeb({ href: "https://ejemplo.example" })).toBe(false);
  });
});

describe("urlSegura", () => {
  it("devuelve la URL tal como la interpretará el navegador", () => {
    expect(urlSegura(" https://Ejemplo.example/a b ")).toBe(
      "https://ejemplo.example/a%20b"
    );
  });
});

it("los enlaces externos llevan noopener, noreferrer y nofollow", () => {
  expect(REL_EXTERNO.split(" ").sort()).toEqual([
    "nofollow",
    "noopener",
    "noreferrer",
  ]);
});
