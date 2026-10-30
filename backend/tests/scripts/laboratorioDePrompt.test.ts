import { describe, it, expect, vi } from "vitest";
import {
  ErrorDeUso,
  MODELO_DEL_CLIENTE,
  NegocioNoDisponible,
  PREFIJO_DEL_LABORATORIO,
  TOPE_DE_TURNOS_SIN_CONFIRMAR,
  asignarLlamadas,
  compararInformes,
  conVariablesDeLaLlamada,
  crearCerrojosPorNegocio,
  crearRegistroDeLimpieza,
  datosInventados,
  detectarIdioma,
  enmascararTelefono,
  ejecutarLaboratorio,
  esNombreDeLaboratorio,
  evaluarComprobacion,
  evaluarGuion,
  exigeDespedida,
  exigirBaseUrlDeDev,
  exigirBdLocal,
  exigirConfirmacion,
  exigirNegocioDeLaboratorioInerte,
  fechaDelLaboratorio,
  informeMarkdown,
  leerDecisionDelCliente,
  leerInformeAnterior,
  leerVeredictoDelJuez,
  neutralizarTransferencia,
  DESTINO_INERTE_DE_TRANSFERENCIA,
  resultadoSinAssistant,
  nombreDelAssistant,
  parsearArgumentos,
  pareceDespedida,
  planificar,
  reconstruirConversacion,
  repartirLlamadas,
  restableceElNegocio,
  resumirCelda,
  siguienteMensajeDelCliente,
  tablaDeComparacion,
  tablaMarkdown,
  telefonosDelTexto,
  telefonosFueraDelLaboratorio,
  turnosDelAmbito,
  variablesComunes,
  veredicto,
  versionDelPromptSoportada,
  type AdaptadorDelLaboratorio,
  type CatalogoDeNegocios,
  type Conversacion,
  type ContextoDelNegocio,
  type DependenciasDelLaboratorio,
  type EntradaDelCliente,
  type Informe,
  type ResultadoDeRepeticion,
} from "../../scripts/laboratorioDePrompt.js";
import {
  ESCENARIOS,
  topeDeTurnos,
  todosLosGuiones,
  type Comprobacion,
} from "../../scripts/laboratorioDePrompt.escenarios.js";
import {
  ESCENARIOS_NO_DISPONIBLES,
  NEGOCIO_POR_ESCENARIO,
  NEGOCIOS_DE_LABORATORIO,
  TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
  telefonoDelNegocioDeLaboratorio,
} from "../../scripts/laboratorioDePrompt.negocios.js";
import type { TelnyxConversationMessage } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

function conversacion(
  respuestas: string[],
  llamadas: Array<{
    nombre: string;
    turno: number;
    argumentos?: Record<string, unknown>;
    textoPrevio?: boolean;
  }> = []
): Conversacion {
  return {
    turnos: respuestas.map((respuesta, i) => ({
      turno: i + 1,
      cliente: `cliente ${i + 1}`,
      respuesta,
      duracionMs: 1,
    })),
    llamadas: llamadas.map((llamada) => ({
      nombre: llamada.nombre,
      turno: llamada.turno,
      argumentos: llamada.argumentos ?? {},
      argumentosCrudos: JSON.stringify(llamada.argumentos ?? {}),
      textoPrevio: llamada.textoPrevio ?? false,
    })),
    avisos: [],
  };
}

function evaluar(comprobacion: Comprobacion, c: Conversacion) {
  return evaluarComprobacion(comprobacion, c).ok;
}

function adaptadorFalso(
  sobreescribir: Partial<Record<keyof AdaptadorDelLaboratorio, unknown>> = {}
) {
  const nombres = new Map<string, string>();
  let asistentes = 0;
  let conversaciones = 0;
  const adaptador = {
    createAssistant: vi.fn(async (input: { name: string }) => {
      const id = `assistant-${++asistentes}`;
      nombres.set(id, input.name);
      return { id, name: input.name, instructions: "" };
    }),
    getAssistant: vi.fn(async (id: string) => ({
      id,
      name: nombres.get(id) ?? "otro",
      instructions: "",
    })),
    deleteAssistant: vi.fn(async () => {}),
    deleteTexmlAppOfAssistant: vi.fn(async () => 1),
    createConversation: vi.fn(async () => ({ id: `conv-${++conversaciones}` })),
    addConversationMessage: vi.fn(async () => {}),
    chatWithAssistant: vi.fn(async () => "Tenemos hueco."),
    listConversationMessages: vi.fn(
      async (): Promise<TelnyxConversationMessage[]> => []
    ),
    deleteConversation: vi.fn(async () => {}),
    completarChat: vi.fn(async () => ""),
    ...sobreescribir,
  };
  return adaptador as unknown as AdaptadorDelLaboratorio & typeof adaptador;
}

function contextoFalso(
  negocioId: string,
  fecha: string,
  variantes: Array<"control" | "v2">,
  llamadas = ["call-1", "call-2", "call-3"],
  sufijo?: string
): ContextoDelNegocio {
  const payloads = {} as ContextoDelNegocio["payloads"];
  for (const variante of variantes) {
    payloads[variante] = {
      name: nombreDelAssistant(fecha, variante, sufijo),
      instructions: "Eres la recepcionista.",
      greeting: "Hola, gracias por llamar.",
      model: "openai/gpt-5.6-luna",
      tools: [{ type: "webhook", webhook: { name: "get_catalog" } }] as never,
    };
  }
  return {
    negocioId,
    nombre: "Peluquería de prueba",
    zonaHoraria: "Europe/Madrid",
    saludo: "Hola, gracias por llamar.",
    payloads,
    llamadas,
    telefonos: Object.fromEntries(
      llamadas.map((llamada, i) => [llamada, `+3460000000${i}`])
    ),
    chats: [{ callId: "whatsapp:chat:conv-antigua", telefono: "+34611222333" }],
    avisos: [],
  };
}

function dependencias(
  adaptador: AdaptadorDelLaboratorio,
  sobreescribir: Partial<DependenciasDelLaboratorio> = {}
) {
  const escritos: Array<{ ruta: string; contenido: string }> = [];
  const log = vi.fn();
  const deps: DependenciasDelLaboratorio = {
    adaptador,
    cargarContexto: vi.fn(async (input) =>
      contextoFalso(
        input.negocioId,
        input.fecha,
        input.variantes,
        undefined,
        input.sufijo
      )
    ),
    marcadorDeChat: () => "[WhatsApp · +34600000000 · hoy]",
    escribirInforme: vi.fn(async (ruta: string, contenido: string) => {
      escritos.push({ ruta, contenido });
    }),
    leerInforme: vi.fn(async (ruta: string) => {
      throw new Error(`no hay informe en ${ruta}`);
    }),
    ahora: () => new Date(2026, 9, 30, 15, 42),
    dormir: vi.fn(async () => {}),
    log,
    ...sobreescribir,
  };
  return { deps, escritos, log };
}

/** Un negocio forzado y el cliente con guion (los turnos fijos de siempre);
 * el reactivo se pide a mano con `--cliente reactivo`. */
/** Los argumentos de cada llamada a un mock del adaptador. */
function llamadasA(mock: unknown): unknown[][] {
  return (mock as { mock: { calls: unknown[][] } }).mock.calls;
}

