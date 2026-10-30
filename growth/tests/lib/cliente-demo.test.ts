import { beforeEach, describe, expect, it } from "vitest";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo, similitudDeTextos } from "@/lib/demo/cliente-demo";
import {
  DEMO_ALHABLA_GROWTH_SENTINELA,
  crearAlmacenDeDemostracion,
} from "@/lib/demo/datos";
import { CORREO_DE_DEMOSTRACION } from "@/lib/modo-demo";
import { ESTADOS_DE_OPORTUNIDAD, type EstadoDeOportunidad } from "@/lib/types";

const DIA = 24 * 60 * 60 * 1000;

let ahora = new Date("2026-10-30T09:00:00.000Z");
let cliente: ClienteGrowth;

function nuevoCliente(vacio = false): ClienteGrowth {
  return clienteDemo({ retardoMs: 0, ahora: () => ahora, vacio });
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

describe("los datos de prueba", () => {
  it("cubren los 13 estados, incluida una bloqueada, una caducada y una que caduca pronto", async () => {
    const almacen = crearAlmacenDeDemostracion({ ahora });
    const estados = new Set(almacen.oportunidades.map((o) => o.estado));
    for (const estado of ESTADOS_DE_OPORTUNIDAD)
      expect(estados).toContain(estado);

    const lista = await cliente.listarOportunidades({ limite: 200 });
    expect(lista.total).toBeGreaterThanOrEqual(10);
    const porId = Object.fromEntries(lista.data.map((o) => [o.id, o]));

    // Bloqueada: reglas duras que fallan.
    const bloqueada = Object.values(porId).find(
      (o) => o.estado === "bloqueada"
    )!;
    expect(bloqueada.borradorActual?.resultado).toBe("bloquea");
    expect(
      bloqueada.borradorActual?.reglasFallidas.some((c) => !c.ok && c.dura)
    ).toBe(true);

    // Por revisar con un aviso blando: la v2 apenas cambió respecto a la v1.
    const conAviso = Object.values(porId).find(
      (o) =>
        o.estado === "pendiente_aprobacion" &&
        o.borradorActual?.resultado === "aviso"
    )!;
    expect(conAviso.borradorActual?.reglasFallidas[0]).toMatchObject({
      regla: "similitud_con_version_anterior",
      dura: false,
      ok: false,
    });
    expect(conAviso.borradorActual?.reglasFallidas[0].detalle).toMatch(
      /^Se parece un \d+ % a una versión anterior de esta misma oportunidad: apenas ha cambiado\.$/
    );

    // Caducada y a punto de caducar.
    const caducada = Object.values(porId).find((o) => o.estado === "caducada")!;
    expect(caducada.diasParaCaducar).toBeLessThan(0);
    const pronto = Object.values(porId).find(
      (o) =>
        o.estado === "pendiente_aprobacion" && (o.diasParaCaducar ?? 99) <= 3
    );
    expect(pronto).toBeDefined();
  });

  it("incluyen un borrador con dos versiones, afirmaciones con fuente y commit, y una investigación", async () => {
    const detalle = await cliente.detalleDeOportunidad("demo-op-05");
    expect(detalle.borradores.map((b) => b.version)).toEqual([2, 1]);
    // El aviso solo salta con el umbral de los ajustes (0,6 por defecto).
    expect(
      detalle.borradores[0].similitudConVersionAnterior
    ).toBeGreaterThanOrEqual(0.6);
    expect(detalle.investigacion?.contexto?.urlContacto).toMatch(/^https:\/\//);
    const citada = detalle.borradores[0].afirmacionesDetalle[0];
    expect(citada).toMatchObject({ existe: true, vigente: true });
    expect(citada.fuente).toMatch(/#/);
    expect(citada.commitSha).toMatch(/^[0-9a-f]{7}$/);
    // Una clave que ya no existe sale como inexistente.
    const bloqueada = await cliente.detalleDeOportunidad("demo-op-07");
    expect(bloqueada.borradores[0].afirmacionesDetalle[0]).toMatchObject({
      clave: "precio.plan.basico_antiguo",
      vigente: false,
      existe: true,
    });
  });

  it("todo está bajo dominios .example y los textos son datos, no código", () => {
    const almacen = crearAlmacenDeDemostracion({ ahora });
    for (const o of almacen.oportunidades) {
      expect(new URL(o.url).hostname.endsWith(".example")).toBe(true);
    }
  });

  it("la sentinela existe y los datos la llevan consigo", () => {
    expect(DEMO_ALHABLA_GROWTH_SENTINELA).toBe("DEMO_ALHABLA_GROWTH_SENTINELA");
    expect(crearAlmacenDeDemostracion({ ahora }).origen).toBe(
      DEMO_ALHABLA_GROWTH_SENTINELA
    );
  });

  it("?vacio=1 deja la Bandeja sin nada pero con los descartes de la semana", async () => {
    const vacio = nuevoCliente(true);
    const lista = await vacio.listarOportunidades({
      estado: [
        "calificada",
        "investigada",
        "pendiente_aprobacion",
        "bloqueada",
        "devuelta",
        "aprobada",
      ],
    });
    expect(lista.total).toBe(0);
    const resumen = await vacio.resumen();
    expect(resumen.paraRevisar).toBe(0);
    expect(resumen.descartesUltimos7Dias.total).toBeGreaterThan(0);
    expect(resumen.descartesUltimos7Dias.porMotivo.length).toBeGreaterThan(0);
    // El historial se conserva.
    expect((await vacio.listarDecisiones()).total).toBeGreaterThan(0);
  });

  it("cada llamada devuelve una copia: tocarla no cambia el almacén", async () => {
    const primera = await cliente.resumen();
    primera.paraRevisar = 999;
    primera.porEstado.aprobada = 999;
    const segunda = await cliente.resumen();
    expect(segunda.paraRevisar).not.toBe(999);
    expect(segunda.porEstado.aprobada).not.toBe(999);
  });
});

describe("lecturas", () => {
  it("yo devuelve el correo de la sesión de demostración", async () => {
    await expect(cliente.yo()).resolves.toEqual({
      email: CORREO_DE_DEMOSTRACION,
    });
  });

  it("la Bandeja ordena por puntuación, y las pestañas cuentan sin el filtro de estado", async () => {
    const lista = await cliente.listarOportunidades({
      estado: ["pendiente_aprobacion", "bloqueada", "aprobada", "calificada"],
      orden: "puntuacion",
    });
    const puntos = lista.data.map((o) => o.puntuacion);
    expect(puntos).toEqual([...puntos].sort((a, b) => b - a));
    // Los conteos no dependen del filtro de estado.
    expect(lista.conteos.porEstado.pendiente_aprobacion).toBe(2);
    expect(lista.conteos.porEstado.descartada).toBeGreaterThan(0);
    expect(Object.keys(lista.conteos.porEstado).sort()).toEqual(
      [...ESTADOS_DE_OPORTUNIDAD].sort()
    );
  });

  it("filtra por objetivo, nicho, fuente y búsqueda, y pagina", async () => {
    const leads = await cliente.listarOportunidades({ objetivo: "LEADS" });
    expect(leads.data.every((o) => o.objetivoPrincipal === "LEADS")).toBe(true);
    const manual = await cliente.listarOportunidades({ fuente: "manual" });
    expect(manual.data.map((o) => o.id)).toEqual(["demo-op-01"]);
    const barberia = await cliente.listarOportunidades({ nicho: "barberia" });
    expect(barberia.data.map((o) => o.id)).toEqual(["demo-op-06"]);
    const busqueda = await cliente.listarOportunidades({ q: "REVISTA-pymes" });
    expect(busqueda.data.map((o) => o.id)).toEqual(["demo-op-05"]);

    const primera = await cliente.listarOportunidades({
      limite: 5,
      pagina: 1,
      orden: "recientes",
    });
    const segunda = await cliente.listarOportunidades({
      limite: 5,
      pagina: 2,
      orden: "recientes",
    });
    expect(primera.data).toHaveLength(5);
    expect(primera.total).toBe(segunda.total);
    expect(primera.data.map((o) => o.id)).not.toEqual(
      segunda.data.map((o) => o.id)
    );
    expect(segunda.pagina).toBe(2);
  });

  it("«caducan» ordena por fecha de caducidad con los nulos al final", async () => {
    const lista = await cliente.listarOportunidades({
      orden: "caducan",
      limite: 200,
    });
    const fechas = lista.data.map((o) =>
      o.expiraEn ? Date.parse(o.expiraEn) : Infinity
    );
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
  });

  it("rechaza una búsqueda de más de 100 caracteres", async () => {
    expect(
      (await rechazo(cliente.listarOportunidades({ q: "x".repeat(101) })))
        .estado
    ).toBe(400);
  });

  it("el detalle calcula las acciones con las precondiciones", async () => {
    const pendiente = await cliente.detalleDeOportunidad("demo-op-06");
    expect(pendiente.acciones.map((a) => a.accion)).toEqual([
      "aprobar",
      "devolver",
      "descartar",
    ]);
    expect(pendiente.acciones.every((a) => a.habilitada)).toBe(true);
    expect(pendiente.borradorEditableId).toBe("demo-bo-06-1");

    const bloqueada = await cliente.detalleDeOportunidad("demo-op-07");
    expect(bloqueada.acciones).toEqual([
      { accion: "descartar", habilitada: true },
    ]);
    expect(bloqueada.borradorEditableId).toBe("demo-bo-07-1");

    const aprobada = await cliente.detalleDeOportunidad("demo-op-09");
    expect(aprobada.acciones.map((a) => a.accion)).toEqual([
      "descartar",
      "marcar_gestionado",
    ]);
    expect(aprobada.borradorEditableId).toBeNull();

    const gestionada = await cliente.detalleDeOportunidad("demo-op-10");
    expect(gestionada.acciones.map((a) => a.accion)).toEqual([
      "conseguido",
      "sin_respuesta",
      "rechazado",
    ]);

    const descartada = await cliente.detalleDeOportunidad("demo-op-13");
    expect(descartada.acciones).toEqual([]);
  });

  it("el detalle de una oportunidad que no existe es un 404", async () => {
    expect(
      (await rechazo(cliente.detalleDeOportunidad("no-existe"))).estado
    ).toBe(404);
    expect((await rechazo(cliente.detalleDeBorrador("no-existe"))).estado).toBe(
      404
    );
    expect(
      (await rechazo(cliente.detalleDeEjecucion("no-existe"))).estado
    ).toBe(404);
    expect(
      (await rechazo(cliente.historialDeAfirmacion("no.existe"))).estado
    ).toBe(404);
  });

  it("los borradores se agrupan y cuentan por estado", async () => {
    const pendientes = await cliente.listarBorradores();
    expect(pendientes.data.map((b) => b.estado)).toEqual([
      "pendiente_aprobacion",
      "pendiente_aprobacion",
    ]);
    expect(pendientes.conteos).toMatchObject({
      bloqueados: 1,
      pendientes: 2,
      aprobados: 1,
      gestionados: 3,
      caducados: 1,
      descartados: 2,
    });
    const bloqueados = await cliente.listarBorradores({ grupo: "bloqueados" });
    expect(bloqueados.data[0].reglasFallidas.length).toBeGreaterThan(0);
    const caducados = await cliente.listarBorradores({ grupo: "caducados" });
    expect(caducados.data.map((b) => b.oportunidad.estado)).toEqual([
      "caducada",
    ]);
    expect(pendientes.data[0].textoPreview.length).toBeLessThanOrEqual(200);
  });

  it("el detalle de un borrador dice si es editable", async () => {
    expect((await cliente.detalleDeBorrador("demo-bo-05-2")).esEditable).toBe(
      true
    );
    expect((await cliente.detalleDeBorrador("demo-bo-05-1")).esEditable).toBe(
      false
    ); // versión vieja
    expect((await cliente.detalleDeBorrador("demo-bo-09-1")).esEditable).toBe(
      false
    ); // aprobado
  });

  it("las decisiones se filtran y se cuentan por acción", async () => {
    const todas = await cliente.listarDecisiones({ limite: 200 });
    const fechas = todas.data.map((d) => Date.parse(d.en));
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    const soloSistema = await cliente.listarDecisiones({ soloSistema: true });
    expect(soloSistema.data.every((d) => d.oportunidad === null)).toBe(true);
    const aprobadas = await cliente.listarDecisiones({ accion: "aprobar" });
    expect(aprobadas.data.every((d) => d.accion === "aprobar")).toBe(true);
    // El conteo por acción no se encoge con el filtro de acción.
    expect(aprobadas.conteos.porAccion.descartar).toBeGreaterThan(0);
    const deUnaOportunidad = await cliente.listarDecisiones({
      oportunidadId: "demo-op-12",
    });
    expect(deUnaOportunidad.data.map((d) => d.accion)).toEqual([
      "rechazado",
      "marcar_gestionado",
      "aprobar",
    ]);
  });

  it("las gestiones traen el borrador y la oportunidad", async () => {
    const gestiones = await cliente.listarGestiones();
    expect(gestiones.total).toBe(3);
    expect(gestiones.conteos.porResultado).toEqual({
      pendiente: 1,
      aceptado: 1,
      rechazado: 1,
    });
    const hecha = gestiones.data.find(
      (g) => g.dominio === "directorio-unas.example"
    )!;
    expect(hecha.borrador.editadoPorHumano).toBe(true);
    expect(hecha.borrador.textoFinal).toContain("salones de uñas");
    expect(
      (await cliente.listarGestiones({ resultado: "aceptado" })).data
    ).toHaveLength(1);
  });

  it("el conocimiento agrupa lo vigente por tipo y no mezcla lo cerrado", async () => {
    const todo = await cliente.conocimiento();
    expect(todo.snapshot).toMatchObject({
      commitSha: "1234abc",
      obsoleto: false,
    });
    expect(todo.snapshot!.vigentes).toBe(
      Object.values(todo.conteos).reduce((a, b) => a + b, 0)
    );
    expect(todo.porTipo.precio.map((a) => a.clave)).toEqual([
      "precio.plan.inicio",
      "precio.plan.pro",
      "precio.plan.scale",
    ]);
    expect(todo.porTipo.prohibida.length).toBeGreaterThan(0);
    expect(
      todo.cambiosRecientes.some(
        (c) => c.cambio === "cierre" && c.clave === "precio.plan.basico_antiguo"
      )
    ).toBe(true);
    const soloPrecios = await cliente.conocimiento("precio");
    expect(soloPrecios.porTipo.precio).toHaveLength(3);
    expect(soloPrecios.porTipo.funcion).toEqual([]);
    expect(soloPrecios.conteos.funcion).toBeGreaterThan(0);
  });

  it("el historial de una clave trae la versión cerrada", async () => {
    const historial = await cliente.historialDeAfirmacion(
      "precio.plan.basico_antiguo"
    );
    expect(historial.versiones).toHaveLength(1);
    expect(historial.versiones[0].vigenteHasta).not.toBeNull();
  });

  it("las ejecuciones traen la duración y los contadores reales", async () => {
    const lista = await cliente.listarEjecuciones();
    expect(lista.data.map((e) => e.estado)).toEqual(["ok", "parcial", "error"]);
    expect(lista.data[0].duracionSegundos).toBe(3600);
    const detalle = await cliente.detalleDeEjecucion("demo-ej-03");
    expect(detalle.oportunidades.length).toBe(lista.data[0].oportunidades);
    expect(detalle.descartesPorMotivo.map((d) => d.codigo)).toContain(
      "irrelevante"
    );
    expect(
      (await cliente.listarEjecuciones({ estado: "error" })).data
    ).toHaveLength(1);
  });

  it("los ajustes traen los valores iniciales de la 1b y los límites", async () => {
    const ajustes = await cliente.ajustes();
    expect(ajustes.valores).toEqual({
      topeSemanal: 5,
      umbralDeSimilitud: 0.6,
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      pausa: false,
    });
    expect(ajustes.limites.topeSemanal).toEqual([0, 20]);
    expect(ajustes.soloLectura).toEqual({
      retencionDias: 180,
      diasEntreContactosAlMismoDominio: 90,
    });
  });

  it("los competidores cuentan sus oportunidades", async () => {
    const { data } = await cliente.competidores();
    expect(data.map((c) => c.nombre)).toEqual([
      "Competidor ficticio",
      "Otra recepcionista (ejemplo)",
    ]);
    expect(data[0].oportunidades).toBe(1);
  });

  it("el resumen cuenta lo que hay y avisa de lo que caduca", async () => {
    const r = await cliente.resumen();
    expect(r.paraRevisar).toBe(2);
    expect(r.bloqueadas).toBe(1);
    expect(r.devueltas).toBe(1);
    expect(r.aprobadasSinGestionar).toBe(1);
    expect(r.porCaducar.map((c) => c.id)).toContain("demo-op-06");
    // Como el backend: `estaSemana` = hechas + aprobadas sin gestionar.
    expect(r.contactos).toEqual({
      estaSemana: 2,
      hechas: 1,
      aprobadasSinGestionar: 1,
      tope: 5,
    });
    expect(r.descartesUltimos7Dias.total).toBe(3);
    expect(r.ultimaEjecucion?.id).toBe("demo-ej-03");
    expect(r.pausa).toBe(false);
  });
});

describe("decidir: la misma tabla de estados que el backend", () => {
  it("aprobar → aprobada, deja una decisión y se ve en el Historial", async () => {
    const respuesta = await cliente.decidir("demo-op-06", {
      accion: "aprobar",
      borradorId: "demo-bo-06-1",
    });
    expect(respuesta).toEqual({ id: "demo-op-06", estado: "aprobada" });

    const detalle = await cliente.detalleDeOportunidad("demo-op-06");
    expect(detalle.estado).toBe("aprobada");
    expect(detalle.borradores[0].estado).toBe("aprobado");
    expect(detalle.decisiones[0]).toMatchObject({
      accion: "aprobar",
      por: CORREO_DE_DEMOSTRACION,
    });

    const historial = await cliente.listarDecisiones({
      oportunidadId: "demo-op-06",
    });
    expect(historial.data[0]).toMatchObject({
      accion: "aprobar",
      oportunidad: { id: "demo-op-06" },
    });
    expect((await cliente.resumen()).aprobadasSinGestionar).toBe(2);
  });

  it("devolver pide un motivo, descarta los borradores abiertos y guarda la nota", async () => {
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-06", { accion: "devolver", motivo: "  " })
        )
      ).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-06", {
            accion: "devolver",
            motivo: "x".repeat(501),
          })
        )
      ).estado
    ).toBe(400);
    await cliente.decidir("demo-op-06", {
      accion: "devolver",
      motivo: "Más corto, por favor",
    });
    const detalle = await cliente.detalleDeOportunidad("demo-op-06");
    expect(detalle.estado).toBe("devuelta");
    expect(detalle.borradores[0].estado).toBe("descartado");
    expect(detalle.decisiones[0].motivo).toBe("Más corto, por favor");
  });

  it("descartar guarda el motivo y el código, y entra en los descartes de la semana", async () => {
    await cliente.decidir("demo-op-02", {
      accion: "descartar",
      motivo: "No encaja",
      codigo: "irrelevante",
    });
    const detalle = await cliente.detalleDeOportunidad("demo-op-02");
    expect(detalle).toMatchObject({
      estado: "descartada",
      motivoDescarte: "No encaja",
    });
    // El código va aparte, no dentro de `datos`.
    expect(detalle.codigoDescarte).toBe("irrelevante");
    expect(detalle.datos).not.toHaveProperty("codigoDescarte");
    const resumen = await cliente.resumen();
    expect(resumen.descartesUltimos7Dias.total).toBe(4);
    expect(
      resumen.descartesUltimos7Dias.porMotivo.find(
        (m) => m.codigo === "irrelevante"
      )?.n
    ).toBe(2);
    // Sin código, «otro».
    await cliente.decidir("demo-op-03", { accion: "descartar", motivo: "Mmm" });
    expect(
      (await cliente.listarOportunidades({ q: "directorio-estetica" })).data[0]
        .codigoDescarte
    ).toBe("otro");
  });

  it("una oportunidad bloqueada solo se puede descartar: aprobarla es un 409", async () => {
    const error = await rechazo(
      cliente.decidir("demo-op-07", {
        accion: "aprobar",
        borradorId: "demo-bo-07-1",
      })
    );
    expect(error.estado).toBe(409);
    expect(error.message).toMatch(/bloqueada no admite «aprobar»/);
    expect((await cliente.detalleDeOportunidad("demo-op-07")).estado).toBe(
      "bloqueada"
    );
  });

  it.each<[string, Parameters<ClienteGrowth["decidir"]>[1], string]>([
    ["demo-op-02", { accion: "aprobar", borradorId: "x" }, "calificada"],
    ["demo-op-01", { accion: "devolver", motivo: "no" }, "detectada"],
    [
      "demo-op-06",
      { accion: "marcar_gestionado", canal: "email" },
      "pendiente_aprobacion",
    ],
    [
      "demo-op-09",
      { accion: "conseguido", urlConseguida: "https://ejemplo.example" },
      "aprobada",
    ],
    ["demo-op-13", { accion: "descartar", motivo: "otra vez" }, "descartada"],
    ["demo-op-11", { accion: "sin_respuesta" }, "conseguida"],
    [
      "demo-op-14",
      { accion: "aprobar", borradorId: "demo-bo-14-1" },
      "caducada",
    ],
  ])(
    "%s no admite esa acción en %s: 409 y no cambia nada",
    async (id, decision, estadoActual) => {
      const error = await rechazo(cliente.decidir(id, decision));
      expect(error.estado).toBe(409);
      expect((await cliente.detalleDeOportunidad(id)).estado).toBe(
        estadoActual
      );
    }
  );

  it("aprobar exige que el borrador esté pendiente y sea el de esa oportunidad", async () => {
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-05", {
            accion: "aprobar",
            borradorId: "demo-bo-05-1",
          })
        )
      ).estado
    ).toBe(409);
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-05", {
            accion: "aprobar",
            borradorId: "demo-bo-06-1",
          })
        )
      ).estado
    ).toBe(409);
    expect((await cliente.detalleDeOportunidad("demo-op-05")).estado).toBe(
      "pendiente_aprobacion"
    );
  });

  it("aprobar respeta el tope semanal (hechas + aprobadas sin gestionar)", async () => {
    await cliente.guardarAjustes({ topeSemanal: 2 });
    const error = await rechazo(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    );
    expect(error).toMatchObject({ estado: 409, codigo: "tope_semanal" });
    expect((await cliente.detalleDeOportunidad("demo-op-06")).estado).toBe(
      "pendiente_aprobacion"
    );
    await cliente.guardarAjustes({ topeSemanal: 3 });
    await expect(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    ).resolves.toMatchObject({ estado: "aprobada" });
  });

  it("aprobar rechaza una oportunidad vencida (409 caducada)", async () => {
    ahora = new Date(ahora.getTime() + 3 * DIA); // demo-op-06 caducaba a los 2 días y 6 h
    const error = await rechazo(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    );
    expect(error).toMatchObject({ estado: 409, codigo: "caducada" });
  });

  it("aprobar REEVALÚA: si una afirmación ya no vale, el borrador queda bloqueado con las comprobaciones", async () => {
    // Se cuela una afirmación inexistente en el borrador sin pasar por la edición.
    const edicion = await cliente.editarBorrador("demo-bo-06-1", {
      afirmaciones: ["precio.plan.inexistente"],
    });
    expect(edicion.resultado).toBe("bloquea");
    const error = await rechazo(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    );
    expect(error.estado).toBe(409);
    expect((await cliente.detalleDeOportunidad("demo-op-06")).estado).toBe(
      "bloqueada"
    );
  });

  it("marcar como gestionado: pide un borrador aprobado, crea la gestión y guarda lo que de verdad enviaste", async () => {
    const respuesta = await cliente.decidir("demo-op-09", {
      accion: "marcar_gestionado",
      canal: "email",
      notas: "Enviado por correo",
      textoFinal: "Texto que envié de verdad",
    });
    expect(respuesta.estado).toBe("gestionada");
    const detalle = await cliente.detalleDeOportunidad("demo-op-09");
    expect(detalle.borradores[0]).toMatchObject({
      estado: "gestionado",
      textoFinal: "Texto que envié de verdad",
      editadoPorHumano: true,
    });
    expect(detalle.borradores[0].gestion).toMatchObject({
      canal: "email",
      resultado: "pendiente",
      notas: "Enviado por correo",
    });
    expect((await cliente.resumen()).contactos.estaSemana).toBe(2);
  });

  it("marcar como gestionado sin textoFinal deja el texto aprobado tal cual", async () => {
    await cliente.decidir("demo-op-09", {
      accion: "marcar_gestionado",
      canal: "formulario",
    });
    const borrador = (await cliente.detalleDeOportunidad("demo-op-09"))
      .borradores[0];
    expect(borrador.textoFinal).toBeNull();
    expect(borrador.editadoPorHumano).toBe(false);
  });

  it("la fecha de la gestión tiene que estar entre hace 30 días y ahora", async () => {
    const hace31 = new Date(ahora.getTime() - 31 * DIA).toISOString();
    const futura = new Date(ahora.getTime() + DIA).toISOString();
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-09", {
            accion: "marcar_gestionado",
            canal: "email",
            hechaEn: hace31,
          })
        )
      ).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-09", {
            accion: "marcar_gestionado",
            canal: "email",
            hechaEn: futura,
          })
        )
      ).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.decidir("demo-op-09", {
            accion: "marcar_gestionado",
            canal: "email",
            hechaEn: "ayer",
          })
        )
      ).estado
    ).toBe(400);
    expect((await cliente.detalleDeOportunidad("demo-op-09")).estado).toBe(
      "aprobada"
    );
    const hace3 = new Date(ahora.getTime() - 3 * DIA).toISOString();
    await cliente.decidir("demo-op-09", {
      accion: "marcar_gestionado",
      canal: "email",
      hechaEn: hace3,
    });
    expect(
      (await cliente.listarGestiones({ dominio: "blog-autonomos.example" }))
        .data[0].hechaEn
    ).toBe(hace3);
  });

  it("«Enlace conseguido» exige una URL http(s): javascript: es un 400", async () => {
    for (const mala of [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://x.example",
      "no es una url",
      "",
    ]) {
      expect(
        (
          await rechazo(
            cliente.decidir("demo-op-10", {
              accion: "conseguido",
              urlConseguida: mala,
            })
          )
        ).estado
      ).toBe(400);
    }
    expect((await cliente.detalleDeOportunidad("demo-op-10")).estado).toBe(
      "gestionada"
    );
    await cliente.decidir("demo-op-10", {
      accion: "conseguido",
      urlConseguida: "https://directorio-unas.example/ficha/alhabla",
    });
    const detalle = await cliente.detalleDeOportunidad("demo-op-10");
    expect(detalle.estado).toBe("conseguida");
    expect(detalle.borradores[0].gestion).toMatchObject({
      resultado: "aceptado",
      urlConseguida: "https://directorio-unas.example/ficha/alhabla",
    });
  });

  it("que el destino diga que no deja la gestión «rechazado» y la oportunidad «sin_respuesta»", async () => {
    await cliente.decidir("demo-op-10", {
      accion: "rechazado",
      notas: "Dicen que no",
    });
    const detalle = await cliente.detalleDeOportunidad("demo-op-10");
    expect(detalle.estado).toBe("sin_respuesta");
    // Las notas del cierre se suman a las de «marcar como gestionado».
    expect(detalle.borradores[0].gestion).toMatchObject({
      resultado: "rechazado",
      notas:
        "Rellené el formulario de alta; dicen que tardan una semana.\nDicen que no",
    });
    expect(detalle.borradores[0].gestion?.respuestaEn).not.toBeNull();
    expect(detalle.decisiones[0].accion).toBe("rechazado");
  });

  it("sin respuesta deja la gestión «sin_respuesta»", async () => {
    await cliente.decidir("demo-op-10", { accion: "sin_respuesta" });
    expect(
      (await cliente.detalleDeOportunidad("demo-op-10")).borradores[0].gestion
        ?.resultado
    ).toBe("sin_respuesta");
  });

  it("una oportunidad que no existe es un 404", async () => {
    expect(
      (
        await rechazo(
          cliente.decidir("no-existe", { accion: "descartar", motivo: "x" })
        )
      ).estado
    ).toBe(404);
  });
});

