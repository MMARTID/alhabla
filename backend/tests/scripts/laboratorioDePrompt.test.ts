import { describe, it, expect, vi } from "vitest";
import {
  ErrorDeUso,
  PREFIJO_DEL_LABORATORIO,
  TOPE_DE_TURNOS_SIN_CONFIRMAR,
  asignarLlamadas,
  crearRegistroDeLimpieza,
  detectarIdioma,
  enmascararTelefono,
  ejecutarLaboratorio,
  esNombreDeLaboratorio,
  evaluarComprobacion,
  evaluarGuion,
  exigirBaseUrlDeDev,
  exigirBdLocal,
  exigirConfirmacion,
  fechaDelLaboratorio,
  informeMarkdown,
  leerVeredictoDelJuez,
  neutralizarTransferencia,
  nombreDelAssistant,
  parsearArgumentos,
  planificar,
  reconstruirConversacion,
  repartirLlamadas,
  resumirCelda,
  tablaMarkdown,
  telefonosDelTexto,
  veredicto,
  versionDelPromptSoportada,
  type AdaptadorDelLaboratorio,
  type Conversacion,
  type ContextoDelNegocio,
  type DependenciasDelLaboratorio,
  type Informe,
  type ResultadoDeRepeticion,
} from "../../scripts/laboratorioDePrompt.js";
import {
  ESCENARIOS,
  todosLosGuiones,
  type Comprobacion,
} from "../../scripts/laboratorioDePrompt.escenarios.js";
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
  llamadas = ["call-1", "call-2", "call-3"]
): ContextoDelNegocio {
  const payloads = {} as ContextoDelNegocio["payloads"];
  for (const variante of variantes) {
    payloads[variante] = {
      name: nombreDelAssistant(fecha, variante),
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
      contextoFalso(input.negocioId, input.fecha, input.variantes)
    ),
    marcadorDeChat: () => "[WhatsApp · +34600000000 · hoy]",
    escribirInforme: vi.fn(async (ruta: string, contenido: string) => {
      escritos.push({ ruta, contenido });
    }),
    ahora: () => new Date(2026, 9, 30, 15, 42),
    dormir: vi.fn(async () => {}),
    log,
    ...sobreescribir,
  };
  return { deps, escritos, log };
}

function opciones(argumentos: string[] = []) {
  return parsearArgumentos(["--negocio", "biz_1", ...argumentos]);
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
    const o = opciones();
    expect(o).toMatchObject({
      negocio: "biz_1",
      n: 10,
      escenarios: null,
      variantes: ["control"],
      dryRun: false,
      si: false,
      juez: null,
      paralelo: 3,
      conCitas: false,
      listaDeEspera: "auto",
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
      "--dry-run",
      "--si",
    ]);
    expect(o).toMatchObject({
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
    [["--n", "10"], /--negocio/],
    [["--negocio", "b", "--raro"], /desconocida/],
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

  it("--ayuda no exige --negocio", () => {
    expect(parsearArgumentos(["--ayuda"]).ayuda).toBe(true);
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

  it("acepta una BD local y traduce el host de Compose", () => {
    expect(exigirBdLocal("postgresql://u:p@localhost:5433/botbook")).toContain(
      "localhost:5433"
    );
    expect(exigirBdLocal("postgresql://u:p@127.0.0.1:5432/botbook")).toContain(
      "127.0.0.1"
    );
    expect(exigirBdLocal("postgresql://u:p@postgres:5432/botbook")).toContain(
      "localhost:5433"
    );
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
      { name: "Responsable", to: "+34000000000" },
    ]);
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
      "Apunto 612 345 678, el negocio te llamará.",
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
        n: 10,
        variantes: ["control", "v2"],
        juez: null,
        turnosTotales: 40,
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

  it("limpia aunque falle a mitad: crea el segundo assistant y revienta", async () => {
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

    await expect(
      ejecutarLaboratorio(
        opciones([
          "--escenarios",
          "E1",
          "--n",
          "1",
          "--variantes",
          "control,v2",
        ]),
        deps
      )
    ).rejects.toThrow(/Telnyx caído/);

    expect(adaptador.deleteAssistant).toHaveBeenCalledWith("assistant-1");
    expect(adaptador.deleteTexmlAppOfAssistant).toHaveBeenCalledWith(
      "assistant-1"
    );
    expect(adaptador.chatWithAssistant).not.toHaveBeenCalled();
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
