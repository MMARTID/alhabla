import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaMock } from "./ayudas.js";
import { dentroDe, hace } from "./ayudas.js";
import {
  CERROJO_DE_APROBACION,
  CERROJO_DE_CONOCIMIENTO,
  ErrorDeGrowth,
  accionesDisponibles,
  adquirirCerrojosDeAprobacion,
  asegurarFuente,
  cambiarEstadoConGuardia,
  claveDeUrl,
  crearOportunidad,
  crearOportunidadManual,
  detallarBorradores,
  dominioDeUrl,
  errorDeAgenda,
  escaparComodinesDeLike,
  esBorradorEditable,
  exigirGrowthActivo,
  guardiaDePausa,
  limpiarJsonParaBd,
  limpiarTextoParaBd,
  listarOportunidades,
  normalizarUrl,
  porAgente,
  recortarPorPuntosDeCodigo,
  registrarDecision,
  urlParaAbrir,
  validarUrlExterna,
} from "../../../src/modules/growth/service.js";
import { transicionesPosibles } from "../../../src/modules/growth/estados.js";
import { CLAVE_DEL_CERROJO_DE_CONOCIMIENTO } from "../../../src/modules/growth/conocimiento/sincronizar.js";

const { prismaMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  return { prismaMock: crearPrismaMock() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const mock = prismaMock as PrismaMock;
/** Carácter de reemplazo (U+FFFD): escrito por su código para que se vea en el fichero. */
const REEMPLAZO = String.fromCodePoint(0xfffd);

beforeEach(() => {
  vi.resetAllMocks();
  mock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
  );
});

describe("URL", () => {
  it("la misma página con otro seguimiento, www o barra final es la misma", () => {
    const a = "https://www.Ejemplo.com/a/?utm_source=x&b=2&a=1#arriba";
    const b = "https://ejemplo.com/a?a=1&b=2&fbclid=zzz";
    expect(normalizarUrl(a)).toBe("https://ejemplo.com/a?a=1&b=2");
    expect(claveDeUrl(a)).toBe(claveDeUrl(b));
  });

  it("http y https son páginas distintas", () => {
    expect(claveDeUrl("http://ejemplo.com/a")).not.toBe(
      claveDeUrl("https://ejemplo.com/a")
    );
  });

  it("normalizarUrl rechaza lo que no es http(s) aunque se llame sin pasar por el esquema", () => {
    expect(() => normalizarUrl("javascript:alert(1)")).toThrow(ErrorDeGrowth);
    expect(() => normalizarUrl("data:text/html,x")).toThrow(ErrorDeGrowth);
  });

  describe("la misma página con otra forma de escribirla", () => {
    it("el puerto distingue páginas; las barras repetidas, la barra final y index.html no", () => {
      expect(normalizarUrl("https://ejemplo.com:8443/x")).toBe(
        "https://ejemplo.com:8443/x"
      );
      // El puerto por defecto del esquema no cuenta.
      expect(normalizarUrl("https://ejemplo.com:443/x")).toBe(
        "https://ejemplo.com/x"
      );
      expect(claveDeUrl("https://ejemplo.com:8443/x")).not.toBe(
        claveDeUrl("https://ejemplo.com/x")
      );
      const base = claveDeUrl("https://ejemplo.com/dir");
      for (const variante of [
        "https://ejemplo.com//dir",
        "https://ejemplo.com/dir/",
        "https://ejemplo.com/dir//",
        "https://www.ejemplo.com/dir/?utm_source=x",
      ]) {
        expect(claveDeUrl(variante), variante).toBe(base);
      }
      expect(normalizarUrl("https://ejemplo.com/dir/index.html")).toBe(
        "https://ejemplo.com/dir"
      );
      expect(normalizarUrl("https://ejemplo.com/index.php")).toBe(
        "https://ejemplo.com/"
      );
      expect(normalizarUrl("https://ejemplo.com/")).toBe(
        "https://ejemplo.com/"
      );
      // Una página que solo se parece a un índice no se confunde con uno.
      expect(normalizarUrl("https://ejemplo.com/reindex.html")).toBe(
        "https://ejemplo.com/reindex.html"
      );
    });
  });

  describe("el punto final de un FQDN no crea otro sitio", () => {
    it("ejemplo.com. y ejemplo.com dan el mismo dominio, la misma URL normalizada y la misma clave", () => {
      expect(dominioDeUrl("https://ejemplo.com./x")).toBe("ejemplo.com");
      expect(dominioDeUrl("https://www.ejemplo.com./x")).toBe("ejemplo.com");
      expect(dominioDeUrl("https://EJEMPLO.com../x")).toBe("ejemplo.com");
      expect(normalizarUrl("https://ejemplo.com./x")).toBe(
        "https://ejemplo.com/x"
      );
      expect(claveDeUrl("https://ejemplo.com./x")).toBe(
        claveDeUrl("https://ejemplo.com/x")
      );
      expect(claveDeUrl("https://www.ejemplo.com./x/?utm_source=a")).toBe(
        claveDeUrl("https://ejemplo.com/x")
      );
    });
  });

  describe("urlParaAbrir: la URL que se guarda y que abre una persona", () => {
    it("conserva el www, el esquema y la barra, y quita seguimiento, fragmento y credenciales", () => {
      expect(
        urlParaAbrir(
          "https://user:pass@www.Ejemplo.com/Mejores/?utm_source=x&b=2&gclid=z&a=1#arriba"
        )
      ).toBe("https://www.ejemplo.com/Mejores/?b=2&a=1");
    });

    it("sin seguimiento no deja un «?» colgando", () => {
      expect(
        urlParaAbrir("http://www.ejemplo.com/p?utm_source=x&fbclid=y")
      ).toBe("http://www.ejemplo.com/p");
    });

    it("quita el punto final del host y rechaza lo que no es http(s)", () => {
      expect(urlParaAbrir("https://www.ejemplo.com./p")).toBe(
        "https://www.ejemplo.com/p"
      );
      expect(() => urlParaAbrir("javascript:alert(1)")).toThrow(ErrorDeGrowth);
    });
  });

  describe("validarUrlExterna", () => {
    it.each([
      "https://ejemplo.com/p",
      "https://sub.dominio.co.uk/a/b?c=d",
      "http://ejemplo.es",
    ])("admite %s", (url) => {
      expect(() => validarUrlExterna(url)).not.toThrow();
    });

    it.each([
      ["https://alhabla.ai/x", "dominio_propio"],
      ["https://www.alhabla.ai", "dominio_propio"],
      ["https://blog.app.alhabla.ai/x", "dominio_propio"],
    ])("rechaza la propia web: %s", (url, codigo) => {
      try {
        validarUrlExterna(url);
        throw new Error("debía fallar");
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorDeGrowth);
        expect((error as ErrorDeGrowth).status).toBe(400);
        expect((error as ErrorDeGrowth).codigo).toBe(codigo);
      }
    });

    it.each([
      "https://alhabla.ai./x",
      "https://www.alhabla.ai./x",
      "https://app.alhabla.ai../x",
      "HTTPS://ALHABLA.AI./X",
    ])("rechaza la propia web con punto final de FQDN: %s", (url) => {
      expect(() => validarUrlExterna(url)).toThrow(
        expect.objectContaining({ codigo: "dominio_propio" })
      );
    });

    it.each([
      "http://localhost./x",
      "http://foo.localhost./x",
      "http://metadata.google.internal./computeMetadata/v1/",
      "http://127.0.0.1./",
      "https://nas.local./",
    ])("rechaza el host interno con punto final de FQDN: %s", (url) => {
      expect(() => validarUrlExterna(url)).toThrow(ErrorDeGrowth);
    });

    it("alhabla.ai.malo.com sí es de un tercero", () => {
      expect(() =>
        validarUrlExterna("https://alhabla.ai.malo.com/x")
      ).not.toThrow();
    });

    it.each([
      "http://localhost/x",
      "http://app.localhost:3001",
      "http://127.0.0.1",
      "http://10.0.0.5/x",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://0x7f.0.0.1/",
      "http://2130706433/",
      "https://nas.local",
      "https://panel.internal",
      "https://router.lan",
      "http://intranet",
    ])("rechaza el host interno %s", (url) => {
      expect(() => validarUrlExterna(url)).toThrow(ErrorDeGrowth);
    });
  });
});