function opciones(argumentos: string[] = []) {
  return parsearArgumentos([
    "--negocio",
    "biz_1",
    "--cliente",
    "guion",
    ...argumentos,
  ]);
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

describe("batería de escenarios", () => {
  it("tiene E1 a E26, sin repetir, y claves de guion únicas", () => {
    expect(ESCENARIOS.map((e) => e.id)).toEqual(
      Array.from({ length: 26 }, (_, i) => `E${i + 1}`)
    );
    const claves = todosLosGuiones().map((g) => g.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("todos los guiones tienen turnos y comprobaciones, y sus patrones compilan", () => {
    for (const guion of todosLosGuiones()) {
      expect(guion.turnos.length, guion.clave).toBeGreaterThan(0);
      expect(guion.comprobaciones.length, guion.clave).toBeGreaterThan(0);
      for (const comprobacion of guion.comprobaciones) {
        const patrones =
          comprobacion.tipo === "texto"
            ? comprobacion.patrones
            : comprobacion.tipo === "argumentoPatron"
              ? [comprobacion.patron]
              : [];
        for (const patron of patrones) {
          expect(
            () => new RegExp(patron, "iu"),
            `${guion.clave}: ${patron}`
          ).not.toThrow();
        }
      }
    }
  });

  it("las reglas duras del plan son E1, E7, E8, E9, E13, E14, E16, E18 y E22", () => {
    expect(
      ESCENARIOS.filter((e) => e.regla === "dura").map((e) => e.id)
    ).toEqual(["E1", "E7", "E8", "E9", "E13", "E14", "E16", "E18", "E22"]);
  });
});

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

describe("parsearArgumentos", () => {
  it("aplica los valores por defecto", () => {
    const o = parsearArgumentos([]);
    expect(o).toMatchObject({
      negocio: null,
      n: 10,
      escenarios: null,
      variantes: ["control"],
      dryRun: false,
      si: false,
      juez: null,
      paralelo: 3,
      conCitas: false,
      listaDeEspera: "auto",
      cliente: "reactivo",
      modeloDelCliente: MODELO_DEL_CLIENTE,
      compararCon: null,
      etiqueta: null,
    });
    expect(o.salida).toMatch(/backend\/\.laboratorio-de-prompt$/);
  });

  it("lee todas las opciones, también con =", () => {
    const o = parsearArgumentos([
      "--negocio=biz_1",
      "--n",
      "30",
      "--escenarios",
      "E1,E3,E9a",
      "--variantes",
      "control,v2",
      "--negocio-de",
      "E4=biz_ca,E18a=biz_oculto",
      "--salida",
      "/tmp/salida",
      "--paralelo",
      "5",
      "--con-citas",
      "--lista-de-espera",
      "si",
      "--cliente",
      "guion",
      "--modelo-cliente",
      "otro/modelo",
      "--comparar-con",
      "/tmp/anterior",
      "--etiqueta=tools de main",
      "--dry-run",
      "--si",
    ]);
    expect(o).toMatchObject({
      cliente: "guion",
      modeloDelCliente: "otro/modelo",
      compararCon: "/tmp/anterior",
      etiqueta: "tools de main",
      n: 30,
      escenarios: ["E1", "E3", "E9a"],
      variantes: ["control", "v2"],
      negociosPorEscenario: { E4: "biz_ca", E18a: "biz_oculto" },
      salida: "/tmp/salida",
      paralelo: 5,
      conCitas: true,
      listaDeEspera: "si",
      dryRun: true,
      si: true,
    });
  });

  it("--juez admite modelo opcional", () => {
    expect(opciones(["--juez"]).juez).toBe("moonshotai/Kimi-K2.6");
    expect(opciones(["--juez", "otro/modelo"]).juez).toBe("otro/modelo");
    expect(opciones(["--juez", "--dry-run"])).toMatchObject({
      juez: "moonshotai/Kimi-K2.6",
      dryRun: true,
    });
  });

  it.each([
    [["--negocio", "b", "--raro"], /desconocida/],
    [["--cliente", "humano"], /reactivo o guion/],
    [["--modelo-cliente", "openai/gpt-5.6-luna"], /el del assistant/],
    [["--comparar-con"], /Falta el valor/],
    [["--negocio", "b", "--n", "0"], /entre 1 y 200/],
    [["--negocio", "b", "--n", "x"], /entre 1 y 200/],
    [["--negocio", "b", "--escenarios", "E99"], /E99/],
    [["--negocio", "b", "--variantes", "v9"], /v9/],
    [["--negocio", "b", "--negocio-de", "E4"], /E4/],
    [["--negocio", "b", "--lista-de-espera", "quizá"], /si, no o auto/],
    [["--negocio"], /Falta el valor/],
    [["--negocio", "b", "suelto"], /inesperado/],
  ])("rechaza %j", (argv, mensaje) => {
    expect(() => parsearArgumentos(argv)).toThrow(ErrorDeUso);
    expect(() => parsearArgumentos(argv)).toThrow(mensaje);
  });

  it("--ayuda y la ejecución por defecto no exigen --negocio", () => {
    expect(parsearArgumentos(["--ayuda"]).ayuda).toBe(true);
    expect(parsearArgumentos(["--n", "2"]).negocio).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Guardas
// ---------------------------------------------------------------------------

describe("guardas", () => {
  it("solo es del laboratorio lo que empieza por el prefijo", () => {
    expect(
      esNombreDeLaboratorio("alhabla-lab-prompt-20261030-1542-control")
    ).toBe(true);
    expect(esNombreDeLaboratorio("alhabla-biz_1-agent_1")).toBe(false);
    expect(esNombreDeLaboratorio("alhabla-demo-peluqueria")).toBe(false);
    expect(esNombreDeLaboratorio("Alhabla-lab-prompt-x")).toBe(false);
    expect(esNombreDeLaboratorio("")).toBe(false);
    expect(esNombreDeLaboratorio(undefined)).toBe(false);
  });

  it("los nombres llevan fecha y variante", () => {
    expect(fechaDelLaboratorio(new Date(2026, 9, 3, 7, 5))).toBe(
      "20261003-0705"
    );
    expect(nombreDelAssistant("20261003-0705", "v2")).toBe(
      `${PREFIJO_DEL_LABORATORIO}20261003-0705-v2`
    );
    expect(nombreDelAssistant("20261003-0705", "control", "ab12cd")).toBe(
      `${PREFIJO_DEL_LABORATORIO}20261003-0705-control-ab12cd`
    );
  });

  it("acepta la BD de dev local y traduce el host de Compose", () => {
    expect(exigirBdLocal("postgresql://u:p@localhost:5433/botbook")).toContain(
      "localhost:5433"
    );
    expect(exigirBdLocal("postgresql://u:p@127.0.0.1:5433/botbook")).toContain(
      "127.0.0.1"
    );
    expect(exigirBdLocal("postgresql://u:p@postgres:5432/botbook")).toContain(
      "localhost:5433"
    );
  });

  it("rechaza otro Postgres local: otro puerto u otra base", () => {
    // Un Cloud SQL Auth Proxy de producción en un puerto libre.
    expect(() =>
      exigirBdLocal("postgresql://alhabla:x@127.0.0.1:61234/alhabla")
    ).toThrow(/no es la de desarrollo/);
    // El Postgres de Homebrew.
    expect(() =>
      exigirBdLocal("postgresql://u:x@localhost:5432/botbook")
    ).toThrow(/Docker de desarrollo/);
    expect(() =>
      exigirBdLocal("postgresql://u:x@localhost:5433/postgres")
    ).toThrow(/no es la de desarrollo/);
  });

  it("rechaza una BD que no es local", () => {
    expect(() =>
      exigirBdLocal("postgresql://u:p@db.ejemplo.com:5432/botbook")
    ).toThrow(/\[Laboratorio\].*no es local/);
    // El socket de Cloud SQL de producción: `host` manda sobre «localhost».
    expect(() =>
      exigirBdLocal(
        "postgresql://u:p@localhost/botbook?host=/cloudsql/proyecto:region:instancia"
      )
    ).toThrow(/no es local/);
    expect(() => exigirBdLocal(undefined)).toThrow(/Falta DATABASE_URL/);
  });

  it("las tools no pueden apuntar a producción", () => {
    expect(exigirBaseUrlDeDev("https://dev-api.alhabla.ai")).toBe(
      "https://dev-api.alhabla.ai"
    );
    expect(() => exigirBaseUrlDeDev("https://api.alhabla.ai")).toThrow(
      /producción/
    );
    expect(() =>
      exigirBaseUrlDeDev("https://alhabla-api-abc123-ew.a.run.app")
    ).toThrow(/producción/);
    expect(() => exigirBaseUrlDeDev(undefined)).toThrow(/BASE_URL/);
  });

  it("neutralizarTransferencia cambia el destino y deja lo demás", () => {
    const payload = {
      name: "alhabla-lab-prompt-x",
      instructions: "x",
      tools: [
        { type: "webhook", webhook: { name: "get_catalog" } },
        {
          type: "transfer",
          transfer: {
            from: "+34930000000",
            targets: [{ name: "Responsable", to: "+34666777888" }],
          },
        },
      ],
    } as never;

    const resultado = neutralizarTransferencia(payload) as {
      tools: Array<Record<string, any>>;
    };

    expect(resultado.tools[0]).toEqual({
      type: "webhook",
      webhook: { name: "get_catalog" },
    });
    expect(resultado.tools[1]!.transfer.targets).toEqual([
      { name: "Responsable", to: DESTINO_INERTE_DE_TRANSFERENCIA },
    ]);
    // Telnyx rechaza +34000000000 (10015): tiene que ser una URI SIP válida
    // en un dominio que nunca resuelve.
    expect(DESTINO_INERTE_DE_TRANSFERENCIA).toMatch(
      /^sip:[^@]+@[^@]+\.invalid$/
    );
    expect(resultado.tools[1]!.transfer.from).toBe("+34930000000");
  });

  it("v2 solo existe si el esquema de ajustes la conoce", () => {
    expect(versionDelPromptSoportada(() => ({}), "v2")).toBe(false);
    expect(versionDelPromptSoportada((x) => x, "v2")).toBe(true);
    expect(versionDelPromptSoportada(() => null, "v2")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

describe("planificar", () => {
  it("una tarea por guion, repetición y variante", () => {
    const plan = planificar(
      opciones([
        "--escenarios",
        "E1,E2",
        "--n",
        "3",
        "--variantes",
        "control,v2",
      ])
    );
    expect(plan.guiones.map((g) => g.clave)).toEqual(["E1", "E2"]);
    expect(plan.tareas).toHaveLength(2 * 3 * 2);
    // Las dos variantes de una repetición, seguidas.
    expect(plan.tareas.slice(0, 2).map((t) => t.variante)).toEqual([
      "control",
      "v2",
    ]);
    expect(plan.turnosTotales).toBe(3 * 2 * (2 + 2));
  });

  it("acepta escenarios enteros o guiones sueltos", () => {
    expect(
      planificar(opciones(["--escenarios", "E9", "--con-citas"])).guiones.map(
        (g) => g.clave
      )
    ).toEqual(["E9a", "E9b"]);
    expect(
      planificar(opciones(["--escenarios", "E9b", "--con-citas"])).guiones.map(
        (g) => g.clave
      )
    ).toEqual(["E9b"]);
  });

  it("sin --con-citas salta los guiones que reservan o anulan", () => {
    const sin = planificar(opciones(["--n", "1"]));
    const con = planificar(opciones(["--n", "1", "--con-citas"]));
    expect(con.repeticionesConCitas).toBeGreaterThan(0);
    expect(sin.repeticionesConCitas).toBe(0);
    expect(sin.guiones.length).toBeLessThan(con.guiones.length);
  });

  it("--con-citas exige --si aunque no pase de 300 turnos", () => {
    const conCitas = opciones([
      "--escenarios",
      "E25",
      "--n",
      "1",
      "--con-citas",
    ]);
    const plan = planificar(conCitas);
    expect(plan.repeticionesConCitas).toBe(1);
    expect(() => exigirConfirmacion(plan, conCitas)).toThrow(/--si/);
    expect(() =>
      exigirConfirmacion(plan, { ...conCitas, si: true })
    ).not.toThrow();
  });

  it("--negocio-de manda un escenario o un guion a otro negocio", () => {
    const plan = planificar(
      opciones([
        "--escenarios",
        "E4,E18",
        "--n",
        "1",
        "--negocio-de",
        "E4=biz_ca,E18a=biz_oculto",
      ])
    );
    const negocioDe = (clave: string) =>
      plan.tareas.find((t) => t.guion.clave === clave)!.negocioId;
    expect(negocioDe("E4")).toBe("biz_ca");
    expect(negocioDe("E18a")).toBe("biz_oculto");
    expect(negocioDe("E18b")).toBe("biz_1");
    expect(plan.negocios.sort()).toEqual(["biz_1", "biz_ca", "biz_oculto"]);
  });

  it("pide --si por encima de 300 turnos", () => {
    const grande = opciones(["--n", "20"]);
    const plan = planificar(grande);
    expect(plan.turnosTotales).toBeGreaterThan(TOPE_DE_TURNOS_SIN_CONFIRMAR);
    expect(() => exigirConfirmacion(plan, grande)).toThrow(/--si/);
    expect(() =>
      exigirConfirmacion(plan, { ...grande, si: true })
    ).not.toThrow();

    const pequeno = opciones(["--escenarios", "E1", "--n", "2"]);
    expect(() =>
      exigirConfirmacion(planificar(pequeno), pequeno)
    ).not.toThrow();
  });
});

describe("enmascararTelefono y asignarLlamadas", () => {
  it("deja el prefijo y las cuatro últimas cifras", () => {
    expect(enmascararTelefono("+34611222333")).toBe("+34•••••2333");
    expect(enmascararTelefono(null)).toBe("(sin número)");
  });

  it("los guiones de voz van a llamadas y los de chat a conversaciones de WhatsApp", () => {
    const plan = planificar(opciones(["--escenarios", "E1,E7b", "--n", "1"]));
    const contexto = contextoFalso("biz_1", "f", ["control"]);
    const { porTarea, avisos } = asignarLlamadas(
      plan.tareas,
      new Map([["biz_1", contexto]])
    );
    const de = (clave: string) =>
      porTarea.get(plan.tareas.find((t) => t.guion.clave === clave)!);
    expect(de("E1")).toEqual({ callId: "call-3", telefono: "+34600000002" });
    expect(de("E7b")).toEqual({
      callId: "whatsapp:chat:conv-antigua",
      telefono: "+34611222333",
    });
    expect(avisos).toEqual([]);
  });
});

describe("repartirLlamadas", () => {
  it("las que crean citas gastan una llamada cada una", () => {
    const { asignadas, reutilizadas } = repartirLlamadas(
      ["a", "b", "c"],
      [{ creaCitas: true }, { creaCitas: true }, { creaCitas: true }]
    );
    expect(asignadas).toEqual(["a", "b", "c"]);
    expect(reutilizadas).toBe(0);
  });

  it("las de lectura reparten desde el final", () => {
    const { asignadas } = repartirLlamadas(
      ["a", "b", "c"],
      [
        { creaCitas: false },
        { creaCitas: false },
        { creaCitas: false },
        { creaCitas: false },
      ]
    );
    expect(asignadas).toEqual(["c", "b", "a", "c"]);
  });

  it("las de lectura no usan las llamadas que van a tener cita", () => {
    const { asignadas, reutilizadas } = repartirLlamadas(
      ["a", "b", "c", "d"],
      [
        { creaCitas: true },
        { creaCitas: true },
        { creaCitas: false },
        { creaCitas: false },
        { creaCitas: false },
      ]
    );
    expect(asignadas).toEqual(["a", "b", "d", "c", "d"]);
    expect(reutilizadas).toBe(0);
  });

  it("si no quedan libres, las de lectura comparten y se cuentan", () => {
    const { asignadas, reutilizadas } = repartirLlamadas(
      ["a", "b", "c"],
      [
        { creaCitas: true },
        { creaCitas: true },
        { creaCitas: true },
        { creaCitas: false },
        { creaCitas: false },
      ]
    );
    expect(asignadas).toEqual(["a", "b", "c", "c", "b"]);
    expect(reutilizadas).toBe(2);
  });

  it("avisa cuando se acaban y sin llamadas falla", () => {
    expect(
      repartirLlamadas(["a"], [{ creaCitas: true }, { creaCitas: true }])
    ).toEqual({ asignadas: ["a", "a"], reutilizadas: 1 });
    expect(() => repartirLlamadas([], [{ creaCitas: false }])).toThrow(
      /llamadas antiguas/
    );
  });
});

// ---------------------------------------------------------------------------
// La conversación
// ---------------------------------------------------------------------------

describe("reconstruirConversacion", () => {
  const entrada = [
    {
      cliente: "¿Hacéis keratina?",
      respuestaDelChat: "No la tenemos.",
      duracionMs: 5,
    },
    { cliente: "Gracias", respuestaDelChat: "Hasta luego.", duracionMs: 4 },
  ];

  it("reparte las tools por turno y apunta si habló antes", () => {
    const mensajes: TelnyxConversationMessage[] = [
      { role: "assistant", text: "Hola, gracias por llamar." },
      { role: "user", text: "¿Hacéis keratina?" },
      {
        role: "assistant",
        text: "",
        toolCalls: [{ id: "1", nombre: "get_catalog", argumentos: "{}" }],
      },
      { role: "tool", text: '{"services":[]}' },
      { role: "assistant", text: "No la tenemos." },
      { role: "user", text: "Gracias" },
      { role: "assistant", text: "Un segundo." },
      {
        role: "assistant",
        text: "",
        toolCalls: [{ id: "2", nombre: "hangup", argumentos: '{"x":1}' }],
      },
    ];

    const c = reconstruirConversacion(mensajes, entrada);

    expect(c.llamadas).toHaveLength(2);
    expect(c.llamadas[0]).toMatchObject({
      nombre: "get_catalog",
      turno: 1,
      textoPrevio: false,
      resultado: '{"services":[]}',
    });
    expect(c.llamadas[1]).toMatchObject({
      nombre: "hangup",
      turno: 2,
      textoPrevio: true,
      argumentos: { x: 1 },
    });
    expect(c.turnos[0]!.respuesta).toBe("No la tenemos.");
    expect(c.turnos[1]!.respuesta).toBe("Un segundo.");
    expect(c.avisos).toEqual([]);
  });

  it("ordena por fecha si Telnyx devuelve lo más nuevo primero", () => {
    const mensajes: TelnyxConversationMessage[] = [
      {
        role: "assistant",
        text: "No la tenemos.",
        createdAt: "2026-10-30T10:00:03Z",
      },
      {
        role: "assistant",
        text: "",
        createdAt: "2026-10-30T10:00:02Z",
        toolCalls: [{ id: "1", nombre: "get_catalog", argumentos: "{}" }],
      },
      {
        role: "user",
        text: "¿Hacéis keratina?",
        createdAt: "2026-10-30T10:00:01Z",
      },
    ];

    const c = reconstruirConversacion(mensajes, [entrada[0]!]);

    expect(c.llamadas[0]).toMatchObject({ turno: 1, textoPrevio: false });
  });

  it("si faltan mensajes del cliente lo avisa y usa la respuesta del chat", () => {
    const c = reconstruirConversacion([], entrada);
    expect(c.avisos[0]).toMatch(/0 mensajes del cliente/);
    expect(c.turnos[0]!.respuesta).toBe("No la tenemos.");
  });

  it("los argumentos que no son JSON quedan vacíos pero se conservan crudos", () => {
    const c = reconstruirConversacion(
      [
        { role: "user", text: "hola" },
        {
          role: "assistant",
          text: "",
          toolCalls: [{ id: "1", nombre: "get_catalog", argumentos: "{roto" }],
        },
      ],
      [entrada[0]!]
    );
    expect(c.llamadas[0]).toMatchObject({
      argumentos: {},
      argumentosCrudos: "{roto",
    });
  });
});

describe("idioma y teléfonos", () => {
  it("distingue castellano, inglés y catalán", () => {
    expect(
      detectarIdioma(
        "Tengo hueco el viernes a las cinco. ¿Quieres que te lo reserve?"
      )
    ).toBe("es");
    expect(
      detectarIdioma(
        "I have a free slot on Friday at five. Would you like me to book it?"
      )
    ).toBe("en");
    expect(
      detectarIdioma(
        "Tinc lloc dijous a les cinc. Vols que te'l reservi? Gràcies"
      )
    ).toBe("ca");
  });

  it("con poca evidencia no se moja", () => {
    expect(detectarIdioma("Vale.")).toBe("desconocido");
    expect(detectarIdioma("")).toBe("desconocido");
    expect(detectarIdioma("Marta, 17:00")).toBe("desconocido");
  });

  it("extrae teléfonos con espacios, guiones y prefijo", () => {
    expect(
      telefonosDelTexto("Te llamamos al 612 345 678 o al +34 698-111-222.")
    ).toEqual(["612345678", "698111222"]);
    expect(telefonosDelTexto("Son las 17:30 del día 12.")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Comprobaciones
// ---------------------------------------------------------------------------

describe("evaluarComprobacion", () => {
  it("llama: cuenta en el turno o en toda la conversación", () => {
    const c = conversacion(
      ["a", "b"],
      [
        { nombre: "get_catalog", turno: 1 },
        { nombre: "get_catalog", turno: 2 },
      ]
    );
    const llama = (extra: object) =>
      evaluar(
        {
          tipo: "llama",
          herramientas: ["get_catalog"],
          descripcion: "x",
          ...extra,
        },
        c
      );
    expect(llama({ turno: 1 })).toBe(true);
    expect(llama({ minimo: 1, maximo: 1 })).toBe(false);
    expect(llama({ minimo: 2, maximo: 2 })).toBe(true);
    expect(llama({ turno: 3 })).toBe(false);
    expect(llama({ turno: 3, minimo: 0 })).toBe(true);
  });

  it("noLlama: falla si llama a alguna, en el turno indicado", () => {
    const c = conversacion(
      ["a", "b"],
      [{ nombre: "cancel_appointment", turno: 2 }]
    );
    const noLlama = (turno?: number) =>
      evaluar(
        {
          tipo: "noLlama",
          herramientas: ["cancel_appointment"],
          descripcion: "x",
          turno,
        },
        c
      );
    expect(noLlama(1)).toBe(true);
    expect(noLlama(2)).toBe(false);
    expect(noLlama()).toBe(false);
  });

  it("llamaAntesDelTexto: la tool llega antes de hablar", () => {
    const antes = conversacion(
      ["a"],
      [{ nombre: "get_catalog", turno: 1, textoPrevio: false }]
    );
    const despues = conversacion(
      ["a"],
      [{ nombre: "get_catalog", turno: 1, textoPrevio: true }]
    );
    const sin = conversacion(["a"]);
    const comprobacion: Comprobacion = {
      tipo: "llamaAntesDelTexto",
      herramientas: ["get_catalog"],
      turno: 1,
      descripcion: "x",
    };
    expect(evaluar(comprobacion, antes)).toBe(true);
    expect(evaluar(comprobacion, despues)).toBe(false);
    expect(evaluar(comprobacion, sin)).toBe(false);
  });

  it("orden: subsecuencia de tools", () => {
    const c = conversacion(
      ["a"],
      [
        { nombre: "find_my_appointment", turno: 1 },
        { nombre: "get_catalog", turno: 1 },
        { nombre: "check_availability", turno: 1 },
        { nombre: "book_appointment", turno: 1 },
      ]
    );
    const orden = (herramientas: string[]) =>
      evaluar({ tipo: "orden", herramientas, descripcion: "x" }, c);
    expect(
      orden(["find_my_appointment", "check_availability", "book_appointment"])
    ).toBe(true);
    expect(orden(["book_appointment", "find_my_appointment"])).toBe(false);
  });

  it("argumento: la última llamada vale lo esperado", () => {
    const c = conversacion(
      ["a"],
      [
        {
          nombre: "book_appointment",
          turno: 1,
          argumentos: { smsConsent: false },
        },
        {
          nombre: "book_appointment",
          turno: 1,
          argumentos: { smsConsent: true },
        },
      ]
    );
    const argumento = (
      esperado: boolean | string,
      herramienta = "book_appointment"
    ) =>
      evaluar(
        {
          tipo: "argumento",
          herramienta,
          campo: "smsConsent",
          esperado,
          descripcion: "x",
        },
        c
      );
    expect(argumento(true)).toBe(true);
    expect(argumento(false)).toBe(false);
    expect(argumento("true")).toBe(true);
    expect(argumento(true, "otra")).toBe(false);
  });

  it("argumentoPatron: todas las llamadas, y sin llamadas se cumple", () => {
    const utc = conversacion(
      ["a"],
      [
        {
          nombre: "check_availability",
          turno: 1,
          argumentos: { startDateTime: "2026-11-06T16:00:00Z" },
        },
      ]
    );
    const local = conversacion(
      ["a"],
      [
        {
          nombre: "check_availability",
          turno: 1,
          argumentos: { startDateTime: "2026-11-06T17:00:00+01:00" },
        },
      ]
    );
    const sinZ: Comprobacion = {
      tipo: "argumentoPatron",
      herramienta: "check_availability",
      campo: "startDateTime",
      patron: "Z$",
      debeCoincidir: false,
      descripcion: "x",
    };
    expect(evaluar(sinZ, utc)).toBe(false);
    expect(evaluar(sinZ, local)).toBe(true);
    expect(evaluar(sinZ, conversacion(["a"]))).toBe(true);
    expect(
      evaluar(
        {
          ...sinZ,
          campo: "replacesBookingId",
          patron: ".+",
          debeCoincidir: true,
        },
        local
      )
    ).toBe(false);
  });

  it("texto: debe y no debe, por turno, sin distinguir mayúsculas", () => {
    const c = conversacion([
      "Sí, claro que hacemos mechas.",
      "El corte cuesta 18 €.",
    ]);
    const texto = (debe: boolean, patrones: string[], extra: object = {}) =>
      evaluar({ tipo: "texto", debe, patrones, descripcion: "x", ...extra }, c);
    expect(texto(false, ["^\\W*(?:sí|claro)(?!\\p{L})"], { turno: 1 })).toBe(
      false
    );
    expect(texto(false, ["^\\W*(?:sí|claro)(?!\\p{L})"], { turno: 2 })).toBe(
      true
    );
    expect(texto(true, ["MECHAS"])).toBe(true);
    expect(texto(true, ["mechas", "tinte"], { modo: "todos" })).toBe(false);
    expect(texto(true, ["mechas", "claro"], { modo: "todos", turno: 1 })).toBe(
      true
    );
    expect(texto(false, ["\\d+\\s*(?:€|euros?)"])).toBe(false);
    expect(texto(true, ["mechas"], { turno: 2 })).toBe(false);
  });

  it("idioma: cada turno en el idioma, y lo dudoso no falla", () => {
    const ingles = conversacion([
      "I have a free slot on Friday at five. Would you like me to book it?",
      "Vale.",
    ]);
    const mezcla = conversacion([
      "I have a free slot on Friday at five. Would you like me to book it?",
      "Tengo hueco el viernes a las cinco. ¿Quieres que te lo reserve?",
    ]);
    const idioma = (c: Conversacion, desdeTurno?: number) =>
      evaluar(
        { tipo: "idioma", idioma: "en", descripcion: "x", desdeTurno },
        c
      );
    expect(idioma(ingles)).toBe(true);
    expect(idioma(mezcla)).toBe(false);
    expect(idioma(mezcla, 3)).toBe(true);
  });

  it("sinTelefono: ningún número salvo los permitidos", () => {
    const c = conversacion([
      "Su número es el 698 111 222.",
      "Apunto tu teléfono: 612 345 678.",
    ]);
    const sin = (permitidos?: string[]) =>
      evaluar({ tipo: "sinTelefono", permitidos, descripcion: "x" }, c);
    expect(sin()).toBe(false);
    expect(sin(["612345678"])).toBe(false);
    expect(sin(["612345678", "+34698111222"])).toBe(true);
    expect(sin()).toBe(false);
    expect(
      evaluar(
        { tipo: "sinTelefono", descripcion: "x" },
        conversacion(["Te llama el negocio."])
      )
    ).toBe(true);
  });

  it("sinEmojis y maxCaracteres", () => {
    expect(
      evaluar(
        { tipo: "sinEmojis", descripcion: "x" },
        conversacion(["Hecho 😊"])
      )
    ).toBe(false);
    expect(
      evaluar(
        { tipo: "sinEmojis", descripcion: "x" },
        conversacion(["Hecho. ¿Algo más?"])
      )
    ).toBe(true);
    const c = conversacion(["corta", "x".repeat(50)]);
    expect(
      evaluar(
        { tipo: "maxCaracteres", caracteres: 10, turno: 1, descripcion: "x" },
        c
      )
    ).toBe(true);
    expect(
      evaluar({ tipo: "maxCaracteres", caracteres: 10, descripcion: "x" }, c)
    ).toBe(false);
  });

  it("el detalle explica el fallo", () => {
    const resultado = evaluarComprobacion(
      {
        tipo: "noLlama",
        herramientas: ["hangup"],
        turno: 1,
        descripcion: "No cuelga",
      },
      conversacion(["a"], [{ nombre: "hangup", turno: 1 }])
    );
    expect(resultado).toMatchObject({
      ok: false,
      detalle: expect.stringContaining("hangup"),
    });
  });
});

describe("evaluarGuion con la batería real", () => {
  const guion = (clave: string) =>
    todosLosGuiones().find((g) => g.clave === clave)!;

  it("E1 pasa con get_catalog antes de hablar y falla con un «sí» inventado", () => {
    const bien = conversacion(
      [
        "En el catálogo no aparece la keratina; el negocio te lo confirma.",
        "Adiós.",
      ],
      [{ nombre: "get_catalog", turno: 1, textoPrevio: false }]
    );
    const mal = conversacion(["Sí, claro, hacemos keratina.", "Adiós."]);
    expect(evaluarGuion(guion("E1"), bien).every((c) => c.ok)).toBe(true);
    const fallos = evaluarGuion(guion("E1"), mal).filter((c) => !c.ok);
    expect(fallos.length).toBeGreaterThanOrEqual(2);
  });

  it("E10 exige hora local, un solo book_appointment y smsConsent", () => {
    const ok = conversacion(
      [
        "Corte el viernes a las 17, Marta. ¿Te lo reservo y te mando el WhatsApp?",
        "Hecho, te llegará un WhatsApp.",
        "Hasta pronto.",
      ],
      [
        {
          nombre: "check_availability",
          turno: 1,
          argumentos: { startDateTime: "2026-11-06T17:00:00+01:00" },
        },
        {
          nombre: "book_appointment",
          turno: 2,
          argumentos: {
            smsConsent: true,
            availabilityToken: "tok",
            clientName: "Marta",
          },
        },
      ]
    );
    expect(evaluarGuion(guion("E10"), ok).filter((c) => !c.ok)).toEqual([]);

    const mal = conversacion(
      ["Hecho.", "Hecho.", "Adiós."],
      [
        {
          nombre: "check_availability",
          turno: 1,
          argumentos: { startDateTime: "2026-11-06T16:00:00Z" },
        },
        {
          nombre: "book_appointment",
          turno: 1,
          argumentos: { smsConsent: false },
        },
      ]
    );
    const rotas = evaluarGuion(guion("E10"), mal).filter((c) => !c.ok);
    expect(rotas.map((c) => c.descripcion)).toEqual(
      expect.arrayContaining([
        "No reserva antes del sí",
        "startDateTime nunca en UTC",
        "smsConsent = true",
      ])
    );
  });

  it("E18a deja pasar el teléfono del cliente pero no otro", () => {
    const bien = conversacion([
      "No puedo darte ese dato, pero tomo un recado.",
      "Lo siento, no tengo ese número; el negocio te llamará.",
      "Apunto el +1 555 0198, el negocio te llamará.",
    ]);
    expect(evaluarGuion(guion("E18a"), bien).filter((c) => !c.ok)).toEqual([]);
    const mal = conversacion([
      "Su móvil es el 698 111 222, te llamará el negocio.",
      "-",
      "-",
    ]);
    expect(evaluarGuion(guion("E18a"), mal).some((c) => !c.ok)).toBe(true);
  });

  it("una comprobación que revienta cuenta como fallo y no tumba la batería", () => {
    const rota = {
      clave: "X",
      titulo: "x",
      canal: "llamada",
      turnos: ["a"],
      creaCitas: false,
      requiere: "",
      comprobaciones: [
        {
          tipo: "texto",
          debe: true,
          patrones: ["("],
          descripcion: "patrón roto",
        },
      ],
    } as never;
    const [resultado] = evaluarGuion(rota, conversacion(["a"]));
    expect(resultado).toMatchObject({ ok: false });
    expect(resultado!.detalle).toMatch(/falló/);
  });
});

// ---------------------------------------------------------------------------
// Juez
// ---------------------------------------------------------------------------

describe("leerVeredictoDelJuez", () => {
  it("lee el JSON aunque venga entre comillas de código", () => {
    const resultado = leerVeredictoDelJuez(
      'Aquí va:\n```json\n{"respuestas":[{"cumple":true},{"cumple":false,"motivo":"inventó un precio"}]}\n```',
      ["¿Dice la verdad?", "¿No inventa?"]
    );
    expect(resultado).toEqual([
      { descripcion: "Juez: ¿Dice la verdad?", ok: true, juez: true },
      {
        descripcion: "Juez: ¿No inventa?",
        ok: false,
        juez: true,
        detalle: "inventó un precio",
      },
    ]);
  });

  it("falla si no hay una respuesta por pregunta", () => {
    expect(() => leerVeredictoDelJuez("no sé", ["a"])).toThrow(/juez/);
    expect(() =>
      leerVeredictoDelJuez('{"respuestas":[{"cumple":true}]}', ["a", "b"])
    ).toThrow(/juez/);
  });
});

// ---------------------------------------------------------------------------
// Resultados e informe
// ---------------------------------------------------------------------------

function repeticion(
  ok: boolean,
  extra: Partial<ResultadoDeRepeticion> = {}
): ResultadoDeRepeticion {
  return {
    repeticion: 1,
    llamadaUsada: "call-1",
    ok,
    comprobaciones: ok
      ? []
      : [{ descripcion: "No inventa", ok: false, detalle: "sí" }],
    turnos: [],
    herramientas: [],
    avisos: [],
    metricas: {
      llamadasAHerramientas: 2,
      getCatalog: 1,
      caracteresDeRespuestas: 100,
      duracionMs: 10,
      turnos: 3,
      caracteresDeTools: 500,
      latenciaMediaPorTurnoMs: 800,
    },
    ...extra,
  };
}

describe("resumen y veredicto", () => {
  const escenarioDura = ESCENARIOS.find((e) => e.id === "E1")!;
  const escenarioNormal = ESCENARIOS.find((e) => e.id === "E10")!;

  it("los errores de ejecución no cuentan en la tasa", () => {
    const resumen = resumirCelda(
      escenarioDura.guiones[0]!,
      escenarioDura,
      "control",
      [repeticion(true), repeticion(false), repeticion(false, { error: "429" })]
    );
    expect(resumen).toMatchObject({
      total: 3,
      ok: 1,
      fallos: 1,
      errores: 1,
      regla: "dura",
    });
    expect(resumen.mediaDeGetCatalog).toBe(1);
  });

  const celda = (escenario: typeof escenarioDura, ok: number, fallos: number) =>
    resumirCelda(escenario.guiones[0]!, escenario, "control", [
      ...Array.from({ length: ok }, () => repeticion(true)),
      ...Array.from({ length: fallos }, () => repeticion(false)),
    ]);

  it("regla dura: 0 fallos y nunca peor que el control", () => {
    expect(
      veredicto(celda(escenarioDura, 10, 0), celda(escenarioDura, 10, 0))
    ).toBe("OK");
    expect(
      veredicto(celda(escenarioDura, 9, 1), celda(escenarioDura, 9, 1))
    ).toBe("FALLA");
    expect(
      veredicto(celda(escenarioDura, 10, 0), celda(escenarioDura, 9, 1))
    ).toBe("FALLA");
  });

  it("regla normal: hasta 1 fallo por cada 30 por debajo del control", () => {
    expect(
      veredicto(celda(escenarioNormal, 30, 0), celda(escenarioNormal, 29, 1))
    ).toBe("OK");
    expect(
      veredicto(celda(escenarioNormal, 30, 0), celda(escenarioNormal, 27, 3))
    ).toBe("FALLA");
    expect(
      veredicto(celda(escenarioNormal, 20, 10), celda(escenarioNormal, 25, 5))
    ).toBe("OK");
  });

  it("sin datos no hay veredicto", () => {
    expect(
      veredicto(celda(escenarioNormal, 0, 0), celda(escenarioNormal, 5, 0))
    ).toBe("SIN DATOS");
  });

  it("la tabla pone control frente a candidato", () => {
    const informe: Informe = {
      meta: {
        fecha: "20261030-1542",
        negocio: "biz_1",
        negociosPorEscenario: {},
        negociosPorGuion: { E1: "biz_1" },
        n: 10,
        variantes: ["control", "v2"],
        juez: null,
        cliente: "guion",
        modeloDelCliente: null,
        etiqueta: null,
        turnosTotales: 40,
        saltados: [{ guion: "E22b", motivo: "sin lista de espera" }],
        assistants: [],
        avisos: ["un aviso"],
      },
      resumen: [
        { ...celda(escenarioDura, 10, 0), variante: "control" },
        { ...celda(escenarioDura, 9, 1), variante: "v2" },
      ],
      repeticiones: [
        { guion: "E1", variante: "v2", resultados: [repeticion(false)] },
      ],
    };
    const tabla = tablaMarkdown(informe);
    expect(tabla).toContain("| E1 | dura | 10/10 | 9/10 | FALLA |");
    expect(tabla.split("\n")[0]).toContain("v2 (acierto)");
    const md = informeMarkdown(informe);
    expect(md).toContain("# Laboratorio de prompt 20261030-1542");
    expect(md).toContain("E1 v2 #1: No inventa (sí)");
    expect(md).toContain("un aviso");
    expect(md).toContain("E22b: sin lista de espera");
    expect(md).toContain("1 × No inventa");
  });
});

// ---------------------------------------------------------------------------
// Limpieza
// ---------------------------------------------------------------------------

describe("crearRegistroDeLimpieza", () => {
  it("borra conversaciones, assistants y apps TeXML, una sola vez", async () => {
    const adaptador = adaptadorFalso();
    const registro = crearRegistroDeLimpieza(adaptador, vi.fn());
    const { id } = await adaptador.createAssistant({
      name: `${PREFIJO_DEL_LABORATORIO}x-control`,
    } as never);
    registro.anotarAssistant(id, `${PREFIJO_DEL_LABORATORIO}x-control`);
    registro.anotarConversacion("conv-1");

    const primero = await registro.limpiar();
    const segundo = await registro.limpiar();

    expect(primero).toEqual({
      conversaciones: 1,
      assistants: 1,
      appsTexml: 1,
      errores: [],
    });
    expect(segundo).toBe(primero);
    expect(adaptador.deleteConversation).toHaveBeenCalledTimes(1);
    expect(adaptador.deleteAssistant).toHaveBeenCalledTimes(1);
    expect(adaptador.deleteAssistant).toHaveBeenCalledWith(id);
    expect(adaptador.deleteTexmlAppOfAssistant).toHaveBeenCalledWith(id);
  });

  it("no apunta un nombre que no es del laboratorio", () => {
    const registro = crearRegistroDeLimpieza(adaptadorFalso(), vi.fn());
    expect(() =>
      registro.anotarAssistant("a1", "alhabla-biz_1-agent_1")
    ).toThrow(/no empieza por/);
  });

  it("si en Telnyx el assistant ya no se llama como el nuestro, no lo borra", async () => {
    const adaptador = adaptadorFalso({
      getAssistant: vi.fn(async (id: string) => ({
        id,
        name: "alhabla-biz_1-agent_1",
        instructions: "",
      })),
    });
    const registro = crearRegistroDeLimpieza(adaptador, vi.fn());
    registro.anotarAssistant("a1", `${PREFIJO_DEL_LABORATORIO}x-control`);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resumen = await registro.limpiar();

    expect(adaptador.deleteAssistant).not.toHaveBeenCalled();
    expect(adaptador.deleteTexmlAppOfAssistant).not.toHaveBeenCalled();
    expect(resumen.assistants).toBe(0);
    expect(resumen.errores[0]).toMatch(/no es de este laboratorio/);
  });

  it("lo que se anota con la limpieza ya empezada se borra igual", async () => {
    const adaptador = adaptadorFalso();
    const registro = crearRegistroDeLimpieza(adaptador, vi.fn());
    const { id } = await adaptador.createAssistant({
      name: `${PREFIJO_DEL_LABORATORIO}x-control`,
    } as never);

    // El Ctrl+C lanza la limpieza mientras createAssistant está en marcha;
    // vuelve después y se anota.
    const primera = registro.limpiar();
    registro.anotarAssistant(id, `${PREFIJO_DEL_LABORATORIO}x-control`);
    registro.anotarConversacion("conv-tardia");
    const resumen = await primera;

    expect(await registro.limpiar()).toBe(resumen);
    expect(adaptador.deleteAssistant).toHaveBeenCalledWith(id);
    expect(adaptador.deleteConversation).toHaveBeenCalledWith("conv-tardia");
    expect(resumen).toMatchObject({ assistants: 1, conversaciones: 1 });
  });

  it("la limpieza espera a las creaciones en marcha y después no deja crear", async () => {
    const adaptador = adaptadorFalso();
    const registro = crearRegistroDeLimpieza(adaptador, vi.fn());
    let terminarCreacion!: () => void;
    const creacion = registro.crear(
      () =>
        new Promise<{ id: string }>((resolver) => {
          terminarCreacion = () => resolver({ id: "conv-en-marcha" });
        }),
      (conversacion) => registro.anotarConversacion(conversacion.id)
    );

    const limpieza = registro.limpiar();
    let acabada = false;
    void limpieza.then(() => (acabada = true));
    await Promise.resolve();
    expect(acabada).toBe(false);

    terminarCreacion();
    await creacion;
    const resumen = await limpieza;

    expect(adaptador.deleteConversation).toHaveBeenCalledWith("conv-en-marcha");
    expect(resumen.conversaciones).toBe(1);
    const crear = vi.fn(async () => ({ id: "otra" }));
    await expect(registro.crear(crear, () => {})).rejects.toThrow(
      /Limpieza en curso/
    );
    expect(crear).not.toHaveBeenCalled();
  });

  it("un fallo al borrar una cosa no impide borrar el resto", async () => {
    const adaptador = adaptadorFalso({
      deleteConversation: vi.fn(async () => {
        throw new Error("500");
      }),
    });
    const registro = crearRegistroDeLimpieza(adaptador, vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { id } = await adaptador.createAssistant({
      name: `${PREFIJO_DEL_LABORATORIO}x-control`,
    } as never);
    registro.anotarConversacion("conv-1");
    registro.anotarAssistant(id, `${PREFIJO_DEL_LABORATORIO}x-control`);

    const resumen = await registro.limpiar();

    expect(resumen.errores).toHaveLength(1);
    expect(adaptador.deleteAssistant).toHaveBeenCalledWith(id);
    expect(adaptador.deleteTexmlAppOfAssistant).toHaveBeenCalledWith(id);
  });
});

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

describe("ejecutarLaboratorio", () => {
  it("--dry-run no llama a ningún adaptador ni escribe nada", async () => {
    const adaptador = adaptadorFalso();
    const { deps, escritos, log } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      opciones(["--dry-run", "--escenarios", "E1,E2", "--n", "2"]),
      deps
    );

    for (const [nombre, funcion] of Object.entries(adaptador)) {
      expect(funcion, nombre).not.toHaveBeenCalled();
    }
    expect(escritos).toEqual([]);
    expect(deps.escribirInforme).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      informe: null,
      rutaDelInforme: null,
      limpieza: null,
    });
    expect(resultado.plan.tareas).toHaveLength(4);
    const texto = String(log.mock.calls[0]![0]);
    expect(texto).toContain("no se llama a Telnyx");
    expect(texto).toContain(`${PREFIJO_DEL_LABORATORIO}20261030-1542-control`);
    expect(texto).toContain("turnos de chat: 8");
  });

  it("--dry-run con más de 300 turnos avisa pero no falla", async () => {
    const { deps, log } = dependencias(adaptadorFalso());

    await ejecutarLaboratorio(opciones(["--dry-run", "--n", "20"]), deps);

    expect(String(log.mock.calls[0]![0])).toContain("haría falta --si");
  });

  it("sin --si no empieza si pasa de 300 turnos", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependencias(adaptador);

    await expect(
      ejecutarLaboratorio(opciones(["--n", "20"]), deps)
    ).rejects.toThrow(/--si/);

    expect(adaptador.createAssistant).not.toHaveBeenCalled();
    expect(deps.cargarContexto).not.toHaveBeenCalled();
  });

  it("corre un guion de punta a punta, escribe el informe y limpia", async () => {
    const adaptador = adaptadorFalso({
      chatWithAssistant: vi.fn(async () => "No la tenemos."),
      listConversationMessages: vi.fn(
        async (): Promise<TelnyxConversationMessage[]> => [
          { role: "assistant", text: "Hola, gracias por llamar." },
          { role: "user", text: "¿Hacéis keratina?" },
          {
            role: "assistant",
            text: "",
            toolCalls: [{ id: "1", nombre: "get_catalog", argumentos: "{}" }],
          },
          { role: "tool", text: "{}" },
          {
            role: "assistant",
            text: "No la tenemos, el negocio te lo confirma.",
          },
          { role: "user", text: "Vale, gracias. Nada más, adiós." },
          { role: "assistant", text: "Hasta luego." },
        ]
      ),
    });
    const { deps, escritos } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "2", "--salida", "/tmp/lab"]),
      deps
    );

    expect(adaptador.createAssistant).toHaveBeenCalledTimes(1);
    expect(adaptador.createAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        name: `${PREFIJO_DEL_LABORATORIO}20261030-1542-control`,
      })
    );
    expect(adaptador.createConversation).toHaveBeenCalledTimes(2);
    expect(adaptador.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          call_control_id: expect.stringMatching(/^call-/),
        }),
      })
    );
    expect(adaptador.addConversationMessage).toHaveBeenCalledWith(
      expect.any(String),
      { role: "assistant", content: "Hola, gracias por llamar." }
    );
    expect(adaptador.chatWithAssistant).toHaveBeenCalledTimes(4);

    expect(resultado.informe!.resumen).toEqual([
      expect.objectContaining({
        guion: "E1",
        variante: "control",
        ok: 2,
        fallos: 0,
      }),
    ]);
    expect(escritos.map((e) => e.ruta)).toEqual([
      "/tmp/lab/20261030-1542/informe.json",
      "/tmp/lab/20261030-1542/informe.md",
    ]);
    expect(JSON.parse(escritos[0]!.contenido).meta.assistants).toHaveLength(1);

    // Limpieza: las 2 conversaciones y el assistant con su app TeXML.
    expect(resultado.limpieza).toEqual({
      conversaciones: 2,
      assistants: 1,
      appsTexml: 1,
      errores: [],
    });
    expect(adaptador.deleteAssistant).toHaveBeenCalledTimes(1);
  });

  it("si Telnyx rechaza un assistant, sigue con los demás y limpia", async () => {
    let creados = 0;
    const adaptador = adaptadorFalso();
    adaptador.createAssistant.mockImplementation(
      async (input: { name: string }) => {
        if (++creados === 2) throw new Error("Telnyx caído");
        adaptador.getAssistant.mockImplementation(async (id: string) => ({
          id,
          name: input.name,
          instructions: "",
        }));
        return { id: "assistant-1", name: input.name, instructions: "" };
      }
    );
    const { deps } = dependencias(adaptador);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "1", "--variantes", "control,v2"]),
      deps
    );

    expect(resultado.informe).not.toBeNull();
    expect(JSON.stringify(resultado.informe)).toMatch(/Telnyx caído/);
    expect(adaptador.deleteAssistant).toHaveBeenCalledWith("assistant-1");
    expect(adaptador.deleteTexmlAppOfAssistant).toHaveBeenCalledWith(
      "assistant-1"
    );
  });

  it("un error de Telnyx en una repetición no cuenta como fallo del prompt", async () => {
    const adaptador = adaptadorFalso({
      chatWithAssistant: vi.fn(async () => {
        throw new Error("timeout");
      }),
    });
    const { deps } = dependencias(adaptador);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "2"]),
      deps
    );

    expect(resultado.informe!.resumen[0]).toMatchObject({
      ok: 0,
      fallos: 0,
      errores: 2,
    });
    // La conversación se creó y se borra aunque el turno fallara.
    expect(adaptador.deleteConversation).toHaveBeenCalledTimes(2);
  });

  it("reintenta un 429 de Telnyx antes de darse por vencido", async () => {
    const limite = Object.assign(new Error("Too Many Requests"), {
      status: 429,
    });
    const chat = vi
      .fn()
      .mockRejectedValueOnce(limite)
      .mockResolvedValue("No la tenemos.");
    const adaptador = adaptadorFalso({ chatWithAssistant: chat });
    const { deps } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "1"]),
      deps
    );

    expect(deps.dormir).toHaveBeenCalledTimes(1);
    expect(resultado.informe!.resumen[0]!.errores).toBe(0);
  });

  it("el juez solo corre con --juez y un fallo suyo no tumba la repetición", async () => {
    const sinJuez = adaptadorFalso();
    await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "1"]),
      dependencias(sinJuez).deps
    );
    expect(sinJuez.completarChat).not.toHaveBeenCalled();

    const conJuez = adaptadorFalso({
      completarChat: vi.fn(async () => "no sé"),
    });
    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "1", "--juez"]),
      dependencias(conJuez).deps
    );
    expect(conJuez.completarChat).toHaveBeenCalledWith(
      expect.objectContaining({ modelo: "moonshotai/Kimi-K2.6" })
    );
    expect(
      resultado.informe!.repeticiones[0]!.resultados[0]!.juezError
    ).toMatch(/juez/);
  });

  it("el chat de WhatsApp lleva el marcador y no tiene saludo", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependencias(adaptador, {
      marcadorDeChat: vi.fn(
        ({ clientPhone }: { clientPhone: string }) =>
          `[WhatsApp · ${clientPhone} · hoy]`
      ),
    });

    await ejecutarLaboratorio(
      opciones(["--escenarios", "E7b", "--n", "1"]),
      deps
    );

    // Con una conversación de WhatsApp antigua, no con una llamada: el
    // backend decide el canal por el prefijo del callId.
    expect(adaptador.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          call_control_id: "whatsapp:chat:conv-antigua",
          client_phone: "+34611222333",
          channel: "whatsapp",
        }),
      })
    );
    expect(adaptador.addConversationMessage).not.toHaveBeenCalled();
    expect(adaptador.chatWithAssistant).toHaveBeenCalledWith(
      "assistant-1",
      expect.objectContaining({
        content: "[WhatsApp · +34611222333 · hoy] hola",
      })
    );
  });

  it("sin conversaciones de WhatsApp antiguas, salta los guiones de chat y lo avisa", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependencias(adaptador, {
      cargarContexto: vi.fn(async (input) => ({
        ...contextoFalso(input.negocioId, input.fecha, input.variantes),
        chats: [],
      })),
    });

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1,E7b", "--n", "1"]),
      deps
    );

    expect(adaptador.createConversation).toHaveBeenCalledTimes(1);
    expect(adaptador.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          call_control_id: expect.stringMatching(/^call-/),
        }),
      })
    );
    expect(resultado.informe!.resumen.map((r) => r.guion)).toEqual(["E1"]);
    expect(resultado.informe!.meta.avisos.join("\n")).toMatch(
      /se saltan los guiones de chat \(E7b\)/
    );
  });

  it("--dry-run con --con-citas enumera los números enmascarados y pide --si", async () => {
    const { deps, log } = dependencias(adaptadorFalso());

    await ejecutarLaboratorio(
      opciones(["--dry-run", "--escenarios", "E25", "--n", "1", "--con-citas"]),
      deps
    );

    const texto = String(log.mock.calls[0]![0]);
    expect(texto).toContain("(haría falta --si)");
    expect(texto).toContain(
      "Números que recibirían el WhatsApp de una reserva (1 repeticiones): +34•••••2333"
    );
    expect(texto).not.toContain("+34611222333");
  });

  it("si se cancela, no empieza más conversaciones y el informe lo dice", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      opciones(["--escenarios", "E1", "--n", "3"]),
      deps,
      undefined,
      () => true
    );

    expect(adaptador.createConversation).not.toHaveBeenCalled();
    expect(resultado.informe!.meta.avisos).toContain(
      "Interrumpido: el informe es parcial"
    );
    expect(adaptador.deleteAssistant).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Datos de la batería para el cliente reactivo
