import { beforeEach, describe, expect, it } from "vitest";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  crearAlmacenDeDemostracion,
  type AlmacenDeDemostracion,
} from "@/lib/demo/datos";
import { ESTADOS_DE_COMPETIDOR, type CompetidorResumen } from "@/lib/types";

/**
 * La competencia de la demostración tiene que comportarse como el backend:
 * las mismas transiciones, los mismos `409`/`400` con su `codigo` y nada
 * cambia cuando una petición se rechaza.
 */

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-10-30T09:00:00.000Z");

let ahora = AHORA;
let cliente: ClienteGrowth;

function montar(retocar?: (a: AlmacenDeDemostracion) => void): ClienteGrowth {
  const almacen = crearAlmacenDeDemostracion({ ahora: AHORA });
  retocar?.(almacen);
  return clienteDemo({ retardoMs: 0, ahora: () => ahora, almacen });
}

beforeEach(() => {
  ahora = AHORA;
  cliente = montar();
});

async function rechazo(promesa: Promise<unknown>): Promise<ErrorDeCliente> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(ErrorDeCliente);
  return error as ErrorDeCliente;
}

async function lista(): Promise<CompetidorResumen[]> {
  return (await cliente.competidores()).data;
}

async function conEstado(estado: string) {
  const encontrado = (await lista()).find((c) => c.estado === estado);
  expect(encontrado, `no hay ningún competidor «${estado}»`).toBeDefined();
  return encontrado!;
}

