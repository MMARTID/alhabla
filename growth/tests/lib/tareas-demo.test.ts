import { beforeEach, describe, expect, it } from "vitest";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  PASOS_GENERICOS_DE_UNA_TAREA,
  TAREAS_INICIALES,
} from "@/lib/demo/tareas-demo";
import {
  CATEGORIAS_DE_TAREA,
  ESTADOS_DE_TAREA,
  ORIGENES_DE_TAREA,
  RESULTADOS_DE_TAREA,
} from "@/lib/types";

/**
 * Las tareas del demo hacen lo mismo que el backend: siembra perezosa e
 * idempotente, transiciones y errores con su código. El reloj se FIJA en cada
 * test: las fechas que se escriben (hechaEn) salen de él, no del reloj real.
 */

let ahora = new Date("2026-10-30T09:00:00.000Z");
let cliente: ClienteGrowth;

function nuevoCliente(): ClienteGrowth {
  return clienteDemo({ retardoMs: 0, ahora: () => ahora });
}

beforeEach(() => {
  ahora = new Date("2026-10-30T09:00:00.000Z");
  cliente = nuevoCliente();
});

async function rechazo(promesa: Promise<unknown>): Promise<ErrorDeCliente> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(ErrorDeCliente);
  return error as ErrorDeCliente;
}

const ALTA = { titulo: "Mi directorio", url: "https://mi.example/alta" };

describe("tareas del demo · la siembra", () => {
  it("la primera lectura siembra las iniciales; las que ya existían no se tocan", async () => {
    const { data } = await cliente.tareas();
    // 11 iniciales + la tuya ya hecha; AlternativeTo ya estaba y no se duplica.
    expect(data).toHaveLength(TAREAS_INICIALES.length + 1);
    expect(data.filter((t) => t.dominio === "alternativeto.net")).toHaveLength(
      1
    );
    expect(data.find((t) => t.dominio === "alternativeto.net")?.estado).toBe(
      "descartada"
    );
    const repo = data.filter((t) => t.origen === "repo");
    expect(repo).toHaveLength(TAREAS_INICIALES.length);
    for (const t of repo.filter((t) => t.dominio !== "alternativeto.net")) {
      expect(t.pasos).toEqual([...PASOS_GENERICOS_DE_UNA_TAREA]);
    }
  });

  it("es idempotente: pedirla otra vez, o varias a la vez, no duplica nada", async () => {
    const [a, b, c] = await Promise.all([
      cliente.tareas(),
      cliente.tareas(),
      cliente.tareas(),
    ]);
    const d = await cliente.tareas();
    for (const lista of [b, c, d]) {
      expect(lista.data.map((t) => t.id)).toEqual(a.data.map((t) => t.id));
    }
    expect(new Set(a.data.map((t) => t.id)).size).toBe(a.data.length);
  });

  it("no pisa lo que has hecho: una descartada o editada sigue como la dejaste", async () => {
    const { data } = await cliente.tareas();
    const g2 = data.find((t) => t.dominio === "g2.com")!;
    await cliente.descartarTarea(g2.id, { nota: "No me interesa." });
    await cliente.editarTarea(g2.id, { titulo: "G2 (editada)" });
    const otra = await cliente.tareas();
    const igual = otra.data.find((t) => t.id === g2.id)!;
    expect(igual).toMatchObject({
      titulo: "G2 (editada)",
      estado: "descartada",
      notaDeResultado: "No me interesa.",
    });
    expect(otra.data.filter((t) => t.origen === "repo")).toHaveLength(
      TAREAS_INICIALES.length
    );
  });

  it("editar el dominio de una sembrada no la vuelve a sembrar", async () => {
    const { data } = await cliente.tareas();
    const g2 = data.find((t) => t.dominio === "g2.com")!;
    await cliente.editarTarea(g2.id, { dominio: "g2.example" });
    expect((await cliente.tareas()).data).toHaveLength(data.length);
  });

  it("Beautymarket llega ya hecha, en revisión, con su nota y su día", async () => {
    const { data } = await cliente.tareas();
    expect(data.find((t) => t.dominio === "beautymarket.es")).toMatchObject({
      estado: "hecha",
      resultado: "en_revision",
      notaDeResultado: "Ficha enviada por el fundador el 31-10-2026.",
      hechaEn: "2026-10-31T12:00:00.000Z",
      categoria: "sector",
      origen: "repo",
    });
  });

  it("orden: las pendientes primero, luego `orden` y título; la API no enseña la identidad de siembra", async () => {
    const { data } = await cliente.tareas();
    const estados = data.map((t) => t.estado);
    const primeraNoPendiente = estados.findIndex((e) => e !== "pendiente");
    expect(
      estados.slice(0, primeraNoPendiente).every((e) => e === "pendiente")
    ).toBe(true);
    expect(estados.slice(primeraNoPendiente)).not.toContain("pendiente");
    const pendientes = data.filter((t) => t.estado === "pendiente");
    expect(pendientes.map((t) => t.orden)).toEqual(
      [...pendientes.map((t) => t.orden)].sort((a, b) => a - b)
    );
    for (const t of data) {
      expect(Object.keys(t).sort()).toEqual(
        [
          "categoria",
          "creadoEn",
          "dominio",
          "estado",
          "hechaEn",
          "id",
          "notaDeResultado",
          "notas",
          "orden",
          "origen",
          "pasos",
          "resultado",
          "titulo",
          "url",
        ].sort()
      );
      expect(CATEGORIAS_DE_TAREA).toContain(t.categoria);
      expect(ESTADOS_DE_TAREA).toContain(t.estado);
      expect(ORIGENES_DE_TAREA).toContain(t.origen);
    }
  });

  it("la respuesta es una copia: cambiarla no cambia el almacén", async () => {
    const { data } = await cliente.tareas();
    data[0].titulo = "Manipulada";
    data[0].pasos.push("Paso falso");
    const otra = await cliente.tareas();
    expect(otra.data[0].titulo).not.toBe("Manipulada");
    expect(otra.data[0].pasos).not.toContain("Paso falso");
  });
});