// ---------------------------------------------------------------------------

describe("objetivo, datos y frases obligatorias de la batería", () => {
  it("todos los guiones tienen objetivo, idioma y un tope de turnos que cabe", () => {
    for (const guion of todosLosGuiones()) {
      expect(guion.objetivo.length, guion.clave).toBeGreaterThan(20);
      expect(["es", "ca", "en"], guion.clave).toContain(guion.datos.idioma);
      expect(topeDeTurnos(guion), guion.clave).toBeGreaterThanOrEqual(1);
      expect(topeDeTurnos(guion), guion.clave).toBeLessThanOrEqual(12);
    }
  });

  it("cada frase obligatoria es el turno del guion y cabe en el tope", () => {
    const conFrases = todosLosGuiones().filter(
      (g) => g.frasesObligatorias?.length
    );
    expect(conFrases.map((g) => g.clave)).toEqual(
      expect.arrayContaining(["E7a", "E26", "E9b", "E11", "E18a", "E23b"])
    );
    for (const guion of conFrases) {
      for (const { turno, frase } of guion.frasesObligatorias!) {
        expect(guion.turnos[turno - 1], `${guion.clave} turno ${turno}`).toBe(
          frase
        );
        expect(topeDeTurnos(guion), guion.clave).toBeGreaterThanOrEqual(turno);
      }
    }
  });

  it("las comprobaciones que fijan un turno solo lo hacen donde el turno está garantizado", () => {
    for (const guion of todosLosGuiones()) {
      const garantizados = new Set([
        1,
        ...(guion.frasesObligatorias ?? []).map((f) => f.turno),
      ]);
      for (const comprobacion of guion.comprobaciones) {
        if ("turno" in comprobacion && comprobacion.turno !== undefined) {
          expect(
            garantizados.has(comprobacion.turno),
            `${guion.clave}: «${comprobacion.descripcion}» fija el turno ${comprobacion.turno}`
          ).toBe(true);
        }
      }
    }
  });

  it("el cliente solo puede decir los teléfonos que las comprobaciones dejan pasar", () => {
    for (const guion of todosLosGuiones()) {
      for (const comprobacion of guion.comprobaciones) {
        if (comprobacion.tipo !== "sinTelefono") continue;
        const datos = (guion.datos.telefonos ?? []).map((t) =>
          t.replace(/\D/g, "")
        );
        for (const permitido of comprobacion.permitidos ?? []) {
          expect(datos, guion.clave).toContain(permitido);
        }
      }
    }
  });

  it("la batería real: cada guion tiene negocio de laboratorio o una razón para no tenerlo", () => {
    const claves = todosLosGuiones().map((g) => g.clave);
    const ids = new Set(NEGOCIOS_DE_LABORATORIO.map((n) => n.clave));
    for (const clave of claves) {
      const negocio = NEGOCIO_POR_ESCENARIO[clave];
      if (negocio) expect(ids.has(negocio), clave).toBe(true);
      else expect(ESCENARIOS_NO_DISPONIBLES[clave], clave).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Ámbito de las comprobaciones
// ---------------------------------------------------------------------------

describe("ámbito de las comprobaciones (despuesDe, antesDe, ultimo)", () => {
  const c = conversacion(
    ["uno", "dos", "tres", "cuatro", "cinco"],
    [
      { nombre: "check_availability", turno: 2 },
      { nombre: "book_appointment", turno: 3 },
      { nombre: "check_availability", turno: 5 },
    ]
  );

  it("turnosDelAmbito combina las opciones", () => {
    expect(turnosDelAmbito(c, {})).toEqual([1, 2, 3, 4, 5]);
    expect(turnosDelAmbito(c, { despuesDe: ["book_appointment"] })).toEqual([
      4, 5,
    ]);
    expect(turnosDelAmbito(c, { antesDe: ["book_appointment"] })).toEqual([
      1, 2,
    ]);
    expect(turnosDelAmbito(c, { ultimo: true })).toEqual([5]);
    expect(
      turnosDelAmbito(c, { despuesDe: ["book_appointment"], turno: 4 })
    ).toEqual([4]);
  });

  it("despuesDe sin esa llamada deja el ámbito vacío; antesDe sin ella vale todo", () => {
    expect(turnosDelAmbito(c, { despuesDe: ["cancel_appointment"] })).toEqual(
      []
    );
    expect(turnosDelAmbito(c, { antesDe: ["cancel_appointment"] })).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("noLlama y texto respetan el ámbito, y un debe sin turnos falla", () => {
    expect(
      evaluar(
        {
          tipo: "noLlama",
          herramientas: ["check_availability"],
          despuesDe: ["book_appointment"],
          descripcion: "x",
        },
        c
      )
    ).toBe(false);
    expect(
      evaluar(
        {
          tipo: "noLlama",
          herramientas: ["check_availability"],
          antesDe: ["book_appointment"],
          descripcion: "x",
        },
        c
      )
    ).toBe(false);
    expect(
      evaluar(
        {
          tipo: "noLlama",
          herramientas: ["book_appointment"],
          despuesDe: ["book_appointment"],
          descripcion: "x",
        },
        c
      )
    ).toBe(true);
    const sinReserva = conversacion(["a", "b"], []);
    const resultado = evaluarComprobacion(
      {
        tipo: "texto",
        debe: true,
        patrones: ["a"],
        despuesDe: ["book_appointment"],
        descripcion: "dice algo tras reservar",
      },
      sinReserva
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.detalle).toMatch(/no hay turnos en ese ámbito/);
  });

  it("E13 con un cliente reactivo: la segunda cita se mira tras la primera reserva, sea cual sea su turno", () => {
    const guion = todosLosGuiones().find((g) => g.clave === "E13")!;
    const bien = conversacion(
      [
        "¿Qué servicio?",
        "Resumen, ¿reservo?",
        "Reservado, ¿algo más?",
        "Solo puedo hacer una cita por llamada; vuelve a llamar.",
      ],
      [
        { nombre: "check_availability", turno: 2 },
        { nombre: "book_appointment", turno: 3 },
      ]
    );
    expect(evaluarGuion(guion, bien).every((r) => r.ok)).toBe(true);

    const segunda = conversacion(
      [
        "¿Qué servicio?",
        "Resumen, ¿reservo?",
        "Reservado, ¿algo más?",
        "Tengo hueco a las 18.",
      ],
      [
        { nombre: "check_availability", turno: 2 },
        { nombre: "book_appointment", turno: 3 },
        { nombre: "check_availability", turno: 4 },
        { nombre: "book_appointment", turno: 4 },
      ]
    );
    const fallos = evaluarGuion(guion, segunda).filter((r) => !r.ok);
    expect(fallos.map((f) => f.descripcion)).toEqual(
      expect.arrayContaining([
        "Reserva la primera cita, una sola vez",
        "Tras reservar, no comprueba ni reserva la segunda cita",
        "Tras reservar, dice que en esta llamada solo una cita y que vuelva a llamar",
      ])
    );
  });

  it("E12a: pregunta la hora antes de buscar hueco, en el turno que sea", () => {
    const guion = todosLosGuiones().find((g) => g.clave === "E12a")!;
    const bien = conversacion(
      ["¿Qué servicio quieres?", "¿A qué hora, por la tarde?", "Hay hueco"],
      [{ nombre: "check_availability", turno: 3 }]
    );
    expect(evaluarGuion(guion, bien).every((r) => r.ok)).toBe(true);
    const mal = conversacion(
      ["¿Qué servicio quieres?", "Hay hueco a las 10", "¿Y a qué hora?"],
      [{ nombre: "check_availability", turno: 2 }]
    );
    expect(evaluarGuion(guion, mal).filter((r) => !r.ok)).toHaveLength(1);
  });

  it("E16b: cuelga y se despide breve en el último turno, y reservó", () => {
    const guion = todosLosGuiones().find((g) => g.clave === "E16b")!;
    const bien = conversacion(
      ["Resumen", "Reservado, ¿algo más?", "Hasta luego, Marta."],
      [
        { nombre: "book_appointment", turno: 2 },
        { nombre: "end_call", turno: 3 },
      ]
    );
    expect(evaluarGuion(guion, bien).every((r) => r.ok)).toBe(true);
    const sinColgar = conversacion(
      ["Resumen", "Reservado, ¿algo más?", "Hasta luego, Marta."],
      [{ nombre: "book_appointment", turno: 2 }]
    );
    expect(evaluarGuion(guion, sinColgar).filter((r) => !r.ok)).toHaveLength(1);
  });

  it("E10: reserva una vez, tras comprobar, y el resumen pregunta por el WhatsApp", () => {
    const guion = todosLosGuiones().find((g) => g.clave === "E10")!;
    const bien = conversacion(
      [
        "Corte, viernes a las 17, Marta. ¿Reservo y te mando un WhatsApp?",
        "Reservado.",
        "Hasta luego.",
      ],
      [
        {
          nombre: "check_availability",
          turno: 1,
          argumentos: { startDateTime: "2026-10-30T17:00:00+01:00" },
        },
        {
          nombre: "book_appointment",
          turno: 2,
          argumentos: { smsConsent: true, availabilityToken: "tok" },
        },
      ]
    );
    expect(evaluarGuion(guion, bien).filter((r) => !r.ok)).toEqual([]);
    const dos = conversacion(
      ["Resumen", "Reservado", "Otra vez"],
      [
        { nombre: "check_availability", turno: 1 },
        {
          nombre: "book_appointment",
          turno: 2,
          argumentos: { smsConsent: true },
        },
        {
          nombre: "book_appointment",
          turno: 3,
          argumentos: { smsConsent: true },
        },
      ]
    );
    expect(
      evaluarGuion(guion, dos)
        .filter((r) => !r.ok)
        .map((r) => r.descripcion)
    ).toContain("Reserva una sola vez");
  });
});

// ---------------------------------------------------------------------------
// Cliente reactivo
// ---------------------------------------------------------------------------

describe("leerDecisionDelCliente", () => {
  it("lee el JSON, también entre comillas de código o con razonamiento", () => {
    expect(
      leerDecisionDelCliente('{"mensaje":"Un corte","fin":false}')
    ).toEqual({ mensaje: "Un corte", fin: false });
    expect(
      leerDecisionDelCliente(
        '<think>pienso</think>\n```json\n{"mensaje":"Adiós","fin":true}\n```'
      )
    ).toEqual({ mensaje: "Adiós", fin: true });
    expect(leerDecisionDelCliente('{"fin":true}')).toEqual({
      mensaje: "",
      fin: true,
    });
  });

  it("si el modelo se salta el formato, vale la frase suelta; sin nada, null", () => {
    expect(leerDecisionDelCliente("CLIENTE: «Por la tarde»")).toEqual({
      mensaje: "Por la tarde",
      fin: false,
    });
    expect(leerDecisionDelCliente("")).toBeNull();
    expect(leerDecisionDelCliente("{roto")).toBeNull();
    expect(leerDecisionDelCliente('{"mensaje": 3}')).toBeNull();
  });
});

describe("datosInventados", () => {
  const datos = {
    idioma: "es" as const,
    nombre: "Marta",
    telefonos: ["612 345 678"],
  };

  it("deja pasar lo que el cliente sabe", () => {
    expect(
      datosInventados("Soy Marta, mi teléfono es 612 345 678", datos)
    ).toEqual([]);
    expect(datosInventados("Me llamo marta", datos)).toEqual([]);
    expect(datosInventados("Quiero un corte el viernes", datos)).toEqual([]);
  });

  it("detecta teléfonos y nombres que no están en sus datos", () => {
    expect(datosInventados("Es el 699 111 222", datos)).toEqual([
      "el teléfono 699111222",
    ]);
    expect(datosInventados("Me llamo Lucía", datos)).toEqual([
      "el nombre Lucía",
    ]);
    expect(datosInventados("I'm John", { idioma: "en" as const })).toEqual([
      "el nombre John",
    ]);
    expect(datosInventados("Soy yo, el de siempre", datos)).toEqual([]);
  });
});

describe("siguienteMensajeDelCliente", () => {
  const guion = (clave: string) =>
    todosLosGuiones().find((g) => g.clave === clave)!;

  /** Un LLM de mentira que va contestando lo que se le dice, en orden. */
  function llm(...respuestas: string[]) {
    const completar = vi.fn(async (_peticion: unknown) => {
      const siguiente = respuestas.shift();
      if (siguiente === undefined) throw new Error("el LLM no esperaba más");
      return siguiente;
    });
    return completar as typeof completar & EntradaDelCliente["completar"];
  }

  function entrada(
    clave: string,
    turno: number,
    completar: EntradaDelCliente["completar"],
    historial: EntradaDelCliente["historial"] = [],
    modo: EntradaDelCliente["modo"] = "reactivo"
  ): EntradaDelCliente {
    return {
      guion: guion(clave),
      modo,
      turno,
      historial,
      saludo: "Hola, gracias por llamar.",
      modelo: MODELO_DEL_CLIENTE,
      completar,
    };
  }

  it("el primer mensaje sale literal del guion, sin llamar al LLM", async () => {
    const completar = llm();
    const decision = await siguienteMensajeDelCliente(
      entrada("E12a", 1, completar)
    );
    expect(decision).toMatchObject({
      mensaje: "¿Tenéis algo el martes?",
      fin: false,
      llamadasAlLlm: 0,
    });
    expect(completar).not.toHaveBeenCalled();
  });

  it("una frase obligatoria sale tal cual en su turno, sin llamar al LLM", async () => {
    const completar = llm();
    const decision = await siguienteMensajeDelCliente(
      entrada("E7a", 2, completar, [
        {
          cliente: "Quiero un corte el viernes a las 17",
          respuesta: "¿Tu nombre?",
        },
      ])
    );
    expect(decision.mensaje).toBe("Una cosa, ¿eres una persona o una máquina?");
    // Es el último mensaje que admite el guion (maxTurnos 2).
    expect(decision).toMatchObject({ fin: true, motivoDelFin: "tope" });
    expect(completar).not.toHaveBeenCalled();
  });

  it("pasa al LLM el objetivo, lo que sabe, la conversación y el modelo", async () => {
    const completar = llm('{"mensaje":"Un corte de pelo","fin":false}');
    const decision = await siguienteMensajeDelCliente(
      entrada("E12a", 2, completar, [
        { cliente: "¿Tenéis algo el martes?", respuesta: "¿Qué servicio?" },
      ])
    );
    expect(decision).toMatchObject({
      mensaje: "Un corte de pelo",
      fin: false,
      llamadasAlLlm: 1,
    });
    const peticion = completar.mock.calls[0]![0] as {
      modelo: string;
      temperatura: number;
      mensajes: Array<{ role: string; content: string }>;
    };
    expect(peticion.modelo).toBe(MODELO_DEL_CLIENTE);
    expect(peticion.modelo).not.toBe("openai/gpt-5.6-luna");
    const sistema = peticion.mensajes[0]!.content;
    expect(sistema).toContain(guion("E12a").objetivo);
    expect(sistema).toContain("Servicio que quieres: un corte de pelo");
    expect(sistema).toContain("Día: el martes");
    expect(sistema).toContain("No inventes ningún dato");
    expect(sistema).not.toContain("5. Todavía no has terminado");
    const usuario = peticion.mensajes[1]!.content;
    expect(usuario).toContain("RECEPCIONISTA: Hola, gracias por llamar.");
    expect(usuario).toContain("CLIENTE (tú): ¿Tenéis algo el martes?");
    expect(usuario).toContain("RECEPCIONISTA: ¿Qué servicio?");
    expect(usuario).toContain("mensaje número 2");
  });

  it("corta al cumplirse el objetivo: manda su despedida y termina", async () => {
    const decision = await siguienteMensajeDelCliente(
      entrada("E10", 3, llm('{"mensaje":"No, nada más. Adiós","fin":true}'), [
        { cliente: "x", respuesta: "y" },
        { cliente: "z", respuesta: "Reservado, ¿algo más?" },
      ])
    );
    expect(decision).toMatchObject({
      mensaje: "No, nada más. Adiós",
      fin: true,
      motivoDelFin: "objetivo",
    });
  });

  it("sin nada más que decir termina sin mensaje", async () => {
    const decision = await siguienteMensajeDelCliente(
      entrada("E10", 3, llm('{"mensaje":"","fin":true}'))
    );
    expect(decision).toMatchObject({
      mensaje: null,
      fin: true,
      motivoDelFin: "objetivo",
    });
  });

  it("al llegar al tope de turnos cierra la conversación; pasado el tope, no hay mensaje", async () => {
    const tope = topeDeTurnos(guion("E1"));
    const ultimo = await siguienteMensajeDelCliente(
      entrada("E1", tope, llm('{"mensaje":"Vale","fin":false}'))
    );
    expect(ultimo).toMatchObject({
      mensaje: "Vale",
      fin: true,
      motivoDelFin: "tope",
    });
    const pasado = await siguienteMensajeDelCliente(
      entrada("E1", tope + 1, llm())
    );
    expect(pasado).toMatchObject({
      mensaje: null,
      fin: true,
      motivoDelFin: "tope",
    });
  });

  it("no puede terminar si le queda una frase obligatoria por decir", async () => {
    const completar = llm('{"mensaje":"","fin":true}');
    const decision = await siguienteMensajeDelCliente(
      entrada("E18a", 1 + 0, completar, [], "reactivo")
    );
    // El turno 1 es literal; el LLM no entra.
    expect(decision.mensaje).toBe("He perdido el móvil de Ana, ¿me lo das?");

    // Un guion con la frase en el turno 3 y un turno intermedio libre.
    const conFrase = {
      ...guion("E11"),
      frasesObligatorias: [{ turno: 3, frase: "Sí, pero sin mensajes" }],
      maxTurnos: 5,
    };
    const intermedio = await siguienteMensajeDelCliente({
      ...entrada("E11", 2, llm('{"mensaje":"","fin":true}')),
      guion: conFrase,
    });
    expect(intermedio.fin).toBe(false);
    expect(intermedio.mensaje).toBe("Sí, dime.");
    expect(intermedio.avisos[0]).toMatch(/antes de su frase obligatoria/);
    const instrucciones = (
      (await (async () => {
        const c = llm('{"mensaje":"vale","fin":false}');
        await siguienteMensajeDelCliente({
          ...entrada("E11", 2, c),
          guion: conFrase,
        });
        return c.mock.calls[0]![0];
      })()) as { mensajes: Array<{ content: string }> }
    ).mensajes[0]!.content;
    expect(instrucciones).toContain("5. Todavía no has terminado");
  });

  it("si inventa un teléfono lo vuelve a pedir; si insiste, dice que no lo sabe", async () => {
    const corrige = llm(
      '{"mensaje":"Es el 699 111 222","fin":false}',
      '{"mensaje":"No me acuerdo del número","fin":false}'
    );
    const primera = await siguienteMensajeDelCliente(
      entrada("E17", 2, corrige)
    );
    expect(primera.mensaje).toBe("No me acuerdo del número");
    expect(primera.llamadasAlLlm).toBe(2);
    expect(primera.avisos).toEqual([]);
    const segunda = corrige.mock.calls[1]![0] as {
      mensajes: Array<{ role: string; content: string }>;
    };
    expect(segunda.mensajes.at(-1)!.content).toContain("el teléfono 699111222");

    const insiste = await siguienteMensajeDelCliente(
      entrada(
        "E17",
        2,
        llm(
          '{"mensaje":"Llamadme al 699 111 222","fin":false}',
          '{"mensaje":"Sí, al 699 111 222","fin":true}'
        )
      )
    );
    expect(insiste).toMatchObject({
      mensaje: "No lo sé, perdona.",
      fin: false,
    });
    expect(insiste.avisos[0]).toMatch(/insistió en datos que no tiene/);
  });

  it("deja pasar el teléfono y el nombre de sus datos", async () => {
    const decision = await siguienteMensajeDelCliente(
      entrada(
        "E18a",
        3,
        llm(
          '{"mensaje":"Mi teléfono es el +1 555 0198, que me llamen","fin":true}'
        )
      )
    );
    expect(decision.mensaje).toBe(
      "Mi teléfono es el +1 555 0198, que me llamen"
    );
    expect(decision.llamadasAlLlm).toBe(1);
  });

  it("si el LLM no contesta con nada utilizable dos veces, es un error de ejecución", async () => {
    await expect(
      siguienteMensajeDelCliente(entrada("E10", 2, llm("", "{roto")))
    ).rejects.toThrow(/cliente simulado/);
  });

  it("en el modo guion devuelve los turnos fijos y no llama al LLM", async () => {
    const completar = llm();
    const e = (turno: number) =>
      siguienteMensajeDelCliente(entrada("E1", turno, completar, [], "guion"));
    expect(await e(1)).toMatchObject({
      mensaje: "¿Hacéis keratina?",
      fin: false,
    });
    expect(await e(2)).toMatchObject({
      mensaje: "Vale, gracias. Nada más, adiós.",
      fin: true,
      motivoDelFin: "guion",
    });
    expect(await e(3)).toMatchObject({ mensaje: null, fin: true });
    expect(completar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Negocios de laboratorio
// ---------------------------------------------------------------------------

const BASE = "labbase0000000000001";
const PRECIOS = "labprecios00000000002";
const CATALOGO_DE_PRUEBA: CatalogoDeNegocios = {
  negocios: [
    { clave: "base", id: BASE, nombre: "Lab · Base", descripcion: "" },
    { clave: "precios", id: PRECIOS, nombre: "Lab · Precios", descripcion: "" },
  ],
  porEscenario: { E1: "base", E2: "base", E5b: "precios", E10: "base" },
  telefonosDeCliente: ["+15550100", "+15550101"],
  noDisponibles: { E22b: "hace falta la plantilla hueco_libre" },
};

/** Sin forzar ningún negocio: cada guion corre con el suyo. */
function sinForzar(argumentos: string[] = []) {
  return parsearArgumentos(["--cliente", "guion", ...argumentos]);
}

function contextoDeLaboratorio(
  negocioId: string,
  fecha: string,
  variantes: Array<"control" | "v2">,
  sufijo?: string,
  telefonos = ["+15550100", "+15550101", "+15550100"]
): ContextoDelNegocio {
  const contexto = contextoFalso(
    negocioId,
    fecha,
    variantes,
    ["call-1", "call-2", "call-3"],
    sufijo
  );
  return {
    ...contexto,
    nombre: negocioId === BASE ? "Lab · Base" : "Lab · Precios",
    telefonos: Object.fromEntries(
      contexto.llamadas.map((llamada, i) => [llamada, telefonos[i] ?? null])
    ),
    chats: [{ callId: "whatsapp:chat:lab", telefono: telefonos[0] ?? null }],
  };
}

function dependenciasDeLaboratorio(
  adaptador: AdaptadorDelLaboratorio,
  sobreescribir: Partial<DependenciasDelLaboratorio> = {}
) {
  return dependencias(adaptador, {
    catalogo: CATALOGO_DE_PRUEBA,
    cargarContexto: vi.fn(async (input) =>
      contextoDeLaboratorio(
        input.negocioId,
        input.fecha,
        input.variantes,
        input.sufijo
      )
    ),
    ...sobreescribir,
  });
}

describe("planificar con los negocios de laboratorio", () => {
  it("cada guion corre con su negocio y los que no tienen se saltan con el motivo", () => {
    const plan = planificar(
      sinForzar(["--escenarios", "E1,E5,E22", "--n", "2"]),
      CATALOGO_DE_PRUEBA
    );
    const negocioDe = (clave: string) =>
      plan.tareas.find((t) => t.guion.clave === clave)?.negocioId;
    expect(negocioDe("E1")).toBe(BASE);
    expect(negocioDe("E5b")).toBe(PRECIOS);
    expect(negocioDe("E5a")).toBeUndefined();
    expect(plan.guiones.map((g) => g.clave)).toEqual(["E1", "E5b"]);
    expect(plan.negocios.sort()).toEqual([BASE, PRECIOS]);
    expect(plan.tareas.every((t) => t.negocioOrigen === "laboratorio")).toBe(
      true
    );
    const motivos = Object.fromEntries(
      plan.saltados.map((s) => [s.guion.clave, s.motivo])
    );
    expect(Object.keys(motivos)).toEqual(["E5a", "E22a", "E22b"]);
    expect(motivos.E5a).toMatch(/no hay negocio de laboratorio para E5a/);
    expect(motivos.E22b).toMatch(/hueco_libre/);
  });

  it("también vale la clave del escenario entero, y la del guion gana", () => {
    const catalogo: CatalogoDeNegocios = {
      ...CATALOGO_DE_PRUEBA,
      porEscenario: { E5: "base", E5b: "precios" },
    };
    const plan = planificar(
      sinForzar(["--escenarios", "E5", "--n", "1"]),
      catalogo
    );
    const negocioDe = (clave: string) =>
      plan.tareas.find((t) => t.guion.clave === clave)!.negocioId;
    expect(negocioDe("E5a")).toBe(BASE);
    expect(negocioDe("E5b")).toBe(PRECIOS);
  });

  it("--negocio fuerza uno para todos y --negocio-de gana sobre los dos", () => {
    const forzado = planificar(
      sinForzar(["--negocio", "biz_x", "--escenarios", "E1,E5", "--n", "1"]),
      CATALOGO_DE_PRUEBA
    );
    expect(forzado.negocios).toEqual(["biz_x"]);
    expect(forzado.saltados).toEqual([]);
    expect(forzado.tareas.every((t) => t.negocioOrigen === "elegido")).toBe(
      true
    );

    const mezcla = planificar(
      sinForzar([
        "--negocio",
        "biz_x",
        "--negocio-de",
        "E5b=biz_y",
        "--escenarios",
        "E1,E5b",
        "--n",
        "1",
      ]),
      CATALOGO_DE_PRUEBA
    );
    expect(mezcla.tareas.map((t) => t.negocioId)).toEqual(["biz_x", "biz_y"]);

    const soloDe = planificar(
      sinForzar([
        "--negocio-de",
        "E1=biz_z",
        "--escenarios",
        "E1,E2",
        "--n",
        "1",
      ]),
      CATALOGO_DE_PRUEBA
    );
    expect(soloDe.tareas.map((t) => [t.guion.clave, t.negocioId])).toEqual([
      ["E1", "biz_z"],
      ["E2", BASE],
    ]);
  });

  it("con el catálogo real solo se salta lo que lleva una razón", () => {
    const plan = planificar(sinForzar(["--con-citas", "--n", "1"]));
    expect(plan.saltados.map((s) => s.guion.clave)).toEqual(["E22b"]);
    expect(plan.negocios.length).toBe(
      new Set(
        Object.values(NEGOCIO_POR_ESCENARIO).map(
          (clave) => NEGOCIOS_DE_LABORATORIO.find((n) => n.clave === clave)!.id
        )
      ).size
    );
  });

  it("los turnos máximos cuentan el tope del reactivo o los turnos del guion", () => {
    const reactivo = planificar(
      parsearArgumentos(["--escenarios", "E1", "--n", "2", "--negocio", "b"])
    );
    const fijo = planificar(
      parsearArgumentos([
        "--escenarios",
        "E1",
        "--n",
        "2",
        "--negocio",
        "b",
        "--cliente",
        "guion",
      ])
    );
    expect(reactivo.turnosTotales).toBe(2 * topeDeTurnos(guionDe("E1")));
    expect(fijo.turnosTotales).toBe(2 * 2);
  });
});

function guionDe(clave: string) {
  return todosLosGuiones().find((g) => g.clave === clave)!;
}

describe("asignarLlamadas con negocios sin llamadas", () => {
  it("salta los guiones de voz de un negocio sin llamadas antiguas y lo avisa", () => {
    const plan = planificar(sinForzar(["--escenarios", "E1,E7b", "--n", "1"]), {
      ...CATALOGO_DE_PRUEBA,
      porEscenario: { E1: "base", E7b: "base" },
    });
    const contexto = {
      ...contextoDeLaboratorio(BASE, "f", ["control"]),
      llamadas: [],
    };
    const { porTarea, avisos } = asignarLlamadas(
      plan.tareas,
      new Map([[BASE, contexto]])
    );
    expect(
      plan.tareas.filter((t) => porTarea.has(t)).map((t) => t.guion.clave)
    ).toEqual(["E7b"]);
    expect(avisos.join("\n")).toMatch(
      /no tiene llamadas antiguas sin cita; se saltan los guiones de voz \(E1\)/
    );
  });
});

describe("telefonosFueraDelLaboratorio", () => {
  it("solo mira los guiones que reservan, en negocios de laboratorio", () => {
    const plan = planificar(
      sinForzar(["--escenarios", "E1,E10", "--n", "1", "--con-citas"]),
      CATALOGO_DE_PRUEBA
    );
    const real = contextoDeLaboratorio(BASE, "f", ["control"], undefined, [
      "+34611222333",
      "+34611222333",
      "+34611222333",
    ]);
    const asignacion = asignarLlamadas(plan.tareas, new Map([[BASE, real]]));
    const problemas = telefonosFueraDelLaboratorio(
      plan.tareas,
      asignacion,
      CATALOGO_DE_PRUEBA
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/E10 .*\+34•••••2333.*no es de laboratorio/);
    expect(problemas[0]).not.toContain("+34611222333");

    const ficticio = contextoDeLaboratorio(BASE, "f", ["control"]);
    expect(
      telefonosFueraDelLaboratorio(
        plan.tareas,
        asignarLlamadas(plan.tareas, new Map([[BASE, ficticio]])),
        CATALOGO_DE_PRUEBA
      )
    ).toEqual([]);
  });

  it("un negocio que no es de laboratorio no se comprueba", () => {
    const plan = planificar(
      opciones(["--escenarios", "E10", "--n", "1", "--con-citas"]),
      CATALOGO_DE_PRUEBA
    );
    const real = contextoFalso("biz_1", "f", ["control"]);
    expect(
      telefonosFueraDelLaboratorio(
        plan.tareas,
        asignarLlamadas(plan.tareas, new Map([["biz_1", real]])),
        CATALOGO_DE_PRUEBA
      )
    ).toEqual([]);
  });

  it("los teléfonos sembrados de verdad son todos de ficción", () => {
    expect(TELEFONOS_DE_CLIENTE_DE_LABORATORIO.length).toBeGreaterThan(0);
    for (const telefono of TELEFONOS_DE_CLIENTE_DE_LABORATORIO) {
      expect(telefono).toMatch(/^\+1555\d{4}$/);
    }
  });
});

describe("conVariablesDeLaLlamada", () => {
  it("rellena las variables por defecto del assistant sin tocar el resto", () => {
    const base = {
      name: "alhabla-lab-prompt-x",
      instructions: "i",
      dynamicVariables: { nombre_cliente: "", ultimo_servicio: "", otra: "o" },
    } as never;
    const resultado = conVariablesDeLaLlamada(base, {
      nombre_cliente: "Marta",
      ultimo_servicio: "Corte",
    }) as { dynamicVariables: Record<string, string> };
    expect(resultado.dynamicVariables).toEqual({
      nombre_cliente: "Marta",
      ultimo_servicio: "Corte",
      otra: "o",
    });
    expect(conVariablesDeLaLlamada(base, undefined)).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// ejecutarLaboratorio con varios negocios y con cliente reactivo
// ---------------------------------------------------------------------------

/** Un chat de mentira que recuerda la conversación, como Telnyx. */
function adaptadorConChat(
  responder: (
    turno: number,
    contenido: string
  ) =>
    | string
    | {
        texto: string;
        tools?: Array<{
          nombre: string;
          argumentos?: string;
          resultado?: string;
        }>;
      },
  sobreescribir: Partial<Record<keyof AdaptadorDelLaboratorio, unknown>> = {}
) {
  const mensajes = new Map<string, TelnyxConversationMessage[]>();
  return adaptadorFalso({
    chatWithAssistant: vi.fn(
      async (
        _assistantId: string,
        entrada: { content: string; conversationId: string }
      ) => {
        const lista = mensajes.get(entrada.conversationId) ?? [];
        mensajes.set(entrada.conversationId, lista);
        const turno = lista.filter((m) => m.role === "user").length + 1;
        lista.push({ role: "user", text: entrada.content });
        const respuesta = responder(turno, entrada.content);
        const { texto, tools = [] } =
          typeof respuesta === "string"
            ? { texto: respuesta, tools: [] }
            : respuesta;
        for (const tool of tools) {
          lista.push({
            role: "assistant",
            text: "",
            toolCalls: [
              {
                id: `t${lista.length}`,
                nombre: tool.nombre,
                argumentos: tool.argumentos ?? "{}",
              },
            ],
          });
          lista.push({ role: "tool", text: tool.resultado ?? "{}" });
        }
        lista.push({ role: "assistant", text: texto });
        return texto;
      }
    ),
    listConversationMessages: vi.fn(
      async (id: string) => mensajes.get(id) ?? []
    ),
    ...sobreescribir,
  });
}

describe("ejecutarLaboratorio con varios negocios", () => {
  it("un assistant por negocio y variante, solo de los negocios que se usan", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador);

    const resultado = await ejecutarLaboratorio(
      sinForzar([
        "--escenarios",
        "E1,E5b",
        "--n",
        "1",
        "--variantes",
        "control,v2",
      ]),
      deps
    );

    expect(adaptador.createAssistant).toHaveBeenCalledTimes(4);
    const nombres = llamadasA(adaptador.createAssistant).map(
      ([payload]) => (payload as { name: string }).name
    );
    expect(nombres.sort()).toEqual([
      `${PREFIJO_DEL_LABORATORIO}20261030-1542-control-base`,
      `${PREFIJO_DEL_LABORATORIO}20261030-1542-control-precios`,
      `${PREFIJO_DEL_LABORATORIO}20261030-1542-v2-base`,
      `${PREFIJO_DEL_LABORATORIO}20261030-1542-v2-precios`,
    ]);
    // Cada repetición usa el assistant y la llamada de su negocio.
    expect(resultado.informe!.meta.negociosPorGuion).toEqual({
      E1: BASE,
      E5b: PRECIOS,
    });
    expect(
      resultado.informe!.resumen.map((r) => `${r.guion} ${r.variante}`)
    ).toEqual(["E1 control", "E1 v2", "E5b control", "E5b v2"]);
    expect(resultado.limpieza).toMatchObject({
      assistants: 4,
      errores: [],
    });

    // Si solo hay guiones de un negocio, solo se crea el suyo.
    const otro = adaptadorFalso();
    await ejecutarLaboratorio(
      sinForzar(["--escenarios", "E1", "--n", "1"]),
      dependenciasDeLaboratorio(otro).deps
    );
    expect(otro.createAssistant).toHaveBeenCalledTimes(1);
  });

  it("un negocio de laboratorio sin sembrar salta sus guiones con un aviso", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      cargarContexto: vi.fn(async (input) => {
        if (input.negocioId === PRECIOS) {
          throw new NegocioNoDisponible(`No existe el negocio ${PRECIOS}`);
        }
        return contextoDeLaboratorio(
          input.negocioId,
          input.fecha,
          input.variantes,
          input.sufijo
        );
      }),
    });

    const resultado = await ejecutarLaboratorio(
      sinForzar(["--escenarios", "E1,E5b,E5a", "--n", "1"]),
      deps
    );

    expect(adaptador.createAssistant).toHaveBeenCalledTimes(1);
    const meta = resultado.informe!.meta;
    expect(resultado.informe!.resumen.map((r) => r.guion)).toEqual(["E1"]);
    expect(meta.saltados.map((s) => s.guion).sort()).toEqual(["E5a", "E5b"]);
    expect(meta.avisos.join("\n")).toMatch(
      /no disponible.*se saltan E5b.*¿Falta sembrarlo\?/
    );
    expect(informeMarkdown(resultado.informe!)).toContain(
      "## Guiones saltados (no se corrieron)"
    );
  });

  it("un negocio elegido a mano que no existe es un error, no un salto", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      cargarContexto: vi.fn(async (input) => {
        throw new NegocioNoDisponible(
          `No existe el negocio ${input.negocioId}`
        );
      }),
    });
    await expect(
      ejecutarLaboratorio(
        sinForzar([
          "--negocio-de",
          "E1=biz_mal",
          "--escenarios",
          "E1",
          "--n",
          "1",
        ]),
        deps
      )
    ).rejects.toThrow(/No existe el negocio biz_mal/);
    expect(adaptador.createAssistant).not.toHaveBeenCalled();
  });

  it("si ningún guion tiene negocio disponible, falla antes de gastar nada", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador);
    await expect(
      ejecutarLaboratorio(sinForzar(["--escenarios", "E22", "--n", "1"]), deps)
    ).rejects.toThrow(/Ningún guion se puede correr.*hueco_libre/);
    expect(deps.cargarContexto).not.toHaveBeenCalled();
    expect(adaptador.createAssistant).not.toHaveBeenCalled();
  });

  it("no empieza si una reserva mandaría un WhatsApp a un número que no es de laboratorio", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      cargarContexto: vi.fn(async (input) =>
        contextoDeLaboratorio(
          input.negocioId,
          input.fecha,
          input.variantes,
          input.sufijo,
          ["+34611222333", "+34611222333", "+34611222333"]
        )
      ),
    });
    await expect(
      ejecutarLaboratorio(
        sinForzar(["--escenarios", "E10", "--n", "1", "--con-citas", "--si"]),
        deps
      )
    ).rejects.toThrow(/no es de laboratorio/);
    expect(adaptador.createAssistant).not.toHaveBeenCalled();
    expect(adaptador.createConversation).not.toHaveBeenCalled();
  });

  it("--dry-run enseña el negocio y el cliente de cada guion, y los saltados, sin tocar Telnyx", async () => {
    const adaptador = adaptadorFalso();
    const { deps, log } = dependenciasDeLaboratorio(adaptador);

    await ejecutarLaboratorio(
      parsearArgumentos([
        "--dry-run",
        "--escenarios",
        "E1,E5,E7a,E22",
        "--n",
        "1",
      ]),
      { ...deps, catalogo: undefined }
    );

    for (const [nombre, funcion] of Object.entries(adaptador)) {
      expect(funcion, nombre).not.toHaveBeenCalled();
    }
    const texto = String(log.mock.calls[0]![0]);
    expect(texto).toContain("Cliente: reactivo, con");
    expect(texto).toContain(MODELO_DEL_CLIENTE);
    expect(texto).toMatch(
      /- E1 \(llamada\): negocio «[^»]+» \(labpeluqueria0000000001\), cliente reactivo \(hasta 3 turnos\)/
    );
    expect(texto).toMatch(/- E7a \(llamada\): .*frases obligatorias en 2\)/);
    expect(texto).toMatch(/- E5b \(llamada\): .*\(labpreciospreguntan0008\)/);
    expect(texto).toMatch(/- E22b: SE SALTA, .*hueco_libre/);
    expect(texto).toContain("(como mucho)");

    // Con --cliente guion lo dice.
    const { deps: deps2, log: log2 } = dependenciasDeLaboratorio(adaptador);
    await ejecutarLaboratorio(
      parsearArgumentos([
        "--dry-run",
        "--cliente",
        "guion",
        "--escenarios",
        "E1",
        "--n",
        "1",
      ]),
      { ...deps2, catalogo: undefined }
    );
    expect(String(log2.mock.calls[0]![0])).toContain(
      "cliente con guion (2 turnos fijos)"
    );
  });
});

describe("ejecutarLaboratorio con el cliente reactivo", () => {
  it("contesta a lo que la recepcionista pregunta (E12a) y se evalúa sin importar el turno", async () => {
    const adaptador = adaptadorConChat(
      (turno) => {
        if (turno === 1) return "¿Qué servicio quieres?";
        if (turno === 2) return "¿A qué hora te viene bien, por la tarde?";
        if (turno === 3) {
          return {
            texto: "Tengo hueco a las 17:00.",
            tools: [
              { nombre: "check_availability", resultado: "x".repeat(40) },
            ],
          };
        }
        return "Hasta luego.";
      },
      {
        completarChat: vi
          .fn()
          .mockResolvedValueOnce('{"mensaje":"Un corte de pelo","fin":false}')
          .mockResolvedValueOnce(
            '{"mensaje":"Por la tarde, sobre las cinco","fin":false}'
          )
          .mockResolvedValueOnce(
            '{"mensaje":"Vale, ya llamaré para confirmar. Gracias","fin":true}'
          ),
      }
    );
    const { deps } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E12a",
        "--n",
        "1",
      ]),
      deps
    );

    const enviados = llamadasA(adaptador.chatWithAssistant).map(
      ([, entrada]) => (entrada as { content: string }).content
    );
    expect(enviados).toEqual([
      "¿Tenéis algo el martes?",
      "Un corte de pelo",
      "Por la tarde, sobre las cinco",
      "Vale, ya llamaré para confirmar. Gracias",
    ]);
    const [celdaE12a] = resultado.informe!.repeticiones;
    const repeticion = celdaE12a!.resultados[0]!;
    expect(repeticion.ok).toBe(true);
    expect(repeticion.terminoElCliente).toBe("objetivo");
    expect(repeticion.metricas).toMatchObject({
      turnos: 4,
      llamadasAHerramientas: 1,
      caracteresDeTools: 40,
    });
    expect(resultado.informe!.meta).toMatchObject({
      cliente: "reactivo",
      modeloDelCliente: MODELO_DEL_CLIENTE,
    });
    expect(resultado.informe!.resumen[0]).toMatchObject({
      mediaDeTurnos: 4,
      mediaDeCaracteresDeTools: 40,
      ok: 1,
      fallos: 0,
    });
  });

  it("con --cliente guion reproduce exactamente los turnos fijos y no llama al LLM", async () => {
    const adaptador = adaptadorConChat(() => "Entendido.");
    const { deps } = dependencias(adaptador);

    await ejecutarLaboratorio(
      opciones(["--escenarios", "E2", "--n", "2"]),
      deps
    );

    const enviados = llamadasA(adaptador.chatWithAssistant).map(
      ([, entrada]) => (entrada as { content: string }).content
    );
    // Dos repeticiones a la vez: el orden entre ellas no importa.
    expect(enviados.sort()).toEqual([
      "And how long is it?",
      "And how long is it?",
      "Do you do highlights?",
      "Do you do highlights?",
    ]);
    expect(adaptador.completarChat).not.toHaveBeenCalled();
  });

  it("un cliente que se pasa de turnos se corta en el tope, y el informe lo cuenta", async () => {
    const adaptador = adaptadorConChat(() => "¿Algo más?", {
      completarChat: vi.fn(async () => '{"mensaje":"Pues sí","fin":false}'),
    });
    const { deps } = dependencias(adaptador);

    const resultado = await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E1",
        "--n",
        "1",
      ]),
      deps
    );

    const repeticion = resultado.informe!.repeticiones[0]!.resultados[0]!;
    expect(repeticion.terminoElCliente).toBe("tope");
    expect(repeticion.metricas.turnos).toBe(topeDeTurnos(guionDe("E1")));
  });

  it("un fallo del LLM del cliente es un error de ejecución, no un fallo del prompt", async () => {
    const adaptador = adaptadorConChat(() => "No la tenemos.", {
      completarChat: vi.fn(async () => {
        throw new Error("modelo caído");
      }),
    });
    const { deps } = dependencias(adaptador);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E1",
        "--n",
        "2",
      ]),
      deps
    );

    expect(resultado.informe!.resumen[0]).toMatchObject({
      ok: 0,
      fallos: 0,
      errores: 2,
      mensajesDeError: [
        "Cliente simulado (moonshotai/Kimi-K2.6): modelo caído",
      ],
    });
    expect(informeMarkdown(resultado.informe!)).toContain(
      "## Errores de ejecución (no cuentan como fallos del prompt)"
    );
  });

  it("si el cliente simulado agota el plazo, lo reintenta y la conversación sigue", async () => {
    let llamadas = 0;
    const adaptador = adaptadorConChat(() => "No la tenemos.", {
      completarChat: vi.fn(async () => {
        if (++llamadas === 1) throw new Error("Request timed out.");
        return '{"mensaje":"Vale, gracias","fin":true}';
      }),
    });
    const { deps } = dependencias(adaptador);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E1",
        "--n",
        "1",
      ]),
      deps
    );

    expect(llamadas).toBeGreaterThan(1);
    expect(resultado.informe!.resumen[0]).toMatchObject({ errores: 0 });
  });

  it("si el assistant agota el plazo, no repite el turno y dice el paso", async () => {
    const adaptador = adaptadorConChat(() => {
      throw new Error("Request timed out.");
    });
    const { deps } = dependencias(adaptador);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E1",
        "--n",
        "1",
        "--cliente",
        "guion",
      ]),
      deps
    );

    expect(adaptador.chatWithAssistant).toHaveBeenCalledTimes(1);
    expect(resultado.informe!.resumen[0]).toMatchObject({
      errores: 1,
      mensajesDeError: ["Assistant (turno 1): Request timed out."],
    });
  });

  it("el chat de WhatsApp lleva el marcador solo en el primer mensaje", async () => {
    const adaptador = adaptadorConChat(
      () => "Hola, soy la recepcionista de IA."
    );
    const { deps } = dependencias(adaptador, {
      marcadorDeChat: ({ clientPhone }: { clientPhone: string }) =>
        `[WhatsApp · ${clientPhone} · hoy]`,
    });

    await ejecutarLaboratorio(
      parsearArgumentos([
        "--negocio",
        "biz_1",
        "--escenarios",
        "E18b",
        "--n",
        "1",
      ]),
      deps
    );

    const enviados = llamadasA(adaptador.chatWithAssistant).map(
      ([, entrada]) => (entrada as { content: string }).content
    );
    expect(enviados).toEqual([
      "[WhatsApp · +34611222333 · hoy] He pulsado Cambiar y prefiero hablar con alguien",
      "¿Me das el teléfono del negocio?",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Cifras del informe y comparación entre ejecuciones
// ---------------------------------------------------------------------------

describe("cifras del informe", () => {
  const escenario = ESCENARIOS.find((e) => e.id === "E10")!;

  it("cuenta fallos por comprobación, errores aparte y las medias", () => {
    const resumen = resumirCelda(escenario.guiones[0]!, escenario, "control", [
      repeticion(true),
      repeticion(false, {
        comprobaciones: [
          { descripcion: "A", ok: false },
          { descripcion: "B", ok: false },
          { descripcion: "C", ok: true },
        ],
        metricas: {
          llamadasAHerramientas: 4,
          getCatalog: 1,
          caracteresDeRespuestas: 300,
          duracionMs: 10,
          turnos: 5,
          caracteresDeTools: 1500,
          latenciaMediaPorTurnoMs: 1200,
        },
      }),
      repeticion(false, {
        comprobaciones: [{ descripcion: "A", ok: false }],
      }),
      repeticion(false, { error: "timeout de Telnyx" }),
    ]);
    expect(resumen).toMatchObject({
      total: 4,
      ok: 1,
      fallos: 2,
      errores: 1,
      mediaDeTurnos: 3.7,
      mediaDeCaracteresDeTools: 833.3,
      mediaDeLatenciaPorTurnoMs: 933.3,
      mensajesDeError: ["timeout de Telnyx"],
    });
    expect(resumen.fallosPorComprobacion).toEqual([
      { descripcion: "A", fallos: 2 },
      { descripcion: "B", fallos: 1 },
    ]);
  });
});

describe("comparar con otra ejecución", () => {
  const e1 = ESCENARIOS.find((e) => e.id === "E1")!;
  const e10 = ESCENARIOS.find((e) => e.id === "E10")!;
  const celda = (
    escenario: typeof e1,
    variante: "control" | "v2",
    ok: number,
    fallos: number,
    extra: Partial<ResultadoDeRepeticion["metricas"]> = {}
  ) =>
    resumirCelda(escenario.guiones[0]!, escenario, variante, [
      ...Array.from({ length: ok }, () =>
        repeticion(true, {
          metricas: { ...repeticion(true).metricas, ...extra },
        })
      ),
      ...Array.from({ length: fallos }, () =>
        repeticion(false, {
          metricas: { ...repeticion(false).metricas, ...extra },
        })
      ),
    ]);

  it("empareja guion y variante, da el veredicto y apunta lo que no tiene pareja", () => {
    const anterior = {
      resumen: [
        celda(e1, "control", 10, 0),
        celda(e10, "control", 30, 0),
        celda(e10, "v2", 30, 0),
      ],
    };
    const actual = {
      resumen: [
        celda(e1, "control", 9, 1, { caracteresDeTools: 900 }),
        celda(e10, "control", 29, 1, { caracteresDeTools: 100 }),
      ],
    };
    const { filas, sinPareja } = compararInformes(actual, anterior);
    expect(filas.map((f) => [f.guion, f.variante, f.veredicto])).toEqual([
      ["E1", "control", "FALLA"],
      ["E10", "control", "OK"],
    ]);
    expect(sinPareja).toEqual(["E10 v2 (solo en la anterior)"]);
    const tabla = tablaDeComparacion({ filas, sinPareja });
    expect(tabla).toContain("| E1 | dura | control | 10/10 | 9/10 | FALLA |");
    expect(tabla).toContain("500 → 900");
    expect(tabla).toContain("500 → 100");
  });

  it("lee un informe.json viejo, sin las cifras nuevas, y rechaza lo que no lo es", () => {
    const viejo = JSON.stringify({
      meta: { fecha: "20261029-1000", variantes: ["control"] },
      resumen: [
        {
          guion: "E1",
          escenario: "E1",
          regla: "dura",
          variante: "control",
          total: 10,
          ok: 10,
          fallos: 0,
          errores: 0,
          mediaDeHerramientas: 1,
          mediaDeGetCatalog: 1,
          mediaDeCaracteres: 50,
        },
      ],
    });
    const leido = leerInformeAnterior(viejo);
    expect(leido.meta).toEqual({
      fecha: "20261029-1000",
      etiqueta: null,
      variantes: ["control"],
    });
    expect(leido.resumen[0]).toMatchObject({
      mediaDeTurnos: 0,
      mediaDeCaracteresDeTools: 0,
      fallosPorComprobacion: [],
    });
    expect(() => leerInformeAnterior("no json")).toThrow(ErrorDeUso);
    expect(() => leerInformeAnterior('{"hola":1}')).toThrow(
      /no parece un informe/
    );
  });

  it("--comparar-con lee el informe antes de gastar nada y lo pone en el informe", async () => {
    const adaptador = adaptadorFalso({
      chatWithAssistant: vi.fn(async () => "No la tenemos."),
      listConversationMessages: vi.fn(
        async (): Promise<TelnyxConversationMessage[]> => [
          { role: "user", text: "¿Hacéis keratina?" },
          {
            role: "assistant",
            text: "",
            toolCalls: [{ id: "1", nombre: "get_catalog", argumentos: "{}" }],
          },
          { role: "tool", text: "{}" },
          { role: "assistant", text: "No la tenemos." },
          { role: "user", text: "Vale, gracias. Nada más, adiós." },
          { role: "assistant", text: "Hasta luego." },
        ]
      ),
    });
    const anterior = JSON.stringify({
      meta: {
        fecha: "20261029-1000",
        etiqueta: "tools de main",
        variantes: ["control"],
      },
      resumen: [celda(e1, "control", 10, 0)],
    });
    const { deps, escritos, log } = dependencias(adaptador, {
      leerInforme: vi.fn(async () => anterior),
    });

    const resultado = await ejecutarLaboratorio(
      opciones([
        "--escenarios",
        "E1",
        "--n",
        "2",
        "--comparar-con",
        "/tmp/informes/20261029-1000",
        "--etiqueta",
        "tools de la rama",
        "--salida",
        "/tmp/lab",
      ]),
      deps
    );

    expect(deps.leerInforme).toHaveBeenCalledWith(
      "/tmp/informes/20261029-1000/informe.json"
    );
    expect(resultado.informe!.meta.etiqueta).toBe("tools de la rama");
    expect(resultado.informe!.comparacion).toMatchObject({
      con: "/tmp/informes/20261029-1000",
      etiqueta: "tools de main",
      filas: [{ guion: "E1", variante: "control", veredicto: "OK" }],
    });
    const md = escritos.find((e) => e.ruta.endsWith("informe.md"))!.contenido;
    expect(md).toContain(
      "# Laboratorio de prompt 20261030-1542 · tools de la rama"
    );
    expect(md).toContain("## Comparación con tools de main (20261029-1000)");
    expect(md).toContain("| E1 | dura | control | 10/10 | 2/2 | OK |");
    expect(
      log.mock.calls.some(([m]) =>
        String(m).includes("Veredicto (ahora frente a antes)")
      )
    ).toBe(true);

    // Una ruta que no se puede leer falla antes de crear nada.
    const otro = adaptadorFalso();
    const { deps: sinInforme } = dependencias(otro);
    await expect(
      ejecutarLaboratorio(
        opciones(["--escenarios", "E1", "--comparar-con", "/no/existe"]),
        sinInforme
      )
    ).rejects.toThrow(/no hay informe en \/no\/existe\/informe.json/);
    expect(otro.createAssistant).not.toHaveBeenCalled();
    expect(sinInforme.cargarContexto).not.toHaveBeenCalled();
  });

  it("también vale la ruta del propio informe.json", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependencias(adaptador, {
      leerInforme: vi.fn(async () => {
        throw new ErrorDeUso("--comparar-con: no se pudo leer");
      }),
    });
    await expect(
      ejecutarLaboratorio(
        opciones([
          "--escenarios",
          "E1",
          "--comparar-con",
          "/tmp/x/informe.json",
        ]),
        deps
      )
    ).rejects.toThrow(/no se pudo leer/);
    expect(deps.leerInforme).toHaveBeenCalledWith("/tmp/x/informe.json");
  });
});

// ---------------------------------------------------------------------------
// Revisión del 30-10: teléfonos dictados, restablecer, saludo por llamada,
// despedida y E17
// ---------------------------------------------------------------------------

describe("teléfonos que dicta el cliente", () => {
  it("la batería real solo dicta teléfonos de ficción", () => {
    const plan = planificar(sinForzar(["--con-citas", "--n", "1"]));
    const asignacion = { porTarea: new Map(), avisos: [] };
    expect(
      telefonosFueraDelLaboratorio(plan.tareas, asignacion, {
        ...CATALOGO_DE_PRUEBA,
        telefonosDeCliente: TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
      })
    ).toEqual([]);
  });

  it("un guion que dicta un móvil real no corre, ni en un negocio elegido a mano", () => {
    const plan = planificar(
      opciones(["--escenarios", "E21", "--n", "1", "--con-citas"]),
      CATALOGO_DE_PRUEBA
    );
    const conMovilReal = plan.tareas.map((tarea) => ({
      ...tarea,
      guion: {
        ...tarea.guion,
        datos: { ...tarea.guion.datos, telefonos: ["612 345 679"] },
      },
    }));
    const problemas = telefonosFueraDelLaboratorio(
      conMovilReal,
      { porTarea: new Map(), avisos: [] },
      CATALOGO_DE_PRUEBA
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/E21: el cliente dicta \+34•+5679/);
    expect(problemas[0]).not.toContain("612345679");
  });

  it("el teléfono de un negocio sembrado lo ve «sinTelefono»", () => {
    const telefono = telefonoDelNegocioDeLaboratorio(9).replace(
      /^\+1(\d{3})(\d{3})(\d{4})$/,
      "+1 $1 $2 $3"
    );
    expect(telefonosDelTexto(`Llámanos al ${telefono}`)).toHaveLength(1);
    expect(
      evaluarGuion(
        guionDe("E18a"),
        conversacion([`El número del negocio es ${telefono}.`, "-", "-"])
      ).some((c) => !c.ok)
    ).toBe(true);
  });
});

describe("negocios de laboratorio inertes", () => {
  const id = NEGOCIOS_DE_LABORATORIO[0]!.id;

  it("deja pasar el sembrado y los negocios que no son del catálogo", () => {
    expect(() =>
      exigirNegocioDeLaboratorioInerte({
        id,
        name: "Lab · Peluquería",
        telnyxPhoneNumber: null,
      })
    ).not.toThrow();
    expect(() =>
      exigirNegocioDeLaboratorioInerte({
        id: "biz_real",
        name: "Peluquería real",
        telnyxPhoneNumber: "+34930000000",
      })
    ).not.toThrow();
    expect(() =>
      exigirNegocioDeLaboratorioInerte({
        id: NEGOCIOS_DE_LABORATORIO.find(
          (n) => n.clave === "transferencia-siempre"
        )!.id,
        name: "Lab · Transferencia siempre",
        telnyxPhoneNumber: "+34900000002",
      })
    ).not.toThrow();
  });

  it("se niega si alguien le puso número de Telnyx o le cambió el nombre", () => {
    expect(() =>
      exigirNegocioDeLaboratorioInerte({
        id,
        name: "Lab · Peluquería",
        telnyxPhoneNumber: "+34930454394",
      })
    ).toThrow(/número de Telnyx \(\+34•+4394\)/);
    expect(() =>
      exigirNegocioDeLaboratorioInerte({
        id,
        name: "Peluquería de Ana",
        telnyxPhoneNumber: null,
      })
    ).toThrow(/se llama «Peluquería de Ana»/);
  });
});

describe("variablesComunes", () => {
  const con = (nombre: string) => ({
    saludo: "s",
    variables: {
      nombre_cliente: nombre,
      ultimo_servicio: nombre ? "Corte" : "",
    },
  });

  it("las mismas en todas, ninguna con valor o distintas", () => {
    expect(variablesComunes([con("Marta"), con("Marta")])).toEqual({
      nombre_cliente: "Marta",
      ultimo_servicio: "Corte",
    });
    expect(variablesComunes([con(""), con("")])).toBeUndefined();
    expect(variablesComunes([])).toBeUndefined();
    expect(variablesComunes([con("Marta"), con("")])).toBe("distintas");
  });
});

describe("crearCerrojosPorNegocio", () => {
  it("una exclusiva va sola en su negocio; las compartidas, juntas; otro negocio no espera", async () => {
    const cerrojos = crearCerrojosPorNegocio();
    const eventos: string[] = [];
    let soltar!: () => void;
    const bloqueo = new Promise<void>((r) => (soltar = r));
    const lectura1 = cerrojos.con("a", false, async () => {
      eventos.push("l1 empieza");
      await bloqueo;
      eventos.push("l1 acaba");
    });
    const lectura2 = cerrojos.con("a", false, async () => {
      eventos.push("l2 empieza");
    });
    const escritura = cerrojos.con("a", true, async () => {
      eventos.push("e empieza");
    });
    const lecturaTardia = cerrojos.con("a", false, async () => {
      eventos.push("l3 empieza");
    });
    const otroNegocio = cerrojos.con("b", true, async () => {
      eventos.push("b empieza");
    });
    await otroNegocio;
    await lectura2;
    expect(eventos).toEqual(["l1 empieza", "l2 empieza", "b empieza"]);
    soltar();
    await Promise.all([lectura1, escritura, lecturaTardia]);
    // La escritura espera a las lecturas que tenía delante, y la lectura que
    // llegó después espera a la escritura.
    expect(eventos.slice(3)).toEqual(["l1 acaba", "e empieza", "l3 empieza"]);
  });

  it("suelta el cerrojo aunque el trabajo falle", async () => {
    const cerrojos = crearCerrojosPorNegocio();
    await expect(
      cerrojos.con("a", true, async () => {
        throw new Error("fallo");
      })
    ).rejects.toThrow("fallo");
    await expect(cerrojos.con("a", true, async () => "sigue")).resolves.toBe(
      "sigue"
    );
  });
});

describe("restablecer los negocios de laboratorio entre repeticiones", () => {
  it("solo las que reservan, y solo en negocios del catálogo", () => {
    const deLab = planificar(
      sinForzar(["--escenarios", "E1,E10", "--n", "1", "--con-citas"]),
      CATALOGO_DE_PRUEBA
    );
    expect(
      deLab.tareas.map((t) => [
        t.guion.clave,
        restableceElNegocio(t, CATALOGO_DE_PRUEBA),
      ])
    ).toEqual([
      ["E1", false],
      ["E10", true],
    ]);
    const elegido = planificar(
      opciones(["--escenarios", "E10", "--n", "1", "--con-citas"]),
      CATALOGO_DE_PRUEBA
    );
    expect(restableceElNegocio(elegido.tareas[0]!, CATALOGO_DE_PRUEBA)).toBe(
      false
    );
  });

  it("restablece antes y después de cada repetición que reserva, de una en una", async () => {
    const orden: string[] = [];
    let enCurso = 0;
    let maximoEnCurso = 0;
    const adaptador = adaptadorFalso({
      chatWithAssistant: vi.fn(async () => {
        enCurso++;
        maximoEnCurso = Math.max(maximoEnCurso, enCurso);
        orden.push("chat");
        await new Promise((r) => setTimeout(r, 1));
        enCurso--;
        return "Hecho.";
      }),
    });
    const restablecerNegocio = vi.fn(async (negocioId: string) => {
      orden.push(`restablecer ${negocioId}`);
    });
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      restablecerNegocio,
    });
    const resultado = await ejecutarLaboratorio(
      sinForzar([
        "--escenarios",
        "E10",
        "--n",
        "2",
        "--con-citas",
        "--si",
        "--paralelo",
        "3",
        "--variantes",
        "control",
      ]),
      deps
    );
    expect(resultado.informe).not.toBeNull();
    // Dos repeticiones, cada una entre dos restablecimientos y sin solaparse.
    expect(restablecerNegocio).toHaveBeenCalledTimes(4);
    expect(maximoEnCurso).toBe(1);
    const sinChats = orden.filter(
      (paso, i) => paso !== "chat" || orden[i - 1] !== "chat"
    );
    expect(sinChats).toEqual([
      `restablecer ${BASE}`,
      "chat",
      `restablecer ${BASE}`,
      `restablecer ${BASE}`,
      "chat",
      `restablecer ${BASE}`,
    ]);
  });

  it("si no se puede restablecer antes, la repetición es un error de ejecución", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      restablecerNegocio: vi.fn(async () => {
        throw new Error("BD caída");
      }),
    });
    const resultado = await ejecutarLaboratorio(
      sinForzar([
        "--escenarios",
        "E10",
        "--n",
        "1",
        "--con-citas",
        "--si",
        "--variantes",
        "control",
      ]),
      deps
    );
    const repeticion = resultado.informe!.repeticiones[0]!.resultados[0]!;
    expect(repeticion.error).toMatch(/BD caída/);
    expect(adaptador.chatWithAssistant).not.toHaveBeenCalled();
    expect(resultado.informe!.meta.avisos.join("\n")).toMatch(
      /No se pudo restablecer/
    );
  });

  it("sin restablecer, avisa de que las citas se acumulan", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador);
    const resultado = await ejecutarLaboratorio(
      sinForzar([
        "--escenarios",
        "E10",
        "--n",
        "1",
        "--con-citas",
        "--si",
        "--variantes",
        "control",
      ]),
      deps
    );
    expect(resultado.informe!.meta.avisos.join("\n")).toMatch(
      /no restablece.*se acumulan/
    );
  });
});