describe("los datos de prueba de la competencia", () => {
  it("cubren los cuatro estados y los tres orígenes", async () => {
    const todos = await lista();
    expect(new Set(todos.map((c) => c.estado))).toEqual(
      new Set(ESTADOS_DE_COMPETIDOR)
    );
    expect(new Set(todos.map((c) => c.origen))).toEqual(
      new Set(["repo", "manual", "agente"])
    );
  });

  it("el analizado trae precios, varias versiones y está sin revisar; el revisado está caducado", async () => {
    const analizado = await cliente.detalleDeCompetidor(
      (await conEstado("analizado")).id
    );
    expect(analizado.ultimoAnalisis?.revisadoEn).toBeNull();
    expect(
      analizado.ultimoAnalisis?.datos.filter((d) => d.valor).length
    ).toBeGreaterThan(1);
    expect(analizado.versiones.map((v) => v.version)).toEqual([2, 1]);

    const revisado = await conEstado("revisado");
    expect(revisado.analisis).toMatchObject({ caducado: true });
    expect(revisado.analisis?.revisadoEn).not.toBeNull();
  });

  it("un propuesto es del agente y un repo por analizar no tiene análisis", async () => {
    const propuesto = await conEstado("propuesto");
    expect(propuesto.origen).toBe("agente");
    expect(propuesto.notas).toMatch(/^Propuesto por el agente:/);
    expect(propuesto.analisis).toBeNull();
    const pendiente = await conEstado("por_analizar");
    expect(pendiente.origen).toBe("repo");
    expect(pendiente.analisis).toBeNull();
    expect(pendiente.analisisSolicitadoEn).not.toBeNull();
  });

  it("todo dato lleva su fuente https y su fecha de consulta, y solo precios y planes llevan valor", async () => {
    const almacen = crearAlmacenDeDemostracion({ ahora: AHORA });
    for (const c of almacen.competidores) {
      for (const analisis of c.analisis) {
        for (const d of analisis.datos) {
          expect(d.urlFuente).toMatch(/^https:\/\//);
          expect(Date.parse(d.consultadoEn)).not.toBeNaN();
          if (d.valor) expect(["precio", "plan"]).toContain(d.tipo);
          if (d.tipo === "precio") expect(d.valor).toBeDefined();
        }
      }
    }
  });
});

describe("leer la competencia", () => {
  it("la lista va por orden de nombre y cuenta oportunidades (con subdominios) y menciones", async () => {
    const c = montar((a) => {
      a.oportunidades.push({
        ...a.oportunidades[0],
        id: "demo-op-sub",
        url: "https://blog.competidor-ficticio.example/otra",
        dominio: "blog.competidor-ficticio.example",
      });
    });
    const { data } = await c.competidores();
    expect(data.map((x) => x.nombre)).toEqual(
      [...data.map((x) => x.nombre)].sort((a, b) => a.localeCompare(b, "es"))
    );
    const ficticio = data.find(
      (x) => x.dominio === "competidor-ficticio.example"
    );
    // Una en su dominio y otra en un subdominio.
    expect(ficticio?.oportunidades).toBe(2);
    expect(ficticio?.menciones).toBe(3);
    expect(data.find((x) => x.dominio === "atiende24.example")?.menciones).toBe(
      0
    );
  });

  it("el detalle trae el último análisis y las versiones de la más nueva a la más vieja", async () => {
    const detalle = await cliente.detalleDeCompetidor("demo-co-3");
    expect(detalle.ultimoAnalisis?.id).toBe("demo-an-3-2");
    expect(detalle.versiones.map((v) => v.id)).toEqual([
      "demo-an-3-2",
      "demo-an-3-1",
    ]);
    expect(detalle.versiones[0].numDatos).toBe(
      detalle.ultimoAnalisis?.datos.length
    );
    expect(detalle.analisis).toMatchObject({
      id: "demo-an-3-2",
      version: 2,
      caducado: false,
    });
  });

  it("una versión concreta se lee por su id; las ajenas y las que no existen son 404", async () => {
    const v1 = await cliente.analisisDeCompetidor("demo-co-3", "demo-an-3-1");
    expect(v1).toMatchObject({ version: 1, notaDeRevision: null });
    expect(
      (await rechazo(cliente.analisisDeCompetidor("demo-co-3", "demo-an-1-1")))
        .estado
    ).toBe(404);
    expect(
      (await rechazo(cliente.analisisDeCompetidor("nadie", "demo-an-3-1")))
        .estado
    ).toBe(404);
    expect((await rechazo(cliente.detalleDeCompetidor("nadie"))).estado).toBe(
      404
    );
  });

  it("«caducado» se calcula con el reloj: pasados 90 días de su fecha, lo está", async () => {
    expect(
      (await cliente.detalleDeCompetidor("demo-co-3")).analisis?.caducado
    ).toBe(false);
    ahora = new Date(AHORA.getTime() + 87 * DIA);
    expect(
      (await cliente.detalleDeCompetidor("demo-co-3")).analisis?.caducado
    ).toBe(false);
    ahora = new Date(AHORA.getTime() + 89 * DIA);
    expect(
      (await cliente.detalleDeCompetidor("demo-co-3")).analisis?.caducado
    ).toBe(true);
  });

  it("las respuestas son copias: tocarlas no cambia el almacén", async () => {
    const detalle = await cliente.detalleDeCompetidor("demo-co-3");
    detalle.nombre = "Cambiado desde fuera";
    detalle.ultimoAnalisis!.resumen = "Cambiado desde fuera";
    const otra = await cliente.detalleDeCompetidor("demo-co-3");
    expect(otra.nombre).not.toBe("Cambiado desde fuera");
    expect(otra.ultimoAnalisis?.resumen).not.toBe("Cambiado desde fuera");
  });
});

describe("añadir un competidor", () => {
  it("sale de la URL: dominio sin www ni mayúsculas, URL sin seguimiento, por analizar y pedido ahora", async () => {
    const nuevo = await cliente.anadirCompetidor({
      url: "https://WWW.Nuevo-Rival.Example./precios?utm_source=x&plan=pro#arriba",
    });
    expect(nuevo).toMatchObject({
      nombre: "Nuevo-rival",
      dominio: "nuevo-rival.example",
      origen: "manual",
      estado: "por_analizar",
      notas: null,
      analisisSolicitadoEn: AHORA.toISOString(),
      oportunidades: 0,
      menciones: 0,
      analisis: null,
      ultimoAnalisis: null,
      versiones: [],
    });
    expect(nuevo.url).toBe("https://www.nuevo-rival.example/precios?plan=pro");
    expect((await lista()).map((c) => c.id)).toContain(nuevo.id);
  });

  it("acepta nombre y notas, y los recorta", async () => {
    const nuevo = await cliente.anadirCompetidor({
      url: "https://rival.example",
      nombre: "  Rival SL  ",
      notas: "  Me lo dijo una clienta  ",
    });
    expect(nuevo).toMatchObject({
      nombre: "Rival SL",
      notas: "Me lo dijo una clienta",
    });
  });

  it("el que ya existe es un 409 competidor_existente con su id, también con otra grafía del dominio", async () => {
    for (const url of [
      "https://competidor-ficticio.example/otra-pagina",
      "https://www.COMPETIDOR-FICTICIO.example",
    ]) {
      const error = await rechazo(cliente.anadirCompetidor({ url }));
      expect(error).toMatchObject({
        estado: 409,
        codigo: "competidor_existente",
        id: "demo-co-1",
      });
    }
    // También si el existente es un propuesto del agente.
    expect(
      await rechazo(
        cliente.anadirCompetidor({ url: "https://atiende24.example" })
      )
    ).toMatchObject({ estado: 409, id: "demo-co-4" });
  });

  it("el dominio de Alhabla es un 400 dominio_propio (también un subdominio)", async () => {
    for (const url of ["https://alhabla.ai", "https://app.alhabla.ai/login"]) {
      expect(await rechazo(cliente.anadirCompetidor({ url }))).toMatchObject({
        estado: 400,
        codigo: "dominio_propio",
      });
    }
  });

  it("localhost, una IP o un host sin punto son un 400 sin código", async () => {
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1/admin",
      "http://intranet/",
      "https://metadata.google.internal/",
    ]) {
      const error = await rechazo(cliente.anadirCompetidor({ url }));
      expect(error.estado, url).toBe(400);
      expect(error.codigo, url).toBeNull();
    }
  });

  it("solo http y https, y sin usuario ni contraseña", async () => {
    for (const url of [
      "javascript:alert(1)",
      "ftp://rival.example",
      "data:text/html,hola",
      "rival.example",
      "https://alhabla.ai@rival.example",
    ]) {
      expect(
        (await rechazo(cliente.anadirCompetidor({ url }))).estado,
        url
      ).toBe(400);
    }
  });

  it("nombre vacío o demasiado largo, notas de más de 500 y URL de más de 2000 son un 400", async () => {
    const url = "https://rival.example";
    for (const alta of [
      { url, nombre: "   " },
      { url, nombre: "n".repeat(121) },
      { url, notas: "x".repeat(501) },
      { url: `https://rival.example/${"a".repeat(2000)}` },
    ]) {
      expect((await rechazo(cliente.anadirCompetidor(alta))).estado).toBe(400);
    }
  });

  it("un rechazo no cambia nada", async () => {
    const antes = await lista();
    await rechazo(cliente.anadirCompetidor({ url: "https://alhabla.ai" }));
    await rechazo(
      cliente.anadirCompetidor({ url: "https://atiende24.example" })
    );
    expect(await lista()).toEqual(antes);
  });
});