describe("asegurarFuente", () => {
  const fila = {
    id: "fuente_manual",
    tipo: "manual",
    nombre: "Entrada manual",
    activa: true,
  };

  it("hace upsert por id fijo, sin tocar lo que ya hay", async () => {
    mock.growthFuente.upsert.mockResolvedValue(fila);
    const r = await asegurarFuente("manual");
    expect(r).toEqual(fila);
    expect(mock.growthFuente.upsert.mock.calls[0]![0]).toMatchObject({
      where: { id: "fuente_manual" },
      create: { id: "fuente_manual", tipo: "manual", activa: true },
      update: {},
    });
  });

  it("una fuente que existía desactivada se devuelve desactivada: no se reactiva sola", async () => {
    mock.growthFuente.upsert.mockResolvedValue({ ...fila, activa: false });
    expect((await asegurarFuente("manual")).activa).toBe(false);
    expect(mock.growthFuente.upsert.mock.calls[0]![0].update).toEqual({});
  });

  it("si otra petición la crea a la vez (P2002) relee la ganadora", async () => {
    mock.growthFuente.upsert.mockRejectedValue({ code: "P2002" });
    mock.growthFuente.findUniqueOrThrow.mockResolvedValue(fila);
    expect(await asegurarFuente("manual")).toEqual(fila);
  });

  it("cualquier otro error se propaga", async () => {
    mock.growthFuente.upsert.mockRejectedValue(new Error("caída"));
    await expect(asegurarFuente("web")).rejects.toThrow("caída");
  });

  it("usa el cliente que se le pasa", async () => {
    const otro = { growthFuente: { upsert: vi.fn().mockResolvedValue(fila) } };
    await asegurarFuente("manual", otro as never);
    expect(otro.growthFuente.upsert).toHaveBeenCalled();
    expect(mock.growthFuente.upsert).not.toHaveBeenCalled();
  });
});