describe("editar un borrador", () => {
  it("un texto con un término prohibido lo bloquea, y arreglarlo lo devuelve a «por revisar»", async () => {
    const malo = await cliente.editarBorrador("demo-bo-06-1", {
      texto: "Alhabla es el mejor del mundo para tu directorio.",
      nota: "Probando",
    });
    expect(malo.resultado).toBe("bloquea");
    expect(malo.borrador).toMatchObject({
      estado: "bloqueado",
      editadoPorHumano: true,
    });
    expect(malo.oportunidad).toEqual({ id: "demo-op-06", estado: "bloqueada" });
    expect(
      malo.comprobaciones.find((c) => c.regla === "sin_terminos_prohibidos")
    ).toMatchObject({ ok: false, dura: true });

    const bueno = await cliente.editarBorrador("demo-bo-06-1", {
      texto:
        "Atendemos por teléfono a peluquerías y barberías y dejamos cada cita reservada en el calendario del propio negocio, sin descolgar.",
    });
    expect(bueno.resultado).toBe("pasa");
    expect(bueno.oportunidad.estado).toBe("pendiente_aprobacion");

    const detalle = await cliente.detalleDeOportunidad("demo-op-06");
    expect(detalle.borradores[0].revisiones.length).toBe(3);
    expect(
      detalle.decisiones.filter((d) => d.accion === "editar")
    ).toHaveLength(2);
    expect(
      detalle.decisiones.find((d) => d.motivo?.includes("Probando"))
    ).toBeDefined();
  });

  it("una edición que no cambia nada no crea revisión ni decisión", async () => {
    const antes = await cliente.detalleDeBorrador("demo-bo-06-1");
    const respuesta = await cliente.editarBorrador("demo-bo-06-1", {
      texto: antes.texto,
    });
    expect(respuesta.borrador.editadoPorHumano).toBe(false);
    const despues = await cliente.detalleDeBorrador("demo-bo-06-1");
    expect(despues.revisiones).toHaveLength(antes.revisiones.length);
    expect(
      (
        await cliente.listarDecisiones({
          borradorId: "demo-bo-06-1",
          accion: "editar",
        })
      ).total
    ).toBe(0);
  });

  it("un correo en el texto es un dato personal: bloquea", async () => {
    const r = await cliente.editarBorrador("demo-bo-06-1", {
      texto: "Escríbeme a persona@ejemplo.example",
    });
    expect(r.resultado).toBe("bloquea");
    expect(
      r.comprobaciones.find((c) => c.regla === "sin_datos_personales")?.ok
    ).toBe(false);
  });

  it("NUNCA deja un borrador «aprobado»: bloqueado o por revisar, y un bloqueado no se aprueba", async () => {
    const limpio = await cliente.editarBorrador("demo-bo-05-2", {
      asunto: "Otro asunto",
    });
    expect(limpio.borrador.estado).toBe("pendiente_aprobacion");

    const sucio = await cliente.editarBorrador("demo-bo-05-2", {
      texto: "Somos el mejor del mundo.",
    });
    expect(sucio.borrador.estado).toBe("bloqueado");
    expect(sucio.oportunidad.estado).toBe("bloqueada");

    // Ningún camino lo lleva de bloqueado a aprobado.
    const error = await rechazo(
      cliente.decidir("demo-op-05", {
        accion: "aprobar",
        borradorId: "demo-bo-05-2",
      })
    );
    expect(error.estado).toBe(409);
    const detalle = await cliente.detalleDeBorrador("demo-bo-05-2");
    expect(detalle.estado).toBe("bloqueado");
    expect(detalle.esEditable).toBe(true);
  });

  it("solo se edita la última versión de un borrador bloqueado o por revisar", async () => {
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-05-1", { texto: "vieja" })
        )
      ).estado
    ).toBe(409);
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-09-1", { texto: "aprobado" })
        )
      ).estado
    ).toBe(409);
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-10-1", { texto: "gestionado" })
        )
      ).estado
    ).toBe(409);
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-14-1", { texto: "caducado" })
        )
      ).estado
    ).toBe(409);
    expect(
      (await rechazo(cliente.editarBorrador("no-existe", { texto: "x" })))
        .estado
    ).toBe(404);
  });

  it("valida el cuerpo: algo que cambiar, texto no vacío y enlaces http(s)", async () => {
    expect(
      (await rechazo(cliente.editarBorrador("demo-bo-06-1", {}))).estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-06-1", { nota: "solo nota" })
        )
      ).estado
    ).toBe(400);
    expect(
      (await rechazo(cliente.editarBorrador("demo-bo-06-1", { texto: "   " })))
        .estado
    ).toBe(400);
    expect(
      (
        await rechazo(
          cliente.editarBorrador("demo-bo-06-1", {
            enlaceUrl: "javascript:alert(1)",
          })
        )
      ).estado
    ).toBe(400);
    const ok = await cliente.editarBorrador("demo-bo-06-1", {
      enlaceUrl: null,
    });
    expect(ok.borrador.enlaceUrl).toBeNull();
  });

  it("la similitud con la versión anterior se recalcula al editar", async () => {
    const anterior = (await cliente.detalleDeBorrador("demo-bo-05-1")).texto;
    const r = await cliente.editarBorrador("demo-bo-05-2", { texto: anterior });
    expect(
      r.comprobaciones.find((c) => c.regla === "similitud_con_version_anterior")
    ).toMatchObject({ ok: false, dura: false });
    expect(
      (await cliente.detalleDeBorrador("demo-bo-05-2"))
        .similitudConVersionAnterior
    ).toBe(1);
  });
});