describe("editar un competidor", () => {
  it("cambia nombre, notas y URL; vaciar las notas o la URL las borra", async () => {
    const editado = await cliente.editarCompetidor("demo-co-3", {
      nombre: "  Express  ",
      notas: "Otra nota",
      url: "https://recepcion-express.example/precios?utm_campaign=z",
    });
    expect(editado).toMatchObject({
      nombre: "Express",
      notas: "Otra nota",
      url: "https://recepcion-express.example/precios",
    });
    const vacio = await cliente.editarCompetidor("demo-co-3", {
      notas: "",
      url: null,
    });
    expect(vacio).toMatchObject({ notas: null, url: null });
    // El nombre no se toca si no viene.
    expect(vacio.nombre).toBe("Express");
  });

  it("sin ningún campo es un 400; el competidor que no existe, un 404", async () => {
    expect(
      (await rechazo(cliente.editarCompetidor("demo-co-3", {}))).estado
    ).toBe(400);
    expect(
      (await rechazo(cliente.editarCompetidor("nadie", { nombre: "X" }))).estado
    ).toBe(404);
  });

  it("una URL de otro dominio es un 400 url_de_otro_dominio y no cambia NADA (ni el nombre que iba con ella)", async () => {
    const antes = await cliente.detalleDeCompetidor("demo-co-3");
    const error = await rechazo(
      cliente.editarCompetidor("demo-co-3", {
        nombre: "Otro nombre",
        url: "https://otro-sitio.example/precios",
      })
    );
    expect(error).toMatchObject({ estado: 400, codigo: "url_de_otro_dominio" });
    expect(await cliente.detalleDeCompetidor("demo-co-3")).toEqual(antes);
  });

  it("el mismo dominio con www o mayúsculas sí vale; el de Alhabla no", async () => {
    await expect(
      cliente.editarCompetidor("demo-co-3", {
        url: "https://WWW.recepcion-express.example/nueva",
      })
    ).resolves.toMatchObject({
      url: "https://www.recepcion-express.example/nueva",
    });
    expect(
      await rechazo(
        cliente.editarCompetidor("demo-co-3", { url: "https://alhabla.ai/x" })
      )
    ).toMatchObject({ estado: 400, codigo: "dominio_propio" });
  });

  it("el nombre no puede quedar vacío ni pasar de 120", async () => {
    for (const nombre of ["  ", "n".repeat(121)]) {
      expect(
        (await rechazo(cliente.editarCompetidor("demo-co-3", { nombre })))
          .estado
      ).toBe(400);
    }
  });
});