describe("la pausa", () => {
  it("con `pausa: true` lanza 409 pausa", async () => {
    mock.growthAjuste.findUnique.mockResolvedValue({
      clave: "pausa",
      valor: true,
    });
    await expect(exigirGrowthActivo()).rejects.toMatchObject({
      status: 409,
      codigo: "pausa",
      message: "Growth está en pausa.",
    });
    await expect(guardiaDePausa()).rejects.toBeInstanceOf(ErrorDeGrowth);
  });

  it.each([false, null, "true", 1, undefined])(
    "con %s no hay pausa",
    async (valor) => {
      mock.growthAjuste.findUnique.mockResolvedValue({ clave: "pausa", valor });
      await expect(exigirGrowthActivo()).resolves.toBeUndefined();
    }
  );

  it("sin fila no hay pausa", async () => {
    mock.growthAjuste.findUnique.mockResolvedValue(null);
    await expect(guardiaDePausa()).resolves.toBeUndefined();
  });

  it("lee solo la clave de la pausa", async () => {
    mock.growthAjuste.findUnique.mockResolvedValue(null);
    await exigirGrowthActivo();
    expect(mock.growthAjuste.findUnique).toHaveBeenCalledWith({
      where: { clave: "pausa" },
    });
  });
});

describe("registrarDecision y quién firma", () => {
  it("escribe una fila con lo que se le dice", async () => {
    mock.growthDecision.create.mockResolvedValue({});
    await registrarDecision(prismaMock as never, {
      oportunidadId: "o1",
      accion: "calificar",
      motivo: "ok",
      por: "agente:semanal",
    });
    expect(mock.growthDecision.create).toHaveBeenCalledWith({
      data: {
        oportunidadId: "o1",
        borradorId: undefined,
        accion: "calificar",
        motivo: "ok",
        por: "agente:semanal",
      },
    });
  });

  it("admite decisiones sin oportunidad (ajustes, sincronizaciones)", async () => {
    mock.growthDecision.create.mockResolvedValue({});
    await registrarDecision(prismaMock as never, {
      accion: "ajustes",
      por: "admin@alhabla.ai",
    });
    const { data } = mock.growthDecision.create.mock.calls[0]![0];
    expect(data.oportunidadId).toBeUndefined();
    expect(data.borradorId).toBeUndefined();
  });

  it("recorta un motivo desmesurado", async () => {
    mock.growthDecision.create.mockResolvedValue({});
    await registrarDecision(prismaMock as never, {
      accion: "x",
      motivo: "m".repeat(5000),
      por: "sistema",
    });
    expect(
      mock.growthDecision.create.mock.calls[0]![0].data.motivo
    ).toHaveLength(1000);
  });

  it("un agente firma `agente:<nombre del token>`", () => {
    expect(porAgente({ nombre: "agente-semanal" })).toBe(
      "agente:agente-semanal"
    );
  });
});

describe("cambiarEstadoConGuardia", () => {
  it("cambia solo si sigue en el estado que se leyó", async () => {
    mock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });
    await cambiarEstadoConGuardia(prismaMock as never, {
      id: "o1",
      desde: "bloqueada",
      hasta: "pendiente_aprobacion",
      actor: "sistema",
      datos: { motivoDescarte: null },
    });
    expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", estado: "bloqueada" },
      data: { motivoDescarte: null, estado: "pendiente_aprobacion" },
    });
  });

  it("si otro lo cambió, 409 conflicto", async () => {
    mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      cambiarEstadoConGuardia(prismaMock as never, {
        id: "o1",
        desde: "bloqueada",
        hasta: "pendiente_aprobacion",
        actor: "sistema",
      })
    ).rejects.toMatchObject({ status: 409, codigo: "conflicto" });
  });

  it("un actor que no puede hacer ese cambio no llega a la base de datos", async () => {
    await expect(
      cambiarEstadoConGuardia(prismaMock as never, {
        id: "o1",
        desde: "pendiente_aprobacion",
        hasta: "aprobada",
        actor: "agente",
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
  });

  it("los cambios de `sistema` que añade la 1b están permitidos", async () => {
    mock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });
    for (const desde of ["pendiente_aprobacion", "aprobada"] as const) {
      await cambiarEstadoConGuardia(prismaMock as never, {
        id: "o1",
        desde,
        hasta: "bloqueada",
        actor: "sistema",
      });
    }
    expect(mock.growthOportunidad.updateMany).toHaveBeenCalledTimes(2);
  });
});