describe("añadir una URL", () => {
  it("crea una oportunidad «detectada» de la fuente manual", async () => {
    const r = await cliente.anadirUrl({
      url: "https://nueva-revista.example/listado",
      nota: "Me lo dijeron",
      nichoSlug: "peluqueria",
    });
    expect(r).toMatchObject({ creada: true, estado: "detectada" });
    const detalle = await cliente.detalleDeOportunidad(r.id);
    expect(detalle).toMatchObject({
      titulo: "nueva-revista.example",
      dominio: "nueva-revista.example",
      objetivoPrincipal: "BACKLINKS",
      puntBacklinks: 0,
      fuente: { tipo: "manual" },
      nicho: { slug: "peluqueria" },
      datos: { nota: "Me lo dijeron" },
    });
    expect(detalle.decisiones[0].accion).toBe("anadir_url");
    expect(
      (await cliente.listarOportunidades({ fuente: "manual" })).total
    ).toBe(2);
  });

  it("una URL que ya existe devuelve la existente sin reabrirla", async () => {
    const igual = await cliente.anadirUrl({
      url: "https://www.Foro-Bricolaje.example/hilo/12345/#respuestas",
    });
    expect(igual).toEqual({
      creada: false,
      id: "demo-op-13",
      estado: "descartada",
      motivoDescarte:
        "Es un foro de bricolaje: nada que ver con negocios con cita.",
    });
    expect((await cliente.detalleDeOportunidad("demo-op-13")).estado).toBe(
      "descartada"
    );
  });

  it("rechaza lo que no es http(s) y lo que es de Alhabla o interno", async () => {
    for (const mala of ["javascript:alert(1)", "ftp://x.example", "x", ""]) {
      expect((await rechazo(cliente.anadirUrl({ url: mala }))).estado).toBe(
        400
      );
    }
    for (const propia of [
      "https://alhabla.ai/planes",
      "https://app.alhabla.ai/",
      "http://localhost:3000/x",
      "http://127.0.0.1/x",
      "https://servidor.internal/x",
      "https://impresora.local/x",
    ]) {
      expect((await rechazo(cliente.anadirUrl({ url: propia }))).estado).toBe(
        400
      );
    }
    expect(
      (
        await rechazo(
          cliente.anadirUrl({
            url: "https://ok.example/",
            nichoSlug: "no-existe",
          })
        )
      ).estado
    ).toBe(400);
  });
});