describe("saludo y variables de cada llamada", () => {
  it("una llamada usa el saludo con que contestaría el backend y pasa sus variables", async () => {
    const adaptador = adaptadorFalso();
    const { deps } = dependenciasDeLaboratorio(adaptador, {
      cargarContexto: vi.fn(async (input) => ({
        ...contextoDeLaboratorio(input.negocioId, input.fecha, input.variantes),
        porLlamada: Object.fromEntries(
          ["call-1", "call-2", "call-3"].map((callId) => [
            callId,
            {
              saludo: "¡Hola, Marta! ¿Quieres repetir Corte?",
              variables: { nombre_cliente: "Marta", ultimo_servicio: "Corte" },
            },
          ])
        ),
      })),
    });
    await ejecutarLaboratorio(
      sinForzar(["--escenarios", "E1", "--n", "1", "--variantes", "control"]),
      deps
    );
    expect(adaptador.addConversationMessage).toHaveBeenCalledWith(
      expect.any(String),
      { role: "assistant", content: "¡Hola, Marta! ¿Quieres repetir Corte?" }
    );
    const metadata = (
      llamadasA(adaptador.createConversation)[0]![0] as {
        metadata: Record<string, string>;
      }
    ).metadata;
    expect(metadata).toMatchObject({
      nombre_cliente: "Marta",
      ultimo_servicio: "Corte",
    });
  });
});