describe("crearOportunidadManual", () => {
  const fuente = {
    id: "fuente_manual",
    tipo: "manual",
    nombre: "Entrada manual",
    activa: true,
  };

  beforeEach(() => {
    mock.growthFuente.upsert.mockResolvedValue(fuente);
    mock.growthOportunidad.findUnique.mockResolvedValue(null);
    mock.growthOportunidad.create.mockResolvedValue({
      id: "o1",
      estado: "detectada",
    });
    mock.growthDecision.create.mockResolvedValue({});
  });

  it("crea una detectada de la fuente manual, sin extracto, y deja rastro", async () => {
    const r = await crearOportunidadManual(
      {
        url: "https://www.Ejemplo.com/directorio?utm_source=x",
        objetivoPrincipal: "BACKLINKS",
        nota: "Me la pasó un colega",
      },
      "admin@alhabla.ai"
    );
    expect(r).toEqual({ creada: true, id: "o1", estado: "detectada" });
    const datos = mock.growthOportunidad.create.mock.calls[0]![0].data;
    expect(datos).toMatchObject({
      fuenteId: "fuente_manual",
      url: "https://www.ejemplo.com/directorio",
      dominio: "ejemplo.com",
      titulo: "ejemplo.com",
      extracto: "",
      idioma: "es",
      objetivoPrincipal: "BACKLINKS",
      datos: { nota: "Me la pasó un colega" },
    });
    expect(datos.retencionHasta.getTime()).toBeGreaterThan(Date.now());
    expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject({
      oportunidadId: "o1",
      accion: "anadir_url",
      por: "admin@alhabla.ai",
    });
  });

  it("una fuente manual desactivada se acepta igualmente: la añade el administrador", async () => {
    mock.growthFuente.upsert.mockResolvedValue({ ...fuente, activa: false });
    const r = await crearOportunidadManual(
      { url: "https://ejemplo.com/x", objetivoPrincipal: "LEADS" },
      "a@b.c"
    );
    expect(r.creada).toBe(true);
  });

  it("una URL que ya existe, descartada o caducada, no se reabre y dice por qué", async () => {
    mock.growthOportunidad.findUnique.mockResolvedValue({
      id: "o9",
      estado: "descartada",
      motivoDescarte: "No viva",
    });
    const r = await crearOportunidadManual(
      { url: "https://ejemplo.com/x", objetivoPrincipal: "LEADS" },
      "a@b.c"
    );
    expect(r).toEqual({
      creada: false,
      id: "o9",
      estado: "descartada",
      motivoDescarte: "No viva",
    });
    expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    expect(mock.growthDecision.create).not.toHaveBeenCalled();
    expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza la propia web, localhost y las IP", async () => {
    for (const url of [
      "https://alhabla.ai/planes",
      "http://localhost:3000",
      "http://192.168.0.1",
    ]) {
      await expect(
        crearOportunidadManual({ url, objetivoPrincipal: "BACKLINKS" }, "a@b.c")
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
  });

  it("un nicho que no existe da 400", async () => {
    mock.growthNicho.findUnique.mockResolvedValue(null);
    await expect(
      crearOportunidadManual(
        {
          url: "https://ejemplo.com/x",
          objetivoPrincipal: "BACKLINKS",
          nichoSlug: "x",
        },
        "a@b.c"
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("acciones disponibles", () => {
  const sinBorradores = [] as never[];
  const pendiente = (resultado = "pasa") => [
    {
      estado: "pendiente_aprobacion",
      version: 1,
      revisiones: [{ revisor: "reglas", resultado, creadaEn: hace(1) }],
    },
  ];
  const habilitadas = (r: ReturnType<typeof accionesDisponibles>) =>
    r.filter((a) => a.habilitada).map((a) => a.accion);

  it("pendiente de aprobación: aprobar, devolver y descartar", () => {
    expect(
      habilitadas(
        accionesDisponibles(
          { estado: "pendiente_aprobacion", expiraEn: null },
          pendiente()
        )
      )
    ).toEqual(["aprobar", "devolver", "descartar"]);
  });

  it("solo da las acciones alcanzables desde el estado: en detectada, descartar y nada más", () => {
    const r = accionesDisponibles(
      { estado: "detectada", expiraEn: null },
      sinBorradores
    );
    expect(r).toEqual([{ accion: "descartar", habilitada: true }]);
  });

  it("nunca devuelve una acción inalcanzable ni «no admite esta acción»", () => {
    const estados = [
      "detectada",
      "calificada",
      "investigada",
      "con_borrador",
      "bloqueada",
      "pendiente_aprobacion",
      "devuelta",
      "aprobada",
      "gestionada",
      "conseguida",
      "sin_respuesta",
      "descartada",
      "caducada",
    ] as const;
    for (const estado of estados) {
      const r = accionesDisponibles({ estado, expiraEn: null }, sinBorradores);
      expect(JSON.stringify(r), estado).not.toContain("no admite");
      // Cada acción que sale es alcanzable: la máquina de estados la permite.
      const alcanzables = transicionesPosibles(estado, "admin");
      for (const a of r) {
        expect(
          alcanzables.includes(
            (
              {
                aprobar: "aprobada",
                devolver: "devuelta",
                descartar: "descartada",
                marcar_gestionado: "gestionada",
                conseguido: "conseguida",
                sin_respuesta: "sin_respuesta",
                rechazado: "sin_respuesta",
              } as const
            )[a.accion]
          ),
          `${estado}: ${a.accion}`
        ).toBe(true);
      }
      expect(r.length, estado).toBe(
        alcanzables.length + (estado === "gestionada" ? 1 : 0)
      );
      // Una deshabilitada siempre explica por qué, en español.
      for (const a of r.filter((x) => !x.habilitada)) {
        expect(a.motivo).toMatch(/\S/);
      }
    }
  });

  it("aprobar con un enfriamiento, otra aprobada del dominio o el tope lleno sale deshabilitada, con motivo", () => {
    const estado = { estado: "pendiente_aprobacion", expiraEn: null } as const;
    const aprobar = (agenda: Parameters<typeof accionesDisponibles>[3]) =>
      accionesDisponibles(estado, pendiente(), new Date(), agenda).find(
        (a) => a.accion === "aprobar"
      );

    expect(aprobar({})).toEqual({ accion: "aprobar", habilitada: true });
    expect(aprobar({ dominioEnEnfriamientoHasta: dentroDe(30) })).toMatchObject(
      {
        habilitada: false,
        motivo: expect.stringContaining(
          "no se puede volver a escribir hasta el"
        ),
      }
    );
    // Un enfriamiento que ya terminó no impide nada.
    expect(aprobar({ dominioEnEnfriamientoHasta: hace(1) })?.habilitada).toBe(
      true
    );
    expect(aprobar({ otraAprobadaDelDominio: true })).toMatchObject({
      habilitada: false,
      motivo: expect.stringContaining("otra oportunidad aprobada"),
    });
    expect(aprobar({ contactosEstaSemana: 5, topeSemanal: 5 })).toMatchObject({
      habilitada: false,
      motivo: "Se ha llegado al tope de 5 contactos esta semana.",
    });
    expect(
      aprobar({ contactosEstaSemana: 4, topeSemanal: 5 })?.habilitada
    ).toBe(true);
  });

  it("no se aprueba con un borrador bloqueado por las reglas ni con la oportunidad caducada", () => {
    const bloqueado = accionesDisponibles(
      { estado: "pendiente_aprobacion", expiraEn: null },
      pendiente("bloquea")
    ).find((a) => a.accion === "aprobar");
    expect(bloqueado?.habilitada).toBe(false);

    const caducada = accionesDisponibles(
      { estado: "pendiente_aprobacion", expiraEn: hace(1) },
      pendiente()
    ).find((a) => a.accion === "aprobar");
    expect(caducada?.habilitada).toBe(false);

    const vigente = accionesDisponibles(
      { estado: "pendiente_aprobacion", expiraEn: dentroDe(1) },
      pendiente()
    ).find((a) => a.accion === "aprobar");
    expect(vigente?.habilitada).toBe(true);
  });

  it("una revisión del modelo posterior no tapa el bloqueo de las reglas", () => {
    const r = accionesDisponibles(
      { estado: "pendiente_aprobacion", expiraEn: null },
      [
        {
          estado: "pendiente_aprobacion",
          version: 1,
          revisiones: [
            { revisor: "llm", resultado: "pasa", creadaEn: hace(0) },
            { revisor: "reglas", resultado: "bloquea", creadaEn: hace(1) },
          ],
        },
      ]
    );
    expect(r.find((a) => a.accion === "aprobar")?.habilitada).toBe(false);
  });

  it("aprobada: marcar como gestionado exige un borrador aprobado", () => {
    const con = accionesDisponibles({ estado: "aprobada", expiraEn: null }, [
      { estado: "aprobado", version: 1, revisiones: [] },
    ]);
    expect(habilitadas(con)).toEqual(["descartar", "marcar_gestionado"]);
    const sin = accionesDisponibles(
      { estado: "aprobada", expiraEn: null },
      sinBorradores
    );
    expect(habilitadas(sin)).toEqual(["descartar"]);
    // La deshabilitada sigue en la lista (es alcanzable) con su motivo.
    expect(sin).toContainEqual({
      accion: "marcar_gestionado",
      habilitada: false,
      motivo: "No hay ningún borrador aprobado.",
    });
  });

  it("los estados finales no tienen ninguna acción", () => {
    for (const estado of [
      "conseguida",
      "sin_respuesta",
      "descartada",
      "caducada",
    ] as const) {
      expect(
        habilitadas(
          accionesDisponibles({ estado, expiraEn: null }, sinBorradores)
        )
      ).toEqual([]);
    }
  });
});

describe("esBorradorEditable", () => {
  it("solo el último, sin aprobar, con la oportunidad en revisión o bloqueada", () => {
    const ok = { estado: "bloqueado", version: 3 };
    expect(esBorradorEditable(ok, { estado: "bloqueada" }, 3)).toBe(true);
    expect(
      esBorradorEditable(
        { estado: "pendiente_aprobacion", version: 3 },
        { estado: "pendiente_aprobacion" },
        3
      )
    ).toBe(true);
    expect(esBorradorEditable(ok, { estado: "bloqueada" }, 4)).toBe(false);
    for (const estado of ["aprobado", "gestionado", "descartado", "borrador"]) {
      expect(
        esBorradorEditable({ estado, version: 3 }, { estado: "bloqueada" }, 3)
      ).toBe(false);
    }
    for (const estado of [
      "aprobada",
      "devuelta",
      "descartada",
      "gestionada",
    ] as const) {
      expect(esBorradorEditable(ok, { estado }, 3)).toBe(false);
    }
  });
});

describe("detallarBorradores", () => {
  const base = {
    oportunidadId: "o1",
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: null,
    enlaceUrl: null,
    utm: null,
    estado: "descartado",
    textoFinal: null,
    editadoPorHumano: false,
    creadoEn: new Date(),
    revisiones: [],
    gestion: null,
  };

  it("sin afirmaciones citadas no consulta la base de datos", async () => {
    const r = await detallarBorradores(prismaMock as never, [
      {
        ...base,
        id: "b1",
        version: 1,
        texto: "uno dos tres cuatro",
        afirmaciones: [],
      } as never,
    ]);
    expect(r[0]!.afirmacionesDetalle).toEqual([]);
    expect(r[0]!.similitudConVersionAnterior).toBeNull();
    expect(mock.growthAfirmacion.findMany).not.toHaveBeenCalled();
  });

  it("consulta una sola vez todas las claves de todos los borradores", async () => {
    mock.growthAfirmacion.findMany.mockResolvedValue([]);
    await detallarBorradores(prismaMock as never, [
      {
        ...base,
        id: "b2",
        version: 2,
        texto: "a b c d",
        afirmaciones: ["x.a", "x.b"],
      } as never,
      {
        ...base,
        id: "b1",
        version: 1,
        texto: "a b c d",
        afirmaciones: ["x.b", "x.c"],
      } as never,
    ]);
    expect(mock.growthAfirmacion.findMany).toHaveBeenCalledOnce();
    expect(
      mock.growthAfirmacion.findMany.mock.calls[0]![0].where.clave.in.sort()
    ).toEqual(["x.a", "x.b", "x.c"]);
  });

  it("textos idénticos dan similitud 1 y textos distintos, cerca de 0", async () => {
    const r = await detallarBorradores(prismaMock as never, [
      {
        ...base,
        id: "b3",
        version: 3,
        texto: "uno dos tres cuatro cinco",
        afirmaciones: [],
      } as never,
      {
        ...base,
        id: "b2",
        version: 2,
        texto: "uno dos tres cuatro cinco",
        afirmaciones: [],
      } as never,
      {
        ...base,
        id: "b1",
        version: 1,
        texto: "nada que ver con lo otro",
        afirmaciones: [],
      } as never,
    ]);
    expect(r[0]!.similitudConVersionAnterior).toBe(1);
    expect(r[1]!.similitudConVersionAnterior).toBe(0);
    expect(r[2]!.similitudConVersionAnterior).toBeNull();
  });
});

describe("texto que entra en la base de datos", () => {
  it("limpiarTextoParaBd quita el NUL y cambia un sustituto suelto por U+FFFD", () => {
    expect(limpiarTextoParaBd("a\u0000b")).toBe("ab");
    expect(limpiarTextoParaBd("a\uD83Db")).toBe(`a${REEMPLAZO}b`);
    expect(limpiarTextoParaBd("a\uDE00b")).toBe(`a${REEMPLAZO}b`);
    // Un emoji entero no se toca.
    expect(limpiarTextoParaBd("hola 😀 ñ")).toBe("hola 😀 ñ");
  });

  it("limpiarJsonParaBd limpia cadenas y claves a cualquier profundidad y respeta fechas y números", () => {
    const fecha = new Date("2026-11-01T00:00:00Z");
    const r = limpiarJsonParaBd({
      "k\u0000": "v\u0000",
      lista: ["\uD83D", { dentro: "x\u0000" }],
      n: 3,
      f: fecha,
      nulo: null,
    });
    expect(r).toEqual({
      k: "v",
      lista: [`${REEMPLAZO}`, { dentro: "x" }],
      n: 3,
      f: fecha,
      nulo: null,
    });
    expect(r.f).toBe(fecha);
  });

  describe("recortarPorPuntosDeCodigo", () => {
    it("no parte un emoji que cae justo en el límite", () => {
      // 499 letras y un emoji (dos unidades UTF-16): con slice(0, 500) el
      // sustituto alto se quedaba solo al final.
      const texto = `${"a".repeat(499)}😀${"b".repeat(10)}`;
      const cortado = recortarPorPuntosDeCodigo(texto, 500);
      expect(Array.from(cortado)).toHaveLength(500);
      expect(cortado.endsWith("😀")).toBe(true);
      expect(/[\uD800-\uDFFF]/.test(cortado.replace(/😀/g, ""))).toBe(false);
      // El corte antiguo sí dejaba un sustituto suelto.
      expect(/\uD83D$/.test(texto.slice(0, 500))).toBe(true);
    });

    it("cada posición del emoji alrededor del límite (498 a 501) da un texto bien formado", () => {
      for (let relleno = 497; relleno <= 501; relleno++) {
        const texto = `${"a".repeat(relleno)}😀😀😀`;
        const cortado = recortarPorPuntosDeCodigo(texto, 500);
        expect(Array.from(cortado).length).toBeLessThanOrEqual(500);
        // Bien formado: al codificar en UTF-8 y volver no hay sustitutos.
        expect(Buffer.from(cortado, "utf8").toString("utf8")).toBe(cortado);
      }
    });

    it("un texto corto no se toca, y se limpia lo que traiga", () => {
      expect(recortarPorPuntosDeCodigo("hola", 500)).toBe("hola");
      expect(recortarPorPuntosDeCodigo("ho\u0000la", 500)).toBe("hola");
    });
  });

  describe("crearOportunidad", () => {
    const fuente = { id: "fuente_web", tipo: "web", activa: true };

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      mock.growthFuente.upsert.mockResolvedValue(fuente);
      mock.growthOportunidad.create.mockResolvedValue({
        id: "o1",
        estado: "detectada",
      });
    });

    const entrada = (cambios: Record<string, unknown>) =>
      ({
        url: "https://ejemplo.com/p",
        titulo: "Título",
        extracto: "Extracto",
        objetivoPrincipal: "BACKLINKS",
        ...cambios,
      }) as never;

    it("un extracto con un emoji entre las posiciones 499 y 500 se guarda bien formado", async () => {
      await crearOportunidad(
        entrada({ extracto: `${"a".repeat(499)}😀 y más texto` })
      );
      const guardado = mock.growthOportunidad.create.mock.calls[0]![0].data
        .extracto as string;
      expect(Array.from(guardado)).toHaveLength(500);
      expect(Buffer.from(guardado, "utf8").toString("utf8")).toBe(guardado);
    });

    it("un NUL o un sustituto suelto en el título, el extracto o datos no llegan a la base de datos", async () => {
      await crearOportunidad(
        entrada({
          titulo: "Tí\u0000tulo",
          extracto: "ex\uD83D",
          datos: { nota: "n\u0000" },
        })
      );
      const datos = mock.growthOportunidad.create.mock.calls[0]![0].data;
      expect(datos.titulo).toBe("Título");
      expect(datos.extracto).toBe(`ex${REEMPLAZO}`);
      expect(datos.datos).toEqual({ nota: "n" });
    });
  });

  it("el motivo de una decisión se corta por puntos de código, sin partir un emoji", async () => {
    mock.growthDecision.create.mockResolvedValue({});
    await registrarDecision(prismaMock as never, {
      accion: "x",
      motivo: `${"a".repeat(999)}😀😀`,
      por: "sistema",
    });
    const motivo = mock.growthDecision.create.mock.calls[0]![0].data
      .motivo as string;
    expect(Array.from(motivo)).toHaveLength(1000);
    expect(Buffer.from(motivo, "utf8").toString("utf8")).toBe(motivo);
  });
});

describe("cerrojos de aprobación", () => {
  it("las claves son las que usa el sincronizador de conocimiento", () => {
    expect(CERROJO_DE_CONOCIMIENTO).toBe(CLAVE_DEL_CERROJO_DE_CONOCIMIENTO);
    expect(CERROJO_DE_APROBACION).toBe("growth_aprobar");
  });

  it("con conocimiento: primero growth_aprobar exclusivo y después growth_conocimiento compartido", async () => {
    await adquirirCerrojosDeAprobacion(prismaMock as never, {
      conocimiento: true,
    });
    const llamadas = mock.$executeRaw.mock.calls.map((c) => ({
      sql: (c[0] as unknown as string[]).join("?"),
      clave: c[1],
    }));
    expect(llamadas).toEqual([
      {
        sql: "SELECT pg_advisory_xact_lock(hashtext(?))",
        clave: "growth_aprobar",
      },
      {
        sql: "SELECT pg_advisory_xact_lock_shared(hashtext(?))",
        clave: "growth_conocimiento",
      },
    ]);
  });

  it("sin opciones toma los dos (es lo que deben hacer aprobar, editar, crear, devolver, descartar y gestionar)", async () => {
    await adquirirCerrojosDeAprobacion(prismaMock as never);
    expect(mock.$executeRaw.mock.calls.map((c) => c[1])).toEqual([
      "growth_aprobar",
      "growth_conocimiento",
    ]);
  });

  it("con `conocimiento: false` solo toma growth_aprobar", async () => {
    await adquirirCerrojosDeAprobacion(prismaMock as never, {
      conocimiento: false,
    });
    expect(mock.$executeRaw).toHaveBeenCalledOnce();
    expect(mock.$executeRaw.mock.calls[0]![1]).toBe("growth_aprobar");
  });
});

describe("búsqueda por texto en el listado", () => {
  it("escaparComodinesDeLike protege %, _ y la barra invertida", () => {
    expect(escaparComodinesDeLike("50%")).toBe("50\\%");
    expect(escaparComodinesDeLike("a_b")).toBe("a\\_b");
    expect(escaparComodinesDeLike("c:\\dir")).toBe("c:\\\\dir");
    expect(escaparComodinesDeLike("sin nada")).toBe("sin nada");
  });

  it("la q llega a la consulta escapada y sin NUL", async () => {
    mock.growthOportunidad.groupBy.mockResolvedValue([]);
    mock.growthOportunidad.findMany.mockResolvedValue([]);
    mock.growthOportunidad.count.mockResolvedValue(0);
    await listarOportunidades({
      pagina: 1,
      limite: 20,
      orden: "recientes",
      q: "50%\u0000_x",
    } as never);
    const donde = mock.growthOportunidad.findMany.mock.calls[0]![0].where;
    expect(donde.OR).toEqual([
      { titulo: { contains: "50\\%\\_x", mode: "insensitive" } },
      { dominio: { contains: "50\\%\\_x", mode: "insensitive" } },
      { url: { contains: "50\\%\\_x", mode: "insensitive" } },
    ]);
  });
});

describe("errorDeAgenda", () => {
  const evaluacion = (
    agenda: Partial<{
      gestionesDelDominio: Date[];
      aprobadasDelDominio: number;
      total: number;
    }> = {},
    tope = 5
  ) => ({
    agenda: {
      gestionesDelDominio: agenda.gestionesDelDominio ?? [],
      aprobadasDelDominio: agenda.aprobadasDelDominio ?? 0,
      contactos: {
        hechas: 0,
        aprobadasSinGestionar: 0,
        total: agenda.total ?? 0,
      },
    },
    ajustes: { topeSemanal: tope } as never,
  });

  it("sin nada en la agenda no hay error", () => {
    expect(errorDeAgenda(evaluacion())).toBeNull();
    expect(errorDeAgenda(evaluacion({ total: 4 }))).toBeNull();
  });

  it("dominio en enfriamiento: 90 días desde la ÚLTIMA gestión, con `hasta`", () => {
    const ultima = hace(10);
    const e = errorDeAgenda(
      evaluacion({ gestionesDelDominio: [hace(40), ultima, hace(70)] })
    )!;
    expect(e).toBeInstanceOf(ErrorDeGrowth);
    expect(e.status).toBe(409);
    expect(e.codigo).toBe("dominio_en_enfriamiento");
    expect(e.extra).toEqual({
      hasta: new Date(ultima.getTime() + 90 * 86_400_000).toISOString(),
    });
  });

  it("otra aprobada del dominio, y después el tope, cada una con su código", () => {
    expect(errorDeAgenda(evaluacion({ aprobadasDelDominio: 1 }))?.codigo).toBe(
      "dominio_ya_aprobado"
    );
    expect(errorDeAgenda(evaluacion({ total: 5 }))?.codigo).toBe(
      "tope_semanal"
    );
    expect(errorDeAgenda(evaluacion({ total: 2 }, 2))?.codigo).toBe(
      "tope_semanal"
    );
  });

  it("si fallan varias, manda el enfriamiento, luego el dominio y luego el tope", () => {
    expect(
      errorDeAgenda(
        evaluacion({
          gestionesDelDominio: [hace(1)],
          aprobadasDelDominio: 1,
          total: 9,
        })
      )?.codigo
    ).toBe("dominio_en_enfriamiento");
    expect(
      errorDeAgenda(evaluacion({ aprobadasDelDominio: 1, total: 9 }))?.codigo
    ).toBe("dominio_ya_aprobado");
  });
});