describe("quitar un competidor", () => {
  it("quita uno añadido a mano, con su análisis", async () => {
    await expect(
      cliente.quitarCompetidor("demo-co-3")
    ).resolves.toBeUndefined();
    expect((await lista()).some((c) => c.id === "demo-co-3")).toBe(false);
    expect(
      (await rechazo(cliente.detalleDeCompetidor("demo-co-3"))).estado
    ).toBe(404);
    expect(
      (await rechazo(cliente.analisisDeCompetidor("demo-co-3", "demo-an-3-2")))
        .estado
    ).toBe(404);
  });

  it("los del repositorio son un 409 competidor_del_repositorio y se quedan", async () => {
    for (const id of ["demo-co-1", "demo-co-2"]) {
      expect(await rechazo(cliente.quitarCompetidor(id))).toMatchObject({
        estado: 409,
        codigo: "competidor_del_repositorio",
      });
    }
    expect(await lista()).toHaveLength(4);
  });

  it("rechazar un propuesto es quitarlo", async () => {
    await cliente.quitarCompetidor("demo-co-4");
    expect((await lista()).some((c) => c.estado === "propuesto")).toBe(false);
  });

  it("uno que no existe es un 404", async () => {
    expect((await rechazo(cliente.quitarCompetidor("nadie"))).estado).toBe(404);
  });
});

describe("el ciclo propuesto → por analizar → analizado → revisado", () => {
  it("aceptar pasa un propuesto a «por analizar», lo pide ahora y lo pasa a contar como competidor", async () => {
    const aceptado = await cliente.aceptarCompetidor("demo-co-4");
    expect(aceptado).toMatchObject({
      estado: "por_analizar",
      analisisSolicitadoEn: AHORA.toISOString(),
    });
  });

  it("aceptar algo que no es un propuesto es un 409 estado_incorrecto", async () => {
    for (const id of ["demo-co-1", "demo-co-2", "demo-co-3"]) {
      expect(await rechazo(cliente.aceptarCompetidor(id))).toMatchObject({
        estado: 409,
        codigo: "estado_incorrecto",
      });
    }
    // Y dos veces seguidas, tampoco.
    await cliente.aceptarCompetidor("demo-co-4");
    expect((await rechazo(cliente.aceptarCompetidor("demo-co-4"))).codigo).toBe(
      "estado_incorrecto"
    );
  });

  it("volver a analizar pasa un analizado o un revisado a «por analizar» y conserva sus versiones", async () => {
    for (const id of ["demo-co-3", "demo-co-1"]) {
      const antes = await cliente.detalleDeCompetidor(id);
      ahora = new Date(ahora.getTime() + 60_000);
      const despues = await cliente.reanalizarCompetidor(id);
      expect(despues.estado).toBe("por_analizar");
      expect(despues.analisisSolicitadoEn).toBe(ahora.toISOString());
      expect(despues.versiones).toEqual(antes.versiones);
      expect(despues.ultimoAnalisis).toEqual(antes.ultimoAnalisis);
    }
  });

  it("volver a analizar es idempotente en «por analizar» (no mueve la fecha) y un propuesto es un 409", async () => {
    const antes = await cliente.detalleDeCompetidor("demo-co-2");
    ahora = new Date(ahora.getTime() + 60_000);
    expect(await cliente.reanalizarCompetidor("demo-co-2")).toEqual(antes);
    expect(
      await rechazo(cliente.reanalizarCompetidor("demo-co-4"))
    ).toMatchObject({ estado: 409, codigo: "estado_incorrecto" });
  });

  it("revisar da por bueno el último análisis: revisado, con su fecha y su nota", async () => {
    const revisado = await cliente.revisarAnalisis("demo-co-3", "demo-an-3-2", {
      nota: "  Todo en orden  ",
    });
    expect(revisado.estado).toBe("revisado");
    expect(revisado.ultimoAnalisis).toMatchObject({
      revisadoEn: AHORA.toISOString(),
      notaDeRevision: "Todo en orden",
    });
    expect(revisado.analisis?.revisadoEn).toBe(AHORA.toISOString());
    // Sin nota, también.
    const sinNota = montar();
    const r = await sinNota.revisarAnalisis("demo-co-3", "demo-an-3-2", {});
    expect(r.ultimoAnalisis?.notaDeRevision).toBeNull();
  });

  it("revisar una versión que ya no es la última es un 409 analisis_antiguo", async () => {
    expect(
      await rechazo(cliente.revisarAnalisis("demo-co-3", "demo-an-3-1", {}))
    ).toMatchObject({ estado: 409, codigo: "analisis_antiguo" });
  });

  it("revisar dos veces es un 409 ya_revisado, y un análisis que no es del competidor, un 404", async () => {
    await cliente.revisarAnalisis("demo-co-3", "demo-an-3-2", {});
    expect(
      await rechazo(cliente.revisarAnalisis("demo-co-3", "demo-an-3-2", {}))
    ).toMatchObject({ estado: 409, codigo: "ya_revisado" });
    expect(
      (await rechazo(cliente.revisarAnalisis("demo-co-3", "demo-an-1-1", {})))
        .estado
    ).toBe(404);
    expect(
      (await rechazo(cliente.revisarAnalisis("nadie", "demo-an-3-2", {})))
        .estado
    ).toBe(404);
  });

  it("si se pidió volver a analizar, ya no se revisa lo anterior: 409 estado_incorrecto", async () => {
    await cliente.reanalizarCompetidor("demo-co-3");
    expect(
      await rechazo(cliente.revisarAnalisis("demo-co-3", "demo-an-3-2", {}))
    ).toMatchObject({ estado: 409, codigo: "estado_incorrecto" });
  });

  it("una nota de más de 500 caracteres es un 400 y no revisa", async () => {
    expect(
      (
        await rechazo(
          cliente.revisarAnalisis("demo-co-3", "demo-an-3-2", {
            nota: "x".repeat(501),
          })
        )
      ).estado
    ).toBe(400);
    expect((await cliente.detalleDeCompetidor("demo-co-3")).estado).toBe(
      "analizado"
    );
  });
});

