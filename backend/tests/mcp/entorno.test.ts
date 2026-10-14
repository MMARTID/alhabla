import { afterEach, describe, expect, it } from "vitest";
import { exigirUrlLocal, urlDeBdDeDev } from "../../mcp/entorno.js";

afterEach(() => {
  delete process.env.ALHABLA_DEV_DB_PORT;
});

describe("urlDeBdDeDev", () => {
  it("traduce el host de Compose a localhost:5433, el puerto publicado en el Mac", () => {
    const url = urlDeBdDeDev({
      DATABASE_URL: "postgresql://postgres:secreto@postgres:5432/botbook",
    });
    expect(url).toBe("postgresql://postgres:secreto@localhost:5433/botbook");
  });

  it("respeta ALHABLA_DEV_DB_PORT", () => {
    process.env.ALHABLA_DEV_DB_PORT = "5432";
    const url = urlDeBdDeDev({
      DATABASE_URL: "postgresql://postgres:secreto@postgres:5432/botbook",
    });
    expect(new URL(url).port).toBe("5432");
  });

  it("deja pasar una URL que ya es local", () => {
    const url = urlDeBdDeDev({
      DATABASE_URL: "postgresql://postgres:secreto@127.0.0.1:5433/botbook",
    });
    expect(new URL(url).hostname).toBe("127.0.0.1");
  });

  it("se niega con una BD remota: un .env mal copiado no llega a producción", () => {
    expect(() =>
      urlDeBdDeDev({
        DATABASE_URL: "postgresql://postgres:x@10.20.0.3:5432/alhabla",
      })
    ).toThrow(/no es local/);
  });

  it("se niega con ?host=: el socket de Cloud SQL manda sobre «localhost»", () => {
    expect(() =>
      urlDeBdDeDev({
        DATABASE_URL:
          "postgresql://postgres:x@localhost/alhabla?host=/cloudsql/p:europe-west1:alhabla-db",
      })
    ).toThrow(/no es local \(\/cloudsql/);
  });

  it("sin DATABASE_URL falla con un mensaje claro", () => {
    expect(() => urlDeBdDeDev({})).toThrow(/Falta DATABASE_URL/);
  });
});

describe("exigirUrlLocal", () => {
  it("acepta localhost y 127.0.0.1", () => {
    expect(exigirUrlLocal("http://localhost:3010").port).toBe("3010");
    expect(exigirUrlLocal("http://127.0.0.1:3000").hostname).toBe("127.0.0.1");
  });

  it("rechaza cualquier otro host, también el túnel de dev", () => {
    expect(() => exigirUrlLocal("https://dev-api.alhabla.ai")).toThrow(/no es local/);
    expect(() => exigirUrlLocal("https://api.alhabla.ai")).toThrow(/no es local/);
  });
});