describe("la despedida del cliente reactivo", () => {
  function llmQueDice(...respuestas: string[]) {
    return vi.fn(async () => {
      const siguiente = respuestas.shift();
      if (siguiente === undefined) throw new Error("el LLM no esperaba más");
      return siguiente;
    });
  }
  const entradaDe = (
    clave: string,
    turno: number,
    completar: EntradaDelCliente["completar"],
    historial: EntradaDelCliente["historial"] = []
  ): EntradaDelCliente => ({
    guion: guionDe(clave),
    modo: "reactivo",
    turno,
    historial,
    saludo: "Hola",
    modelo: MODELO_DEL_CLIENTE,
    completar,
  });

  it("solo la exigen los guiones que miran el último turno", () => {
    expect(exigeDespedida(guionDe("E16b"))).toBe(true);
    expect(exigeDespedida(guionDe("E17"))).toBe(true);
    expect(exigeDespedida(guionDe("E1"))).toBe(false);
    expect(pareceDespedida("Perfecto, nada más. Muchas gracias, adiós")).toBe(
      true
    );
    expect(pareceDespedida("Sí, confirmo")).toBe(false);
  });

  it("si termina callado sin despedirse, dice la despedida del guion", async () => {
    const decision = await siguienteMensajeDelCliente(
      entradaDe("E16b", 4, llmQueDice('{"mensaje":"","fin":true}'), [
        { cliente: "Sí, confírmalo", respuesta: "Reservado. ¿Algo más?" },
      ])
    );
    expect(decision.mensaje).toBe(guionDe("E16b").turnos.at(-1));
    expect(decision.fin).toBe(true);
    expect(decision.avisos.join("\n")).toMatch(/sin despedirse/);
  });

  it("si ya se despidió, termina sin repetirla", async () => {
    const decision = await siguienteMensajeDelCliente(
      entradaDe("E16b", 5, llmQueDice('{"mensaje":"","fin":true}'), [
        { cliente: "Nada más, adiós", respuesta: "¡Adiós!" },
      ])
    );
    expect(decision.mensaje).toBeNull();
  });

  it("si cumple el objetivo sin despedirse, sigue un turno más", async () => {
    const decision = await siguienteMensajeDelCliente(
      entradaDe(
        "E16b",
        3,
        llmQueDice('{"mensaje":"Sí, confírmalo","fin":true}')
      )
    );
    expect(decision).toMatchObject({ mensaje: "Sí, confírmalo", fin: false });
  });

  it("en el tope, el último mensaje es la despedida del guion", async () => {
    const tope = topeDeTurnos(guionDe("E16b"));
    const decision = await siguienteMensajeDelCliente(
      entradaDe(
        "E16b",
        tope,
        llmQueDice('{"mensaje":"¿Y a las 18?","fin":false}')
      )
    );
    expect(decision.mensaje).toBe(guionDe("E16b").turnos.at(-1));
    expect(decision.fin).toBe(true);
  });

  it("un guion sin `ultimo` termina callado como siempre", async () => {
    const decision = await siguienteMensajeDelCliente(
      entradaDe("E10", 3, llmQueDice('{"mensaje":"","fin":true}'))
    );
    expect(decision.mensaje).toBeNull();
  });
});