describe("ajustes", () => {
  it("guarda los cambios y deja rastro con el antes y el después", async () => {
    const ajustes = await cliente.guardarAjustes({
      topeSemanal: 3,
      pausa: true,
    });
    expect(ajustes.valores).toMatchObject({ topeSemanal: 3, pausa: true });
    expect(ajustes.actualizadoEn.topeSemanal).not.toBeNull();
    const rastro = (await cliente.listarDecisiones({ accion: "ajustes" }))
      .data[0];
    expect(rastro.oportunidad).toBeNull();
    expect(rastro.motivo).toContain("topeSemanal: 5 -> 3");
    expect(rastro.motivo).toContain("pausa: false -> true");
    expect((await cliente.resumen()).pausa).toBe(true);
    expect((await cliente.resumen()).contactos.tope).toBe(3);
  });

  it.each<[string, Parameters<ClienteGrowth["guardarAjustes"]>[0]]>([
    ["nada que cambiar", {}],
    ["tope por encima de 20", { topeSemanal: 21 }],
    ["tope negativo", { topeSemanal: -1 }],
    ["tope con decimales", { topeSemanal: 2.5 }],
    ["similitud por debajo de 0,4", { umbralDeSimilitud: 0.3 }],
    ["similitud por encima de 0,9", { umbralDeSimilitud: 0.95 }],
    [
      "umbral por encima de 100",
      { umbralesPorObjetivo: { TRAFICO_MARCA: 101, LEADS: 60, BACKLINKS: 60 } },
    ],
    [
      "umbral incompleto",
      { umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60 } as never },
    ],
  ])("rechaza %s", async (_caso, cambios) => {
    expect((await rechazo(cliente.guardarAjustes(cambios))).estado).toBe(400);
    expect((await cliente.ajustes()).valores.topeSemanal).toBe(5);
  });

  it("acepta los extremos permitidos", async () => {
    const r = await cliente.guardarAjustes({
      topeSemanal: 0,
      umbralDeSimilitud: 0.9,
      umbralesPorObjetivo: { TRAFICO_MARCA: 0, LEADS: 100, BACKLINKS: 50 },
    });
    expect(r.valores.topeSemanal).toBe(0);
    expect(r.valores.umbralesPorObjetivo).toEqual({
      TRAFICO_MARCA: 0,
      LEADS: 100,
      BACKLINKS: 50,
    });
  });
});

