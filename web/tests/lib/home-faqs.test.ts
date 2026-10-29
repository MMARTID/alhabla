import { describe, expect, it } from "vitest";
import { HOME_QUICK_FAQS } from "@/lib/home-faqs";

describe("HOME_QUICK_FAQS", () => {
  it("son seis, sin preguntas repetidas", () => {
    expect(HOME_QUICK_FAQS).toHaveLength(6);
    const preguntas = HOME_QUICK_FAQS.map((f) => f.question);
    expect(new Set(preguntas).size).toBe(preguntas.length);
  });

  it("no usan el vocabulario que la web ya no dice", () => {
    const texto = HOME_QUICK_FAQS.map((f) => `${f.question} ${f.answer}`).join(" ");
    for (const prohibida of [/Gestor/, /agenda real/i, /llenar la agenda/i, /virtual/i, /24\/7/]) {
      expect(texto).not.toMatch(prohibida);
    }
  });
});