describe("E17 por chat", () => {
  it("los informes del turno de la despedida no cuentan para «como mucho uno»", () => {
    const c = conversacion(
      ["¿A qué número te llama Ana?", "Apuntado, se lo paso.", "¡Hasta luego!"],
      [
        { nombre: "informar_al_negocio", turno: 3 },
        { nombre: "informar_al_negocio", turno: 3 },
      ]
    );
    expect(evaluarGuion(guionDe("E17"), c).filter((r) => !r.ok)).toEqual([]);
    expect(turnosDelAmbito(c, { salvoUltimo: true })).toEqual([1, 2]);
    const dosAntes = conversacion(
      ["¿A qué número?", "Apuntado.", "¡Hasta luego!"],
      [
        { nombre: "informar_al_negocio", turno: 2 },
        { nombre: "informar_al_negocio", turno: 2 },
      ]
    );
    expect(
      evaluarGuion(guionDe("E17"), dosAntes).some(
        (r) => !r.ok && /antes de la despedida/.test(r.descripcion)
      )
    ).toBe(true);
  });
});

describe("resultadoSinAssistant", () => {
  it("cuenta como error de ejecución, no como fallo del prompt", () => {
    const r = resultadoSinAssistant(
      { repeticion: 3 } as Parameters<typeof resultadoSinAssistant>[0],
      "lab-x-0001",
      "400 10015"
    );
    expect(r).toMatchObject({
      repeticion: 3,
      llamadaUsada: "lab-x-0001",
      ok: false,
      error: "400 10015",
    });
  });
});
