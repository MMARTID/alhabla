import { describe, it, expect } from "vitest";
import { comprobarEntornoDeTest } from "../integration/helpers/entornoDeTest.js";

describe("comprobarEntornoDeTest", () => {
  it("deja pasar la base de test", () => {
    expect(() =>
      comprobarEntornoDeTest({
        DATABASE_URL:
          "postgresql://postgres:postgres@localhost:5432/alhabla_test",
      })
    ).not.toThrow();
  });

  it("se niega a vaciar la base de desarrollo o la de producción", () => {
    expect(() =>
      comprobarEntornoDeTest({
        DATABASE_URL: "postgresql://u:p@postgres:5432/botbook",
      })
    ).toThrow(/no termina en _test/);
  });

  it("sin variables no sigue", () => {
    expect(() => comprobarEntornoDeTest({})).toThrow(/no es una URL válida/);
  });
});