describe("tareas del demo · alta y edición", () => {
  it("añadir crea una tarea manual pendiente; el dominio sale de la URL sin www.", async () => {
    const nueva = await cliente.anadirTarea({
      ...ALTA,
      url: "https://WWW.Mi.example/alta",
    });
    expect(nueva).toMatchObject({
      titulo: "Mi directorio",
      // La URL se guarda tal cual; el dominio sale de ella, en minúsculas y sin www.
      url: "https://WWW.Mi.example/alta",
      dominio: "mi.example",
      categoria: "otro",
      pasos: [],
      notas: null,
      origen: "manual",
      estado: "pendiente",
      resultado: null,
      notaDeResultado: null,
      hechaEn: null,
    });
    expect(nueva.creadoEn).toBe("2026-10-30T09:00:00.000Z");
    expect((await cliente.tareas()).data.map((t) => t.id)).toContain(nueva.id);
  });

  it("la URL se guarda tal cual, sin quitar utm_, ref ni el ancla (pueden ser parte del enlace de alta)", async () => {
    const url = "https://mi.example/alta?utm_source=alhabla&ref=x#formulario";
    const nueva = await cliente.anadirTarea({ ...ALTA, url });
    expect(nueva.url).toBe(url);
    // Y sin barra final añadida a un dominio pelado.
    expect(
      (await cliente.anadirTarea({ ...ALTA, url: "https://pelado.example" }))
        .url
    ).toBe("https://pelado.example");
  });

  it("el dominio, si llega vacío o null, sale de la URL; si llega mal, 400", async () => {
    for (const dominio of ["", null]) {
      expect((await cliente.anadirTarea({ ...ALTA, dominio })).dominio).toBe(
        "mi.example"
      );
    }
    expect(
      (await cliente.anadirTarea({ ...ALTA, dominio: "WWW.Otro.example" }))
        .dominio
    ).toBe("otro.example");
    for (const dominio of [
      "sin-punto",
      "con espacio.example",
      "https://x.example",
      "  ",
    ]) {
      expect(
        (await rechazo(cliente.anadirTarea({ ...ALTA, dominio }))).estado,
        dominio
      ).toBe(400);
    }
  });

  it("acepta categoría, pasos y notas, y limpia los espacios", async () => {
    const nueva = await cliente.anadirTarea({
      titulo: "  Con todo ",
      url: "https://mi.example/",
      categoria: "asociacion",
      pasos: ["  Abre  ", "Rellena"],
      notas: "  Una nota. ",
    });
    expect(nueva).toMatchObject({
      titulo: "Con todo",
      categoria: "asociacion",
      pasos: ["Abre", "Rellena"],
      notas: "Una nota.",
    });
  });

  it("400 si la URL no es http(s) válida, si lleva usuario o si el título está vacío", async () => {
    for (const url of [
      "ftp://x.example",
      "javascript:alert(1)",
      "no es una url",
      "https://usuario:clave@x.example/",
    ]) {
      const error = await rechazo(cliente.anadirTarea({ ...ALTA, url }));
      expect(error.estado, url).toBe(400);
      expect(error.message).toBe(
        "La URL debe ser http o https y sin usuario ni contraseña."
      );
    }
    expect(
      (await rechazo(cliente.anadirTarea({ ...ALTA, titulo: " " }))).estado
    ).toBe(400);
  });

  it("400 por los topes: título de 200, 12 pasos de 300 y notas de 1.000", async () => {
    expect(
      (await rechazo(cliente.anadirTarea({ ...ALTA, titulo: "x".repeat(201) })))
        .estado
    ).toBe(400);
    await cliente.anadirTarea({ ...ALTA, titulo: "x".repeat(200) });
    expect(
      (
        await rechazo(
          cliente.anadirTarea({
            ...ALTA,
            pasos: Array.from({ length: 13 }, () => "p"),
          })
        )
      ).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.anadirTarea({ ...ALTA, pasos: ["x".repeat(301)] })
        )
      ).estado
    ).toBe(400);
    expect(
      (await rechazo(cliente.anadirTarea({ ...ALTA, pasos: [" "] }))).estado
    ).toBe(400);
    expect(
      (await rechazo(cliente.anadirTarea({ ...ALTA, notas: "x".repeat(1001) })))
        .estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.anadirTarea({
            ...ALTA,
            categoria: "inventada" as unknown as "otro",
          })
        )
      ).estado
    ).toBe(400);
  });

  it("editar cambia solo lo que llega; sin ningún campo, 400; notas null las borra", async () => {
    const nueva = await cliente.anadirTarea({ ...ALTA, notas: "Vieja" });
    const editada = await cliente.editarTarea(nueva.id, {
      titulo: "Otro título",
      pasos: ["Uno"],
      notas: null,
    });
    expect(editada).toMatchObject({
      titulo: "Otro título",
      pasos: ["Uno"],
      notas: null,
      url: ALTA.url,
      dominio: "mi.example",
    });
    expect((await rechazo(cliente.editarTarea(nueva.id, {}))).estado).toBe(400);
  });

  it("editar la URL a otro sitio recalcula el dominio; a otra página del mismo, lo deja", async () => {
    const nueva = await cliente.anadirTarea({
      ...ALTA,
      dominio: "mi.example",
      url: "https://sell.mi.example/",
    });
    expect(
      (await cliente.editarTarea(nueva.id, { url: "https://mi.example/otra" }))
        .dominio
    ).toBe("mi.example");
    expect(
      (
        await cliente.editarTarea(nueva.id, {
          url: "https://www.nuevo.example/",
        })
      ).dominio
    ).toBe("nuevo.example");
    expect(
      (
        await cliente.editarTarea(nueva.id, {
          url: "https://www.otro.example/",
          dominio: null,
        })
      ).dominio
    ).toBeNull();
  });

  it("editar valida todo antes de tocar nada", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    await rechazo(
      cliente.editarTarea(nueva.id, { titulo: "Nuevo", url: "ftp://mal" })
    );
    expect(
      (await cliente.tareas()).data.find((t) => t.id === nueva.id)?.titulo
    ).toBe("Mi directorio");
  });

  it("una tarea que no existe: 404 en todo", async () => {
    for (const llamada of [
      () => cliente.editarTarea("no", { titulo: "x" }),
      () => cliente.marcarTareaHecha("no", {}),
      () => cliente.descartarTarea("no", {}),
      () => cliente.reabrirTarea("no"),
      () => cliente.borrarTarea("no"),
    ]) {
      const error = await rechazo(llamada());
      expect(error.estado).toBe(404);
      expect(error.message).toBe("La tarea no existe.");
    }
  });
});

