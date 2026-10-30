import { beforeEach, describe, expect, it } from "vitest";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  crearAlmacenDeDemostracion,
  type AlmacenDeDemostracion,
} from "@/lib/demo/datos";
import { gruposDeBorrador } from "@/lib/demo/grupos-de-borradores";
import {
  NOMBRES_DE_REGLAS_BLANDAS,
  NOMBRES_DE_REGLAS_DURAS,
  evaluarReglasDeDemo,
  type BorradorAEvaluar,
  type ContextoDeReglas,
} from "@/lib/demo/reglas-demo";
import {
  ESTADOS_DE_BORRADOR,
  ESTADOS_DE_OPORTUNIDAD,
  type EstadoDeBorrador,
} from "@/lib/types";

/**
 * La demostración tiene que contar lo mismo que el backend de verdad: estos
 * tests recogen las diferencias que encontró la revisión de extremo a extremo
 * (respuestas reales contra la demostración) para que no vuelvan.
 */

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-10-30T09:00:00.000Z");

let cliente: ClienteGrowth;

function montar(retocar?: (a: AlmacenDeDemostracion) => void): ClienteGrowth {
  const a = crearAlmacenDeDemostracion({ ahora: AHORA });
  retocar?.(a);
  return clienteDemo({ retardoMs: 0, ahora: () => AHORA, almacen: a });
}