describe("un propuesto no aplica ninguna regla hasta que lo aceptas", () => {
  const TEXTO_LIMPIO =
    "Atendemos por teléfono a peluquerías y barberías y dejamos cada cita reservada en el calendario del propio negocio, sin descolgar. Atiende24 hace algo parecido.";

  async function comparativa(c: ClienteGrowth) {
    const edicion = await c.editarBorrador("demo-bo-06-1", {
      texto: TEXTO_LIMPIO,
    });
    return edicion.comprobaciones.find(
      (x) => x.regla === "comparativa_con_fuente"
    );
  }

  it("nombrar a un propuesto no bloquea; nombrarlo tras aceptarlo, sí (sin comparativa con fuente)", async () => {
    // Cada caso con su cliente: una edición idéntica no se vuelve a evaluar.
    expect(await comparativa(montar())).toMatchObject({ ok: true });
    const conAceptado = montar();
    await conAceptado.aceptarCompetidor("demo-co-4");
    expect(await comparativa(conAceptado)).toMatchObject({
      ok: false,
      dura: true,
    });
  });

  it("y si lo rechazas, tampoco bloquea", async () => {
    await cliente.quitarCompetidor("demo-co-4");
    expect(await comparativa(cliente)).toMatchObject({ ok: true });
  });
});

describe("el filtro `menciona` de las oportunidades", () => {
  it("solo trae las que mencionan a ese dominio", async () => {
    const { data, total } = await cliente.listarOportunidades({
      menciona: "competidor-ficticio.example",
      limite: 100,
    });
    expect(total).toBe(3);
    expect(data.map((o) => o.id).sort()).toEqual([
      "demo-op-02",
      "demo-op-03",
      "demo-op-05",
    ]);
    for (const o of data) {
      expect(o.datos?.competidoresMencionados).toContain(
        "competidor-ficticio.example"
      );
    }
  });

  it("normaliza el dominio (mayúsculas, www) y un dominio sin menciones da una lista vacía", async () => {
    expect(
      (
        await cliente.listarOportunidades({
          menciona: " WWW.Recepcion-Express.example ",
        })
      ).total
    ).toBe(2);
    expect(
      (await cliente.listarOportunidades({ menciona: "atiende24.example" }))
        .total
    ).toBe(0);
  });

  it("se combina con los demás filtros y los conteos respetan `menciona`", async () => {
    const lista = await cliente.listarOportunidades({
      menciona: "competidor-ficticio.example",
      objetivo: "BACKLINKS",
      estado: ["pendiente_aprobacion"],
    });
    expect(lista.data.map((o) => o.id)).toEqual(["demo-op-05"]);
    expect(
      Object.values(lista.conteos.porEstado).reduce((a, b) => a + b, 0)
    ).toBeGreaterThanOrEqual(1);
  });
});