describe("tareas del demo · estados", () => {
  it("pendiente → hecha (con resultado, nota y la hora del reloj) → reabrir (limpia resultado y fecha, conserva la nota)", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    const hecha = await cliente.marcarTareaHecha(nueva.id, {
      resultado: "alta_creada",
      nota: "Gratis.",
    });
    expect(hecha).toMatchObject({
      estado: "hecha",
      resultado: "alta_creada",
      notaDeResultado: "Gratis.",
      hechaEn: "2026-10-30T09:00:00.000Z",
    });
    ahora = new Date("2026-11-02T10:00:00.000Z");
    const reabierta = await cliente.reabrirTarea(nueva.id);
    expect(reabierta).toMatchObject({
      estado: "pendiente",
      resultado: null,
      hechaEn: null,
      notaDeResultado: "Gratis.",
    });
  });

  it("marcar hecha sin resultado ni nota es válido", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    expect(await cliente.marcarTareaHecha(nueva.id, {})).toMatchObject({
      estado: "hecha",
      resultado: null,
      notaDeResultado: null,
    });
  });

  it("marcar hecha es idempotente: no cambia hechaEn y solo completa lo que llega", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    await cliente.marcarTareaHecha(nueva.id, {});
    ahora = new Date("2026-11-05T10:00:00.000Z");
    const otra = await cliente.marcarTareaHecha(nueva.id, {
      resultado: "en_revision",
    });
    expect(otra).toMatchObject({
      estado: "hecha",
      hechaEn: "2026-10-30T09:00:00.000Z",
      resultado: "en_revision",
    });
    const repetida = await cliente.marcarTareaHecha(nueva.id, {});
    expect(repetida).toEqual(otra);
  });

  it("400 con un resultado desconocido o una nota de más de 500 caracteres", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    expect(
      (
        await rechazo(
          cliente.marcarTareaHecha(nueva.id, {
            resultado: "inventado" as unknown as "otro",
          })
        )
      ).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.marcarTareaHecha(nueva.id, { nota: "x".repeat(501) })
        )
      ).estado
    ).toBe(400);
    expect(
      (await cliente.tareas()).data.find((t) => t.id === nueva.id)?.estado
    ).toBe("pendiente");
    for (const resultado of RESULTADOS_DE_TAREA) {
      const otra = await cliente.anadirTarea(ALTA);
      expect(
        (await cliente.marcarTareaHecha(otra.id, { resultado })).resultado
      ).toBe(resultado);
    }
  });

  it("descartar guarda el motivo, limpia el resultado y es idempotente; se puede reabrir", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    await cliente.marcarTareaHecha(nueva.id, { resultado: "otro" });
    const descartada = await cliente.descartarTarea(nueva.id, {
      nota: "Pedía pago.",
    });
    expect(descartada).toMatchObject({
      estado: "descartada",
      resultado: null,
      hechaEn: null,
      notaDeResultado: "Pedía pago.",
    });
    expect(await cliente.descartarTarea(nueva.id, {})).toEqual(descartada);
    expect(await cliente.reabrirTarea(nueva.id)).toMatchObject({
      estado: "pendiente",
    });
  });

  it("una descartada se puede marcar como hecha", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    await cliente.descartarTarea(nueva.id, {});
    expect(
      await cliente.marcarTareaHecha(nueva.id, { resultado: "rechazada" })
    ).toMatchObject({ estado: "hecha", resultado: "rechazada" });
  });
});

describe("tareas del demo · borrar", () => {
  it("borra una manual (204, sin cuerpo)", async () => {
    const nueva = await cliente.anadirTarea(ALTA);
    await expect(cliente.borrarTarea(nueva.id)).resolves.toBeUndefined();
    expect((await cliente.tareas()).data.map((t) => t.id)).not.toContain(
      nueva.id
    );
    expect((await rechazo(cliente.borrarTarea(nueva.id))).estado).toBe(404);
  });

  it("409 tarea_del_repositorio con una sembrada, y sigue ahí", async () => {
    const { data } = await cliente.tareas();
    const g2 = data.find((t) => t.dominio === "g2.com")!;
    const error = await rechazo(cliente.borrarTarea(g2.id));
    expect(error).toMatchObject({
      estado: 409,
      codigo: "tarea_del_repositorio",
      message:
        "Esta tarea viene del repositorio y no se puede borrar: descártala.",
    });
    expect((await cliente.tareas()).data.map((t) => t.id)).toContain(g2.id);
  });
});