beforeEach(() => {
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

// ---------------------------------------------------------------------------
// «Caducados» (hallazgo M2)
// ---------------------------------------------------------------------------

describe("«Caducados» en Borradores se define solo por la oportunidad", () => {
  it("un borrador de una oportunidad caducada sale en «caducados» sea cual sea su estado", () => {
    for (const estado of ESTADOS_DE_BORRADOR) {
      expect(
        gruposDeBorrador(estado, "caducada"),
        `borrador ${estado}`
      ).toContain("caducados");
    }
  });

  it("y no sale entonces en «aprobados» ni en «descartados»", () => {
    for (const estado of ESTADOS_DE_BORRADOR) {
      const grupos = gruposDeBorrador(estado, "caducada");
      expect(grupos, `borrador ${estado}`).not.toContain("aprobados");
      expect(grupos, `borrador ${estado}`).not.toContain("descartados");
    }
  });

  it("si la oportunidad NO está caducada, «caducados» no sale nunca", () => {
    for (const estadoDeOportunidad of ESTADOS_DE_OPORTUNIDAD) {
      if (estadoDeOportunidad === "caducada") continue;
      for (const estado of ESTADOS_DE_BORRADOR) {
        expect(gruposDeBorrador(estado, estadoDeOportunidad)).not.toContain(
          "caducados"
        );
      }
    }
  });

  it.each<[EstadoDeBorrador, string[]]>([
    ["descartado", ["descartados"]],
    ["aprobado", ["aprobados"]],
    ["pendiente_aprobacion", ["pendientes"]],
    ["bloqueado", ["bloqueados"]],
    ["gestionado", ["gestionados"]],
    ["borrador", []],
  ])("sin caducar, un borrador %s sale solo en %j", (estado, esperado) => {
    expect(gruposDeBorrador(estado, "pendiente_aprobacion")).toEqual(esperado);
  });

  it("los datos de prueba enseñan algo en «Caducados»: el borrador (descartado por el job) de la caducada", async () => {
    const caducados = await cliente.listarBorradores({ grupo: "caducados" });
    expect(caducados.total).toBe(1);
    expect(caducados.data[0]).toMatchObject({
      id: "demo-bo-14-1",
      estado: "descartado",
      oportunidad: { id: "demo-op-14", estado: "caducada" },
    });
    // Y no se cuenta además en «Descartados» ni en «Aprobados».
    const descartados = await cliente.listarBorradores({
      grupo: "descartados",
    });
    expect(descartados.data.map((b) => b.id)).not.toContain("demo-bo-14-1");
    expect(descartados.data.map((b) => b.id).sort()).toEqual([
      "demo-bo-05-1",
      "demo-bo-08-1",
    ]);
    const aprobados = await cliente.listarBorradores({ grupo: "aprobados" });
    expect(aprobados.data.map((b) => b.id)).toEqual(["demo-bo-09-1"]);
    expect(caducados.conteos).toMatchObject({
      caducados: 1,
      descartados: 2,
      aprobados: 1,
    });
  });

  it("un borrador aprobado cuya oportunidad caduca (aunque el job no lo hubiera descartado) también sale en «Caducados»", async () => {
    cliente = montar((a) => {
      a.borradores.find((b) => b.id === "demo-bo-14-1")!.estado = "aprobado";
    });
    const caducados = await cliente.listarBorradores({ grupo: "caducados" });
    expect(caducados.data.map((b) => b.id)).toEqual(["demo-bo-14-1"]);
    const aprobados = await cliente.listarBorradores({ grupo: "aprobados" });
    expect(aprobados.data.map((b) => b.id)).not.toContain("demo-bo-14-1");
  });

  it("la decisión «caducar» del sistema queda en el registro de la caducada", async () => {
    const detalle = await cliente.detalleDeOportunidad("demo-op-14");
    expect(detalle.decisiones.map((d) => [d.accion, d.por])).toContainEqual([
      "caducar",
      "sistema",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Las reglas de agenda no bloquean el texto (hallazgo M5b)
// ---------------------------------------------------------------------------

describe("una regla de agenda es un 409 que no cambia nada", () => {
  async function instantanea(idBorrador: string, idOportunidad: string) {
    const borrador = await cliente.detalleDeBorrador(idBorrador);
    const oportunidad = await cliente.detalleDeOportunidad(idOportunidad);
    const decisiones = await cliente.listarDecisiones({ limite: 200 });
    return {
      texto: borrador.texto,
      estado: borrador.estado,
      revisiones: borrador.revisiones.length,
      estadoDeLaOportunidad: oportunidad.estado,
      decisiones: decisiones.total,
    };
  }

  it("editar con el tope semanal lleno: 409 tope_semanal y ni el texto, ni la revisión, ni el estado cambian", async () => {
    await cliente.guardarAjustes({ topeSemanal: 2 }); // 1 hecha + 1 aprobada
    const antes = await instantanea("demo-bo-06-1", "demo-op-06");
    const error = await rechazo(
      cliente.editarBorrador("demo-bo-06-1", {
        texto:
          "Atendemos por teléfono a barberías y dejamos cada cita reservada en el calendario del negocio, sin que nadie descuelgue.",
      })
    );
    expect(error).toMatchObject({ estado: 409, codigo: "tope_semanal" });
    expect(error.message).toMatch(/tope de 2 contactos esta semana/);
    expect(await instantanea("demo-bo-06-1", "demo-op-06")).toEqual(antes);
    expect(antes.estado).toBe("pendiente_aprobacion");
  });

  it("editar un dominio contactado hace poco: 409 dominio_en_enfriamiento, sin cambiar nada", async () => {
    // demo-op-06 pasa a ser del dominio de la gestión de hace 5 días (demo-ge-10).
    cliente = montar((a) => {
      a.oportunidades.find((o) => o.id === "demo-op-06")!.dominio =
        "directorio-unas.example";
    });
    const antes = await instantanea("demo-bo-06-1", "demo-op-06");
    const error = await rechazo(
      cliente.editarBorrador("demo-bo-06-1", { asunto: "Otro asunto" })
    );
    expect(error).toMatchObject({
      estado: 409,
      codigo: "dominio_en_enfriamiento",
    });
    expect(error.message).toMatch(/Ya se contactó con este dominio el 2026-/);
    expect(await instantanea("demo-bo-06-1", "demo-op-06")).toEqual(antes);
  });

  it("editar un dominio con otra aprobada sin gestionar: 409 dominio_ya_aprobado, sin cambiar nada", async () => {
    cliente = montar((a) => {
      a.oportunidades.find((o) => o.id === "demo-op-06")!.dominio =
        "blog-autonomos.example"; // el de demo-op-09, aprobada
    });
    const antes = await instantanea("demo-bo-06-1", "demo-op-06");
    const error = await rechazo(
      cliente.editarBorrador("demo-bo-06-1", { asunto: "Otro asunto" })
    );
    expect(error).toMatchObject({ estado: 409, codigo: "dominio_ya_aprobado" });
    expect(await instantanea("demo-bo-06-1", "demo-op-06")).toEqual(antes);
  });

  it("aprobar con la agenda mal: 409 con su código y el borrador sigue por revisar (no se bloquea)", async () => {
    await cliente.guardarAjustes({ topeSemanal: 2 });
    const error = await rechazo(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    );
    expect(error).toMatchObject({ estado: 409, codigo: "tope_semanal" });
    const detalle = await cliente.detalleDeOportunidad("demo-op-06");
    expect(detalle.estado).toBe("pendiente_aprobacion");
    expect(detalle.borradores[0].estado).toBe("pendiente_aprobacion");
    // Ninguna decisión «bloquear_por_reglas».
    expect(detalle.decisiones.map((d) => d.accion)).not.toContain(
      "bloquear_por_reglas"
    );
  });

  it("aprobar un dominio contactado hace poco: 409 dominio_en_enfriamiento", async () => {
    cliente = montar((a) => {
      a.oportunidades.find((o) => o.id === "demo-op-06")!.dominio =
        "directorio-unas.example";
    });
    const error = await rechazo(
      cliente.decidir("demo-op-06", {
        accion: "aprobar",
        borradorId: "demo-bo-06-1",
      })
    );
    expect(error).toMatchObject({
      estado: 409,
      codigo: "dominio_en_enfriamiento",
    });
    expect((await cliente.detalleDeOportunidad("demo-op-06")).estado).toBe(
      "pendiente_aprobacion"
    );
  });

  it("si el texto también falla, se guarda y se bloquea por el texto (la agenda es solo un aviso en la revisión)", async () => {
    await cliente.guardarAjustes({ topeSemanal: 2 });
    const respuesta = await cliente.editarBorrador("demo-bo-06-1", {
      texto: "Alhabla es el mejor del mundo para tu directorio.",
    });
    expect(respuesta.resultado).toBe("bloquea");
    expect(respuesta.borrador.estado).toBe("bloqueado");
    const tope = respuesta.comprobaciones.find(
      (c) => c.regla === "tope_semanal"
    );
    // Con la agenda como aviso, no es una regla que bloquee.
    expect(tope).toMatchObject({ ok: false, dura: false });
  });
});

// ---------------------------------------------------------------------------
// Diferencias demo/real (hallazgo B9, B10)
// ---------------------------------------------------------------------------

describe("la demostración cuenta lo mismo que el backend", () => {
  it("«sin respuesta» deja respuestaEn en null; «rechazado» y «conseguido» la rellenan", async () => {
    // demo-op-10 está gestionada; demo-op-09 aprobada → gestionada.
    await cliente.decidir("demo-op-10", { accion: "sin_respuesta" });
    const sinRespuesta = (await cliente.detalleDeOportunidad("demo-op-10"))
      .borradores[0].gestion!;
    expect(sinRespuesta.resultado).toBe("sin_respuesta");
    expect(sinRespuesta.respuestaEn).toBeNull();

    await cliente.decidir("demo-op-09", {
      accion: "marcar_gestionado",
      canal: "email",
    });
    await cliente.decidir("demo-op-09", { accion: "rechazado" });
    const rechazado = (await cliente.detalleDeOportunidad("demo-op-09"))
      .borradores[0].gestion!;
    expect(rechazado.respuestaEn).not.toBeNull();
  });

  it("las notas del cierre se suman a las de «marcar como gestionado», no las pisan", async () => {
    await cliente.decidir("demo-op-09", {
      accion: "marcar_gestionado",
      canal: "email",
      notas: "Enviado por correo",
    });
    await cliente.decidir("demo-op-09", {
      accion: "sin_respuesta",
      notas: "Pasadas dos semanas, nada",
    });
    const gestion = (await cliente.detalleDeOportunidad("demo-op-09"))
      .borradores[0].gestion!;
    expect(gestion.notas).toBe("Enviado por correo\nPasadas dos semanas, nada");
  });

  it("sin notas en el cierre, las de la gestión se quedan tal cual", async () => {
    await cliente.decidir("demo-op-10", { accion: "rechazado" });
    const gestion = (await cliente.detalleDeOportunidad("demo-op-10"))
      .borradores[0].gestion!;
    expect(gestion.notas).toBe(
      "Rellené el formulario de alta; dicen que tardan una semana."
    );
  });

  it("los contactos de la semana son las gestiones hechas MÁS las aprobadas sin gestionar, en el resumen y en el detalle", async () => {
    const resumen = await cliente.resumen();
    expect(resumen.contactos).toMatchObject({
      hechas: 1,
      aprobadasSinGestionar: 1,
      estaSemana: 2,
    });
    expect(
      (await cliente.detalleDeOportunidad("demo-op-06")).contacto
        .contactosEstaSemana
    ).toBe(2);
    await cliente.decidir("demo-op-06", {
      accion: "aprobar",
      borradorId: "demo-bo-06-1",
    });
    expect((await cliente.resumen()).contactos).toMatchObject({
      hechas: 1,
      aprobadasSinGestionar: 2,
      estaSemana: 3,
    });
  });

  it("el resumen trae los ajustes vigentes y los días que faltan en lo que caduca", async () => {
    const resumen = await cliente.resumen();
    expect(resumen.ajustes).toEqual((await cliente.ajustes()).valores);
    expect(resumen.porCaducar.length).toBeGreaterThan(0);
    for (const c of resumen.porCaducar) {
      expect(Number.isInteger(c.diasParaCaducar)).toBe(true);
      expect(c.diasParaCaducar).toBeGreaterThanOrEqual(0);
      expect(c.diasParaCaducar).toBeLessThanOrEqual(7);
    }
  });

  it("el código de descarte va aparte y no dentro de `datos`, en la lista y en el detalle", async () => {
    const lista = await cliente.listarOportunidades({ limite: 200 });
    const descartada = lista.data.find((o) => o.id === "demo-op-13")!;
    expect(descartada.codigoDescarte).toBe("irrelevante");
    expect(descartada.datos).not.toHaveProperty("codigoDescarte");
    const detalle = await cliente.detalleDeOportunidad("demo-op-13");
    expect(detalle.codigoDescarte).toBe("irrelevante");
    expect(detalle.datos).not.toHaveProperty("codigoDescarte");
  });

  it("las revisiones y la gestión del detalle llevan su `borradorId`, como en el backend", async () => {
    const conGestion = (await cliente.detalleDeOportunidad("demo-op-10"))
      .borradores[0];
    expect(conGestion.gestion?.borradorId).toBe("demo-bo-10-1");
    for (const r of conGestion.revisiones) {
      expect(r.borradorId).toBe("demo-bo-10-1");
    }
    const detalleBorrador = await cliente.detalleDeBorrador("demo-bo-05-2");
    for (const r of detalleBorrador.revisiones) {
      expect(r.borradorId).toBe("demo-bo-05-2");
    }
  });

  describe("la clave de una URL quita el seguimiento, como el backend", () => {
    it.each([
      "https://www.blog-autonomos.example/herramientas-para-citas?utm_source=boletin&utm_medium=email&utm_campaign=otoño",
      "https://blog-autonomos.example/herramientas-para-citas/?gclid=abc123",
      "https://BLOG-AUTONOMOS.example/herramientas-para-citas?fbclid=zzz&ref=amigo",
      "https://blog-autonomos.example/herramientas-para-citas#comentarios",
      "https://blog-autonomos.example:443/herramientas-para-citas?mc_cid=1&utm_content=x",
    ])("%s es la oportunidad que ya existe", async (url) => {
      const respuesta = await cliente.anadirUrl({ url });
      expect(respuesta).toMatchObject({ creada: false, id: "demo-op-09" });
    });

    it("el orden de los parámetros que sí cuentan no importa, pero su valor sí", async () => {
      const primera = await cliente.anadirUrl({
        url: "https://nueva.example/pagina?b=2&a=1&utm_source=x",
      });
      expect(primera.creada).toBe(true);
      const igual = await cliente.anadirUrl({
        url: "https://nueva.example/pagina/?a=1&b=2&gclid=9",
      });
      expect(igual).toMatchObject({ creada: false, id: primera.id });
      const distinta = await cliente.anadirUrl({
        url: "https://nueva.example/pagina?a=1&b=3",
      });
      expect(distinta.creada).toBe(true);
    });

    it("http y https son páginas distintas (el backend las distingue)", async () => {
      const respuesta = await cliente.anadirUrl({
        url: "http://blog-autonomos.example/herramientas-para-citas",
      });
      expect(respuesta.creada).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// El motor de reglas
// ---------------------------------------------------------------------------

function contexto(parcial: Partial<ContextoDeReglas> = {}): ContextoDeReglas {
  return {
    clavesVigentes: new Set(["funcion.agenda_propia", "precio.plan.pro"]),
    afirmacionesCitadas: [],
    terminosProhibidos: [
      { termino: "el mejor del mundo", palabraEntera: true },
    ],
    competidores: [
      { nombre: "Retell AI", dominio: "retell.ai" },
      { nombre: "Vapi", dominio: "vapi.ai" },
    ],
    textosAnteriores: [],
    textosDeLaMismaOportunidad: [],
    gestionesDelDominio: [],
    aprobadasDelDominio: 0,
    contactosEstaSemana: 1,
    topeSemanal: 5,
    umbralDeSimilitud: 0.6,
    ahora: AHORA,
    ...parcial,
  };
}

const BUENO: BorradorAEvaluar = {
  tipo: "email",
  objetivo: "BACKLINKS",
  asunto: "Una recepcionista de IA para vuestro listado",
  texto:
    "Hola, soy el fundador de Alhabla. Hemos hecho una recepcionista de IA para peluquerías que atiende las llamadas y reserva en el calendario del negocio. Si os encaja, nos gustaría aparecer en vuestra sección de herramientas. Un saludo.",
  enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=growth",
  afirmaciones: ["funcion.agenda_propia"],
};

function reglaDe(
  borrador: Partial<BorradorAEvaluar>,
  regla: string,
  ctx: Partial<ContextoDeReglas> = {}
) {
  const { comprobaciones } = evaluarReglasDeDemo(
    { ...BUENO, ...borrador },
    contexto(ctx)
  );
  const encontrada = comprobaciones.find((c) => c.regla === regla);
  expect(encontrada, `la regla ${regla} existe`).toBeDefined();
  return encontrada!;
}

describe("el motor de reglas de la demostración refleja el del backend", () => {
  it("evalúa las 12 reglas duras y las 5 blandas, por nombre y en el mismo orden", () => {
    const { resultado, comprobaciones } = evaluarReglasDeDemo(
      BUENO,
      contexto()
    );
    expect(comprobaciones.map((c) => c.regla)).toEqual([
      ...NOMBRES_DE_REGLAS_DURAS,
      ...NOMBRES_DE_REGLAS_BLANDAS,
    ]);
    expect(comprobaciones.filter((c) => c.dura).map((c) => c.regla)).toEqual([
      ...NOMBRES_DE_REGLAS_DURAS,
    ]);
    expect(resultado).toBe("pasa");
  });

  it("precio_trazable: un precio sin citar su afirmación bloquea, con el mensaje del backend", () => {
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Cuesta 59 € al mes.` },
        "precio_trazable"
      )
    ).toMatchObject({
      ok: false,
      dura: true,
      detalle:
        "Menciona un precio, unos minutos o que algo es gratis sin citar ninguna afirmación `precio.*`.",
    });
    expect(
      reglaDe(
        {
          texto: `${BUENO.texto} Cuesta 59 € al mes.`,
          afirmaciones: ["precio.plan.pro"],
        },
        "precio_trazable"
      )
    ).toMatchObject({
      ok: true,
      detalle: "El precio que menciona cita una afirmación `precio.*`.",
    });
    for (const frase of [
      "Es gratis.",
      "59 EUR",
      "200 mins",
      "cincuenta y nueve euros",
    ]) {
      expect(
        reglaDe({ texto: `${BUENO.texto} ${frase}` }, "precio_trazable").ok,
        frase
      ).toBe(false);
    }
  });

  it("comparativa_con_fuente: nombrar a un competidor (también «Retell») sin citar su dato bloquea", () => {
    for (const nombre of ["Retell AI", "Retell", "retell.ai", "Vapi"]) {
      expect(
        reglaDe(
          { texto: `${BUENO.texto} Somos mejores que ${nombre}.` },
          "comparativa_con_fuente"
        ),
        nombre
      ).toMatchObject({ ok: false, dura: true });
    }
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Somos mejores que Retell.` },
        "comparativa_con_fuente"
      ).detalle
    ).toBe(
      "Nombra a Retell AI sin citar una afirmación `comparativa.*` de ese competidor (art. 10 Ley 3/1991: solo datos verificables, con fecha)."
    );
    expect(reglaDe(BUENO, "comparativa_con_fuente").detalle).toBe(
      "No nombra a ningún competidor."
    );
  });

  it("sin_terminos_prohibidos, identificacion, sin_esquemas_de_enlaces, sin_datos_personales y tipo_acorde bloquean con los mensajes del backend", () => {
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Somos el mejor del mundo.` },
        "sin_terminos_prohibidos"
      )
    ).toMatchObject({
      ok: false,
      detalle: "Usa términos prohibidos: el mejor del mundo.",
    });
    expect(
      reglaDe(
        {
          texto:
            "Hola, tenemos una recepcionista de IA para vuestro listado de herramientas.",
        },
        "identificacion"
      ).detalle
    ).toBe(
      "Un mensaje debe decir quién escribe y de parte de quién (por ejemplo, «soy el fundador de Alhabla»)."
    );
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Hacemos un intercambio de enlaces.` },
        "sin_esquemas_de_enlaces"
      ).detalle
    ).toBe(
      "Propone un intercambio, una compra o un pago por un enlace: es un esquema de enlaces."
    );
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Escríbeme a alguien@ejemplo.example` },
        "sin_datos_personales"
      ).detalle
    ).toBe("Incluye un correo o un teléfono que no es de Alhabla.");
    expect(
      reglaDe(
        { tipo: "texto_invitado", objetivo: "LEADS" },
        "tipo_acorde_con_objetivo"
      ).detalle
    ).toBe(
      "Un borrador de tipo texto_invitado no encaja con el objetivo LEADS."
    );
  });

  it("enlace_a_alhabla: un enlace ajeno, o uno en el texto, bloquea", () => {
    expect(
      reglaDe({ enlaceUrl: "https://otra.example/x" }, "enlace_a_alhabla")
        .detalle
    ).toBe("El enlace no apunta a un dominio de alhabla.ai.");
    expect(
      reglaDe(
        { texto: `${BUENO.texto} Mira https://otra.example/x` },
        "enlace_a_alhabla"
      )
    ).toMatchObject({ ok: false, dura: true });
  });

  it("sin_plantilla_repetida usa el umbral de los ajustes (0,6 por defecto)", () => {
    const otro = BUENO.texto;
    expect(
      reglaDe({}, "sin_plantilla_repetida", { textosAnteriores: [otro] })
    ).toMatchObject({
      ok: false,
      dura: true,
      detalle: "Se parece un 100 % a un mensaje anterior (tope 60 %).",
    });
    // Con un umbral más alto de los ajustes, el mismo parecido ya no bloquea.
    expect(
      reglaDe(
        {
          texto: `${BUENO.texto} Y una frase más de relleno al final del texto.`,
        },
        "sin_plantilla_repetida",
        {
          textosAnteriores: [otro],
          umbralDeSimilitud: 0.9,
        }
      ).ok
    ).toBe(true);
  });

  it("similitud_con_version_anterior avisa con el umbral de los ajustes (0,6), no con 0,4", () => {
    // Unas versiones con ~50 % de parecido: por encima de 0,4, por debajo de 0,6.
    const v1 =
      "Hola soy el fundador de Alhabla una recepcionista de IA para peluquerías que atiende las llamadas y reserva en el calendario del negocio un saludo";
    const v2 =
      "Hola soy el fundador de Alhabla una recepcionista de IA para peluquerías que atiende las llamadas y además reserva cada cita en su propia agenda gracias por vuestro tiempo";
    const medio = reglaDe({ texto: v2 }, "similitud_con_version_anterior", {
      textosDeLaMismaOportunidad: [v1],
    });
    const porcentaje = Number(medio.detalle.match(/(\d+) %/)![1]);
    expect(porcentaje).toBeGreaterThan(40);
    expect(porcentaje).toBeLessThan(60);
    expect(medio).toMatchObject({ ok: true, dura: false });

    // Y baja el umbral de los ajustes a 0,4: ahora sí avisa.
    expect(
      reglaDe({ texto: v2 }, "similitud_con_version_anterior", {
        textosDeLaMismaOportunidad: [v1],
        umbralDeSimilitud: 0.4,
      })
    ).toMatchObject({
      ok: false,
      dura: false,
      detalle: `Se parece un ${porcentaje} % a una versión anterior de esta misma oportunidad: apenas ha cambiado.`,
    });
    // Idéntica a la anterior: avisa también con el umbral por defecto.
    expect(
      reglaDe({ texto: v1 }, "similitud_con_version_anterior", {
        textosDeLaMismaOportunidad: [v1],
      }).ok
    ).toBe(false);
  });

  it("un_contacto_por_dominio y tope_semanal son de agenda: con `agendaComoAviso` avisan y no bloquean", () => {
    const ctx = contexto({
      gestionesDelDominio: [new Date(AHORA.getTime() - 5 * DIA)],
      contactosEstaSemana: 5,
    });
    const normal = evaluarReglasDeDemo(BUENO, ctx);
    expect(normal.resultado).toBe("bloquea");
    const aviso = evaluarReglasDeDemo(BUENO, ctx, { agendaComoAviso: true });
    expect(aviso.resultado).toBe("aviso");
    for (const regla of ["un_contacto_por_dominio", "tope_semanal"]) {
      expect(aviso.comprobaciones.find((c) => c.regla === regla)).toMatchObject(
        {
          ok: false,
          dura: false,
        }
      );
    }
    expect(
      aviso.comprobaciones.find((c) => c.regla === "un_contacto_por_dominio")!
        .detalle
    ).toBe("Ya se contactó con este dominio el 2026-10-25: espera 90 días.");
    expect(
      aviso.comprobaciones.find((c) => c.regla === "tope_semanal")!.detalle
    ).toBe("Se ha llegado al tope de 5 contactos esta semana.");
  });

  it("una edición en la demostración guarda esas 17 comprobaciones en la revisión", async () => {
    const respuesta = await cliente.editarBorrador("demo-bo-06-1", {
      texto:
        "Atendemos por teléfono a peluquerías y barberías y dejamos cada cita reservada en el calendario del propio negocio, sin descolgar.",
    });
    expect(respuesta.comprobaciones.map((c) => c.regla)).toEqual([
      ...NOMBRES_DE_REGLAS_DURAS,
      ...NOMBRES_DE_REGLAS_BLANDAS,
    ]);
  });

  it("las revisiones sembradas llevan también las 17 reglas, con los mensajes reales", async () => {
    const detalle = await cliente.detalleDeBorrador("demo-bo-07-1");
    const reglas = detalle.revisiones.find((r) => r.revisor === "reglas")!;
    expect(reglas.comprobaciones.map((c) => c.regla)).toEqual([
      ...NOMBRES_DE_REGLAS_DURAS,
      ...NOMBRES_DE_REGLAS_BLANDAS,
    ]);
    expect(
      reglas.comprobaciones.filter((c) => c.dura && !c.ok).map((c) => c.regla)
    ).toEqual(["afirmaciones_vigentes", "sin_terminos_prohibidos"]);
  });

  it("lo sembrado es coherente con el motor: re-evaluar los borradores editables da el mismo resultado", async () => {
    // Nada de «la demostración dice una cosa y el motor otra»: lo que está
    // pendiente de aprobación o bloqueado se re-evalúa con el contexto de hoy.
    for (const [borrador, oportunidad] of [
      ["demo-bo-05-2", "demo-op-05"],
      ["demo-bo-06-1", "demo-op-06"],
    ] as const) {
      const antes = await cliente.detalleDeBorrador(borrador);
      const ultima = antes.revisiones.find((r) => r.revisor === "reglas")!;
      // Un cambio mínimo que no altera lo que las reglas miran.
      await cliente.editarBorrador(borrador, {
        asunto: `${antes.asunto ?? "Alta"} (otra vez)`,
      });
      const despues = await cliente.detalleDeBorrador(borrador);
      const nueva = despues.revisiones.find((r) => r.revisor === "reglas")!;
      expect(nueva.resultado, borrador).toBe(ultima.resultado);
      expect(
        nueva.comprobaciones.filter((c) => !c.ok).map((c) => c.regla),
        `${oportunidad}: reglas que fallan`
      ).toEqual(ultima.comprobaciones.filter((c) => !c.ok).map((c) => c.regla));
    }
    const bloqueada = await cliente.detalleDeBorrador("demo-bo-07-1");
    expect(bloqueada.revisiones[0].resultado).toBe("bloquea");
  });
});
