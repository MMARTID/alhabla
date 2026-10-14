import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import {
  borrarClave,
  consumirClave,
  fijarCampo,
  fijarCampoSiNoExiste,
  guardarCampos,
  guardarClave,
  guardarClaveSiNoExiste,
  incrementarContador,
  leerCampos,
  leerClave,
  leerContador,
} from "../../../src/lib/almacenTemporal.js";
import { resetDb } from "../helpers/db.js";
import { createTestBusiness } from "../helpers/fixtures.js";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("clave-valor con caducidad en Postgres (sustituye a SET/GET/GETDEL/HSET de Redis)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("SET y GET: guarda texto tal cual (también JSON y vacío) y lo sustituye", async () => {
    await guardarClave("k:texto", "hola", 60_000);
    await guardarClave("k:json", JSON.stringify({ a: 1, b: "dos" }), 60_000);
    await guardarClave("k:vacio", "", 60_000);
    expect(await leerClave("k:texto")).toBe("hola");
    expect(JSON.parse((await leerClave("k:json"))!)).toEqual({
      a: 1,
      b: "dos",
    });
    expect(await leerClave("k:vacio")).toBe("");
    expect(await leerClave("k:no-existe")).toBeNull();

    await guardarClave("k:texto", "adiós", 60_000);
    expect(await leerClave("k:texto")).toBe("adiós");
  });

  it("una clave caducada no existe para ninguna lectura, aunque su fila siga", async () => {
    await guardarClave("k:corta", "x", 50);
    await esperar(80);
    expect(await leerClave("k:corta")).toBeNull();
    expect(await consumirClave("k:corta")).toBeNull();
    expect(
      await prisma.claveTemporal.count({ where: { clave: "k:corta" } })
    ).toBe(0);
  });

  it("SET NX: solo la primera gana mientras vive; tras caducar se puede volver a coger", async () => {
    expect(await guardarClaveSiNoExiste("k:nx", "uno", 100)).toBe(true);
    expect(await guardarClaveSiNoExiste("k:nx", "dos", 100)).toBe(false);
    expect(await leerClave("k:nx")).toBe("uno");
    await esperar(130);
    expect(await guardarClaveSiNoExiste("k:nx", "tres", 60_000)).toBe(true);
    expect(await leerClave("k:nx")).toBe("tres");
  });

  it("SET NX a la vez desde 10 sitios: gana exactamente uno", async () => {
    const resultados = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        guardarClaveSiNoExiste("k:carrera", `v${i}`, 60_000)
      )
    );
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it("GETDEL: lee y borra de una vez; dos a la vez, solo uno se lo lleva", async () => {
    await guardarClave("k:unUso", "secreto", 60_000);
    const [a, b] = await Promise.all([
      consumirClave("k:unUso"),
      consumirClave("k:unUso"),
    ]);
    expect([a, b].filter((v) => v === "secreto")).toHaveLength(1);
    expect([a, b].filter((v) => v === null)).toHaveLength(1);
    expect(await leerClave("k:unUso")).toBeNull();
  });

  it("DEL borra; borrar lo que no existe no falla", async () => {
    await guardarClave("k:borrar", "x", 60_000);
    await borrarClave("k:borrar");
    await borrarClave("k:nunca-existio");
    expect(await leerClave("k:borrar")).toBeNull();
  });

  it("HSET + EXPIRE, HSET de un campo, HSETNX y HGETALL", async () => {
    await guardarCampos("k:hash", { id: "c1", linea: "+34900000000" }, 60_000);
    expect(await leerCampos("k:hash")).toEqual({
      id: "c1",
      linea: "+34900000000",
    });

    expect(await fijarCampo("k:hash", "callControlId", "v3:abc")).toBe(true);
    expect(await fijarCampoSiNoExiste("k:hash", "resolucion", "ok")).toBe(true);
    expect(await fijarCampoSiNoExiste("k:hash", "resolucion", "fallo")).toBe(
      false
    );
    expect(await leerCampos("k:hash")).toEqual({
      id: "c1",
      linea: "+34900000000",
      callControlId: "v3:abc",
      resolucion: "ok",
    });

    // HSET de un campo en una clave que no existe no crea nada (sin caducidad).
    expect(await fijarCampo("k:no-hay", "x", "1")).toBe(false);
    expect(await fijarCampoSiNoExiste("k:no-hay", "x", "1")).toBe(false);
    expect(await leerCampos("k:no-hay")).toBeNull();
  });

  it("HSETNX a la vez desde 8 sitios: solo uno escribe el campo", async () => {
    await guardarCampos("k:hashCarrera", { id: "c2" }, 60_000);
    const resultados = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        fijarCampoSiNoExiste("k:hashCarrera", "resolucion", `r${i}`)
      )
    );
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it("guardarCampos en una clave caducada empieza de cero; en una viva, añade", async () => {
    await guardarCampos("k:hash2", { a: "1" }, 50);
    await esperar(80);
    await guardarCampos("k:hash2", { b: "2" }, 60_000);
    expect(await leerCampos("k:hash2")).toEqual({ b: "2" });
    await guardarCampos("k:hash2", { c: "3" }, 60_000);
    expect(await leerCampos("k:hash2")).toEqual({ b: "2", c: "3" });
  });

  it("leerCampos de una clave de texto devuelve null (no es un hash)", async () => {
    await guardarClave("k:texto2", "hola", 60_000);
    expect(await leerCampos("k:texto2")).toBeNull();
    expect(await fijarCampo("k:texto2", "x", "1")).toBe(false);
  });

  it("con businessId, las claves se borran al borrar el negocio", async () => {
    const { id: businessId } = await createTestBusiness();
    await guardarClave("k:negocio", "x", 60_000, { businessId });
    await guardarCampos("k:negocioHash", { a: "1" }, 60_000, { businessId });
    await prisma.business.delete({ where: { id: businessId } });
    expect(await leerClave("k:negocio")).toBeNull();
    expect(await leerCampos("k:negocioHash")).toBeNull();
  });

  it("INCR + EXPIRE en el primero: ventana fija, y GET del contador", async () => {
    expect(await incrementarContador("c:hora", 100)).toBe(1);
    expect(await incrementarContador("c:hora", 100)).toBe(2);
    expect(await leerContador("c:hora")).toBe(2);
    expect(await leerContador("c:nada")).toBe(0);
    await esperar(130);
    expect(await leerContador("c:hora")).toBe(0);
    expect(await incrementarContador("c:hora", 100)).toBe(1);
  });
});