describe("similitudDeTextos", () => {
  it("es 1 para textos iguales, 0 sin nada en común y no falla con textos cortos", () => {
    const texto = "una recepcionista de ia para negocios con cita previa";
    expect(similitudDeTextos(texto, texto)).toBe(1);
    expect(
      similitudDeTextos(
        texto,
        "otra cosa muy distinta que no tiene nada que ver"
      )
    ).toBe(0);
    // Como el backend: un texto de menos de tres palabras se compara por
    // palabras sueltas, así que dos iguales dan 1 y dos distintos, 0.
    expect(similitudDeTextos("hola", "hola")).toBe(1);
    expect(similitudDeTextos("hola", "adiós")).toBe(0);
  });
});

describe("la máquina de estados no se salta nunca", () => {
  it("tras cualquier decisión válida, el estado destino es el de la tabla", async () => {
    const casos: Array<
      [string, Parameters<ClienteGrowth["decidir"]>[1], EstadoDeOportunidad]
    > = [
      ["demo-op-05", { accion: "devolver", motivo: "ok" }, "devuelta"],
      ["demo-op-09", { accion: "descartar", motivo: "ok" }, "descartada"],
      [
        "demo-op-09",
        { accion: "marcar_gestionado", canal: "otro" },
        "gestionada",
      ],
    ];
    for (const [id, decision, esperado] of casos) {
      if (id === "demo-op-09" && decision.accion === "descartar") continue;
      const r = await cliente.decidir(id, decision);
      expect(r.estado).toBe(esperado);
    }
  });
});
