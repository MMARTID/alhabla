import { describe, it, expect } from "vitest";
import {
  AbrirEjecucionBody,
  AjustesPutBody,
  BorradorBody,
  CerrarEjecucionBody,
  DatosDeOportunidad,
  DecisionBody,
  EstadoBody,
  InvestigacionBody,
  ListadoDeOportunidadesQuery,
  OportunidadBody,
  OportunidadManualBody,
  PatchBorradorBody,
  Paginacion,
  RevisionLlmBody,
  SincronizarBody,
  booleanoDeConsulta,
  dominioNormalizado,
  tiposCubiertosPorLaSincronizacion,
  urlHttp,
} from "../../../src/modules/growth/esquemas.js";

function mensajes(r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return r.success ? [] : r.error!.issues.map((i) => i.message);
}

describe("urlHttp", () => {
  it("acepta http y https", () => {
    expect(urlHttp.safeParse("https://ejemplo.com/a?b=c#d").success).toBe(true);
    expect(urlHttp.safeParse("http://ejemplo.com").success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    "data:text/html,x",
    "data:text/html;base64,PHNjcmlwdD4=",
    "file:///etc/passwd",
    "ftp://ejemplo.com/x",
    "vbscript:msgbox(1)",
    "blob:https://ejemplo.com/uuid",
    "mailto:alguien@ejemplo.com",
    "//ejemplo.com/sin-esquema",
    "ejemplo.com",
    "",
  ])("rechaza %s", (url) => {
    expect(urlHttp.safeParse(url).success).toBe(false);
  });

  it("rechaza una URL con usuario o contraseña (https://alhabla.ai@sitio-malo.com)", () => {
    expect(
      urlHttp.safeParse("https://alhabla.ai@sitio-malo.com/x").success
    ).toBe(false);
    expect(urlHttp.safeParse("https://u:p@ejemplo.com").success).toBe(false);
  });

  it("rechaza más de 2.000 caracteres", () => {
    expect(
      urlHttp.safeParse(`https://ejemplo.com/${"a".repeat(2000)}`).success
    ).toBe(false);
  });

  it("se aplica en TODAS las URL que entran", () => {
    const malo = "javascript:alert(1)";
    const base = {
      url: "https://ejemplo.com/p",
      titulo: "t",
      extracto: "e",
      objetivoPrincipal: "BACKLINKS",
    };
    expect(OportunidadBody.safeParse({ ...base, url: malo }).success).toBe(
      false
    );
    expect(OportunidadManualBody.safeParse({ url: malo }).success).toBe(false);
    expect(
      BorradorBody.safeParse({ tipo: "email", texto: "x", enlaceUrl: malo })
        .success
    ).toBe(false);
    expect(PatchBorradorBody.safeParse({ enlaceUrl: malo }).success).toBe(
      false
    );
    expect(
      InvestigacionBody.safeParse({ resumen: "x", urlContacto: malo }).success
    ).toBe(false);
    expect(
      DecisionBody.safeParse({ accion: "conseguido", urlConseguida: malo })
        .success
    ).toBe(false);
  });
});

describe("OportunidadBody", () => {
  const base = {
    url: "https://ejemplo.com/p",
    titulo: " Las mejores ",
    extracto: "Un extracto",
    objetivoPrincipal: "BACKLINKS",
  };

  it("lo mínimo basta: la fuente se resuelve en el servidor", () => {
    const r = OportunidadBody.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.titulo).toBe("Las mejores");
  });

  it("no admite fuenteId y fuenteTipo a la vez, ni nichoId y nichoSlug", () => {
    expect(
      mensajes(
        OportunidadBody.safeParse({ ...base, fuenteId: "f", fuenteTipo: "web" })
      )
    ).toContain("Indica fuenteId o fuenteTipo, no los dos.");
    expect(
      OportunidadBody.safeParse({
        ...base,
        nichoId: "n",
        nichoSlug: "peluqueria",
      }).success
    ).toBe(false);
  });

  it("la fuente manual no se pide desde el agente", () => {
    expect(
      OportunidadBody.safeParse({ ...base, fuenteTipo: "manual" }).success
    ).toBe(false);
  });

  it("datos solo admite los campos conocidos (.strict)", () => {
    expect(
      OportunidadBody.safeParse({ ...base, datos: { tipoDestino: "prensa" } })
        .success
    ).toBe(true);
    expect(
      OportunidadBody.safeParse({ ...base, datos: { codigoDescarte: "otro" } })
        .success
    ).toBe(false);
    expect(
      OportunidadBody.safeParse({ ...base, datos: { cualquierCosa: "x" } })
        .success
    ).toBe(false);
  });

  it("puntuaciones enteras de 0 a 100 y caducidad futura", () => {
    expect(OportunidadBody.safeParse({ ...base, puntLeads: 101 }).success).toBe(
      false
    );
    expect(
      OportunidadBody.safeParse({ ...base, puntLeads: 50.5 }).success
    ).toBe(false);
    expect(
      OportunidadBody.safeParse({ ...base, expiraEn: "2020-01-01T00:00:00Z" })
        .success
    ).toBe(false);
    expect(
      OportunidadBody.safeParse({ ...base, expiraEn: "2999-01-01T00:00:00Z" })
        .success
    ).toBe(true);
  });
});

describe("DatosDeOportunidad", () => {
  it("la nota tiene un tope de 500 caracteres", () => {
    expect(
      DatosDeOportunidad.safeParse({ nota: "a".repeat(500) }).success
    ).toBe(true);
    expect(
      DatosDeOportunidad.safeParse({ nota: "a".repeat(501) }).success
    ).toBe(false);
  });
});

describe("OportunidadManualBody", () => {
  it("el objetivo por defecto es BACKLINKS", () => {
    const r = OportunidadManualBody.parse({ url: "https://ejemplo.com" });
    expect(r.objetivoPrincipal).toBe("BACKLINKS");
  });

  it("es estricto: no se cuelan puntuaciones ni estados", () => {
    expect(
      OportunidadManualBody.safeParse({
        url: "https://ejemplo.com",
        estado: "aprobada",
      }).success
    ).toBe(false);
  });
});

describe("EstadoBody", () => {
  it("el agente no puede pedir `aprobada` ni ningún otro estado suyo", () => {
    for (const a of [
      "aprobada",
      "gestionada",
      "pendiente_aprobacion",
      "caducada",
    ]) {
      expect(EstadoBody.safeParse({ a }).success).toBe(false);
    }
  });

  it("descartar exige motivo", () => {
    expect(EstadoBody.safeParse({ a: "descartada" }).success).toBe(false);
    expect(
      EstadoBody.safeParse({ a: "descartada", motivo: "No viva" }).success
    ).toBe(true);
  });

  it("el código de descarte solo se admite al descartar", () => {
    expect(
      EstadoBody.safeParse({ a: "calificada", codigo: "otro" }).success
    ).toBe(false);
    expect(
      EstadoBody.safeParse({ a: "descartada", motivo: "x", codigo: "no_viva" })
        .success
    ).toBe(true);
    expect(
      EstadoBody.safeParse({
        a: "descartada",
        motivo: "x",
        codigo: "inventado",
      }).success
    ).toBe(false);
  });

  it("las puntuaciones y los datos no se mezclan con descartar", () => {
    expect(
      EstadoBody.safeParse({ a: "descartada", motivo: "x", puntLeads: 10 })
        .success
    ).toBe(false);
  });

  it("calificar admite las puntuaciones, el nicho y los datos", () => {
    const r = EstadoBody.safeParse({
      a: "calificada",
      objetivoPrincipal: "LEADS",
      puntTrafico: 10,
      puntLeads: 80,
      puntBacklinks: 20,
      nichoSlug: "peluqueria",
      datos: { dificultad: "baja" },
    });
    expect(r.success).toBe(true);
  });
});

describe("InvestigacionBody", () => {
  it("guarda la URL de contacto, no correos", () => {
    expect(
      InvestigacionBody.safeParse({
        resumen: "Medio digital del sector.",
        urlContacto: "https://ejemplo.com/contacto",
      }).success
    ).toBe(true);
  });

  it("rechaza correos en el resumen, en quién edita y en el contexto", () => {
    expect(
      InvestigacionBody.safeParse({ resumen: "Escribid a ana@ejemplo.es" })
        .success
    ).toBe(false);
    expect(
      InvestigacionBody.safeParse({
        resumen: "ok",
        quienEdita: "redaccion@ejemplo.es",
      }).success
    ).toBe(false);
    expect(
      InvestigacionBody.safeParse({
        resumen: "ok",
        contexto: { anidado: { lista: ["x", "info@ejemplo.es"] } },
      }).success
    ).toBe(false);
  });

  it("rechaza teléfonos, pero no una fecha", () => {
    expect(
      InvestigacionBody.safeParse({ resumen: "Su teléfono es 612 345 678" })
        .success
    ).toBe(false);
    expect(
      InvestigacionBody.safeParse({
        resumen: "Actualizado el 2026-10-30 12:00, con 10.000 visitas al mes.",
      }).success
    ).toBe(true);
  });

  it("urlContacto no se cuela por el contexto (se saltaría la validación)", () => {
    const r = InvestigacionBody.safeParse({
      resumen: "ok",
      contexto: { urlContacto: "javascript:alert(1)" },
    });
    expect(r.success).toBe(false);
    expect(mensajes(r)[0]).toContain("urlContacto");
  });

  it("el contexto no pasa de 8 KB", () => {
    expect(
      InvestigacionBody.safeParse({
        resumen: "ok",
        contexto: { grande: "a".repeat(9000) },
      }).success
    ).toBe(false);
  });
});

describe("BorradorBody", () => {
  it("quita las claves repetidas", () => {
    const r = BorradorBody.parse({
      tipo: "email",
      texto: "Hola",
      afirmaciones: ["a.b", "a.b", "c.d"],
    });
    expect(r.afirmaciones).toEqual(["a.b", "c.d"]);
  });

  it("sin afirmaciones es una lista vacía", () => {
    expect(
      BorradorBody.parse({ tipo: "email", texto: "Hola" }).afirmaciones
    ).toEqual([]);
  });
});

describe("PatchBorradorBody", () => {
  it("exige al menos un campo que cambiar", () => {
    expect(PatchBorradorBody.safeParse({}).success).toBe(false);
    expect(PatchBorradorBody.safeParse({ nota: "solo una nota" }).success).toBe(
      false
    );
    expect(PatchBorradorBody.safeParse({ texto: "Nuevo" }).success).toBe(true);
  });

  it("no acepta estado, tipo, textoFinal ni nada que no sea editable", () => {
    for (const campo of [
      { estado: "aprobado" },
      { tipo: "email" },
      { version: 3 },
      { textoFinal: "x" },
      { editadoPorHumano: true },
      { utm: {} },
    ]) {
      expect(
        PatchBorradorBody.safeParse({ texto: "x", ...campo }).success
      ).toBe(false);
    }
  });

  it("asunto y enlace pueden quitarse con null", () => {
    expect(
      PatchBorradorBody.safeParse({ asunto: null, enlaceUrl: null }).success
    ).toBe(true);
  });
});

describe("RevisionLlmBody", () => {
  const comprobacion = {
    regla: "tono_cercano",
    ok: true,
    detalle: "Suena bien.",
  };

  it("acepta comprobaciones propias del modelo", () => {
    expect(
      RevisionLlmBody.safeParse({ comprobaciones: [comprobacion] }).success
    ).toBe(true);
    expect(
      RevisionLlmBody.safeParse({
        resultado: "aviso",
        comprobaciones: [{ ...comprobacion, ok: false }],
      }).success
    ).toBe(true);
  });

  it("no puede declarar `bloquea`: solo pasa o aviso", () => {
    expect(
      RevisionLlmBody.safeParse({
        resultado: "bloquea",
        comprobaciones: [comprobacion],
      }).success
    ).toBe(false);
  });

  it("no puede firmar con el nombre de una regla del motor", () => {
    for (const regla of [
      "afirmaciones_vigentes",
      "Sin_Terminos_Prohibidos",
      "tope_semanal",
      "similitud_con_version_anterior",
    ]) {
      expect(
        RevisionLlmBody.safeParse({
          comprobaciones: [{ ...comprobacion, regla }],
        }).success
      ).toBe(false);
    }
  });

  it("no admite el campo `dura` ni otros ajenos (.strict)", () => {
    expect(
      RevisionLlmBody.safeParse({
        comprobaciones: [{ ...comprobacion, dura: true }],
      }).success
    ).toBe(false);
  });

  it("límites: de 1 a 30 comprobaciones, regla ≤ 60 y detalle ≤ 300", () => {
    expect(RevisionLlmBody.safeParse({ comprobaciones: [] }).success).toBe(
      false
    );
    expect(
      RevisionLlmBody.safeParse({
        comprobaciones: Array.from({ length: 31 }, () => comprobacion),
      }).success
    ).toBe(false);
    expect(
      RevisionLlmBody.safeParse({
        comprobaciones: Array.from({ length: 30 }, () => comprobacion),
      }).success
    ).toBe(true);
    expect(
      RevisionLlmBody.safeParse({
        comprobaciones: [{ ...comprobacion, regla: "a".repeat(61) }],
      }).success
    ).toBe(false);
    expect(
      RevisionLlmBody.safeParse({
        comprobaciones: [{ ...comprobacion, detalle: "a".repeat(301) }],
      }).success
    ).toBe(false);
  });
});

describe("ejecuciones", () => {
  it("abrir: el disparador es obligatorio y versionPrompts un sha de git", () => {
    expect(AbrirEjecucionBody.safeParse({}).success).toBe(false);
    expect(
      AbrirEjecucionBody.safeParse({
        disparador: "programada",
        versionPrompts: "abc1234",
      }).success
    ).toBe(true);
    expect(
      AbrirEjecucionBody.safeParse({
        disparador: "manual",
        versionPrompts: "no es un sha",
      }).success
    ).toBe(false);
    expect(
      AbrirEjecucionBody.safeParse({ disparador: "manual", extra: 1 }).success
    ).toBe(false);
  });

  it("cerrar con error exige explicarlo", () => {
    expect(CerrarEjecucionBody.safeParse({ estado: "error" }).success).toBe(
      false
    );
    expect(
      CerrarEjecucionBody.safeParse({
        estado: "error",
        error: "Falló el módulo 3",
      }).success
    ).toBe(true);
    expect(CerrarEjecucionBody.safeParse({ estado: "ok" }).success).toBe(true);
  });

  it("cerrar no admite estados que no son de cierre", () => {
    expect(CerrarEjecucionBody.safeParse({ estado: "en_curso" }).success).toBe(
      false
    );
  });

  it("los módulos no pasan de 8 KB serializados y el error de 1.000 caracteres", () => {
    const modulos = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [
        `modulo_${i}`,
        { estado: "ok", notas: "n".repeat(300) },
      ])
    );
    expect(
      CerrarEjecucionBody.safeParse({ estado: "ok", modulos }).success
    ).toBe(false);
    expect(
      CerrarEjecucionBody.safeParse({
        estado: "error",
        error: "e".repeat(1001),
      }).success
    ).toBe(false);
  });

  it("el resumen es estricto y descartesPorMotivo usa los códigos válidos", () => {
    expect(
      CerrarEjecucionBody.safeParse({
        estado: "ok",
        resumen: { descartesPorMotivo: { no_viva: 3, bajo_umbral: 2 } },
      }).success
    ).toBe(true);
    expect(
      CerrarEjecucionBody.safeParse({
        estado: "ok",
        resumen: { descartesPorMotivo: { inventado: 3 } },
      }).success
    ).toBe(false);
    expect(
      CerrarEjecucionBody.safeParse({ estado: "ok", resumen: { otraCosa: 1 } })
        .success
    ).toBe(false);
  });
});

describe("SincronizarBody", () => {
  const precio = {
    clave: "precio.plan.pro",
    tipo: "precio",
    texto: "El plan Pro cuesta 139 € al mes.",
    valor: { eurosAlMes: 139 },
    fuente: "web/src/lib/plans.ts#pro",
  };
  const prohibida = {
    clave: "prohibida.proveedor",
    tipo: "prohibida",
    texto: "No se nombra al proveedor.",
    valor: { terminos: ["Telnyx"], palabrasEnteras: true },
    fuente: "PRODUCT.md#nunca",
  };
  const comparativa = {
    clave: "comparativa.heydiga.precio",
    tipo: "comparativa",
    texto: "HeyDiga cobra X (consultado el 29-10-2026).",
    valor: { competidorDominio: "www.HeyDiga.ai", dato: "X" },
    fuente: "web/src/lib/comparativas.ts#heydiga",
  };
  const base = { commitSha: "abc1234", afirmaciones: [precio, prohibida] };

  it("acepta una sincronización normal", () => {
    expect(SincronizarBody.safeParse(base).success).toBe(true);
  });

  it("el prefijo de la clave tiene que ser el tipo", () => {
    expect(
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...precio, clave: "funcion.plan.pro" }],
      }).success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...precio, tipo: "funcion" }],
      }).success
    ).toBe(false);
  });

  it("una clave con mayúsculas, espacios o sin punto no vale", () => {
    for (const clave of [
      "precio.Plan.Pro",
      "precio.plan pro",
      "precio",
      "precio.",
    ]) {
      expect(
        SincronizarBody.safeParse({
          ...base,
          afirmaciones: [{ ...precio, clave }],
        }).success
      ).toBe(false);
    }
  });

  it("una prohibida exige valor.terminos de 3+ caracteres y palabrasEnteras", () => {
    const con = (valor: unknown) =>
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...prohibida, valor }],
      }).success;
    expect(con(undefined)).toBe(false);
    expect(con({ terminos: ["Telnyx"] })).toBe(false);
    expect(con({ palabrasEnteras: true })).toBe(false);
    expect(con({ terminos: [], palabrasEnteras: true })).toBe(false);
    expect(con({ terminos: ["IA"], palabrasEnteras: true })).toBe(false);
    expect(con({ terminos: ["  IA  "], palabrasEnteras: true })).toBe(false);
    expect(con({ terminos: ["Telnyx"], palabrasEnteras: "sí" })).toBe(false);
    expect(con({ terminos: [1], palabrasEnteras: true })).toBe(false);
    expect(
      con({
        terminos: Array.from({ length: 51 }, () => "Telnyx"),
        palabrasEnteras: true,
      })
    ).toBe(false);
    expect(con({ terminos: ["Telnyx", "API"], palabrasEnteras: false })).toBe(
      true
    );
  });

  it("una comparativa exige el dominio del competidor", () => {
    const con = (valor: unknown) =>
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...comparativa, valor }],
      }).success;
    expect(con(undefined)).toBe(false);
    expect(con({ dato: "X" })).toBe(false);
    expect(con({ competidorDominio: "no es un dominio" })).toBe(false);
    expect(con({ competidorDominio: "heydiga.ai" })).toBe(true);
  });

  it("claves repetidas y tipos fuera de los cubiertos se rechazan", () => {
    expect(
      mensajes(
        SincronizarBody.safeParse({ ...base, afirmaciones: [precio, precio] })
      ).join(" ")
    ).toContain("repetida");
    expect(
      SincronizarBody.safeParse({ ...base, tipos: ["precio"] }).success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({ ...base, tipos: ["precio", "prohibida"] })
        .success
    ).toBe(true);
  });

  it("sin afirmaciones ni tipos no hay nada que sincronizar; con tipos sí (cierra todo)", () => {
    expect(
      SincronizarBody.safeParse({ commitSha: "abc1234", afirmaciones: [] })
        .success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({
        commitSha: "abc1234",
        afirmaciones: [],
        tipos: ["prohibida"],
      }).success
    ).toBe(true);
  });

  it("commitSha tiene que ser un sha de git", () => {
    for (const commitSha of ["HEAD", "zzzzzzz", "abc12", "A".repeat(40)]) {
      expect(SincronizarBody.safeParse({ ...base, commitSha }).success).toBe(
        false
      );
    }
    expect(
      SincronizarBody.safeParse({ ...base, commitSha: "a".repeat(40) }).success
    ).toBe(true);
  });

  it("límites de tamaño: 1.000 afirmaciones, valor de 4 KB, texto de 2.000", () => {
    expect(
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...precio, valor: { grande: "x".repeat(5000) } }],
      }).success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({
        ...base,
        afirmaciones: [{ ...precio, texto: "x".repeat(2001) }],
      }).success
    ).toBe(false);
    const muchas = Array.from({ length: 1001 }, (_, i) => ({
      ...precio,
      clave: `precio.n${i}`,
    }));
    expect(
      SincronizarBody.safeParse({ ...base, afirmaciones: muchas }).success
    ).toBe(false);
  });

  it("la fuente no admite rutas raras ni espacios", () => {
    for (const fuente of [
      "con espacios",
      "../../etc/passwd; rm",
      "a".repeat(301),
    ]) {
      expect(
        SincronizarBody.safeParse({
          ...base,
          afirmaciones: [{ ...precio, fuente }],
        }).success
      ).toBe(false);
    }
  });

  it("competidores, nichos y páginas se validan y no se repiten", () => {
    const r = SincronizarBody.safeParse({
      ...base,
      competidores: [{ nombre: "HeyDiga", dominio: "https://heydiga.ai" }],
    });
    expect(r.success).toBe(false);
    const ok = SincronizarBody.parse({
      ...base,
      competidores: [{ nombre: "HeyDiga", dominio: "WWW.HeyDiga.ai" }],
      nichos: [{ slug: "peluqueria", nombre: "Peluquería" }],
      paginas: [
        { ruta: "/peluqueria", nombre: "Peluquería", seccion: "sectores" },
      ],
    });
    expect(ok.competidores?.[0]?.dominio).toBe("heydiga.ai");
    expect(
      SincronizarBody.safeParse({
        ...base,
        nichos: [
          { slug: "peluqueria", nombre: "A" },
          { slug: "peluqueria", nombre: "B" },
        ],
      }).success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({
        ...base,
        paginas: [{ ruta: "/a?x=1", nombre: "A", seccion: "s" }],
      }).success
    ).toBe(false);
    expect(
      SincronizarBody.safeParse({
        ...base,
        nichos: [{ slug: "Con Mayúsculas", nombre: "A" }],
      }).success
    ).toBe(false);
  });

  it("no admite campos ajenos (.strict)", () => {
    expect(SincronizarBody.safeParse({ ...base, forzar: true }).success).toBe(
      false
    );
  });

  it("los tipos cubiertos son los indicados o, si faltan, los que aparecen", () => {
    expect(
      tiposCubiertosPorLaSincronizacion({
        afirmaciones: [
          { tipo: "precio" },
          { tipo: "precio" },
          { tipo: "limite" },
        ],
      }).sort()
    ).toEqual(["limite", "precio"]);
    expect(
      tiposCubiertosPorLaSincronizacion({
        tipos: ["sector"],
        afirmaciones: [{ tipo: "precio" }],
      })
    ).toEqual(["sector"]);
  });
});

describe("DecisionBody", () => {
  it("aprobar necesita el borrador", () => {
    expect(DecisionBody.safeParse({ accion: "aprobar" }).success).toBe(false);
    expect(
      DecisionBody.safeParse({ accion: "aprobar", borradorId: "b1" }).success
    ).toBe(true);
  });

  it("devolver y descartar exigen un motivo; descartar admite código", () => {
    expect(DecisionBody.safeParse({ accion: "devolver" }).success).toBe(false);
    expect(DecisionBody.safeParse({ accion: "descartar" }).success).toBe(false);
    expect(
      DecisionBody.safeParse({
        accion: "descartar",
        motivo: "x",
        codigo: "competidor",
      }).success
    ).toBe(true);
    expect(
      DecisionBody.safeParse({
        accion: "descartar",
        motivo: "x",
        codigo: "otra",
      }).success
    ).toBe(false);
  });

  it("existe la acción `rechazado` y una acción desconocida se rechaza", () => {
    expect(DecisionBody.safeParse({ accion: "rechazado" }).success).toBe(true);
    expect(DecisionBody.safeParse({ accion: "borrar_todo" }).success).toBe(
      false
    );
  });

  describe("hechaEn de marcar_gestionado", () => {
    const con = (hechaEn: Date | string) =>
      DecisionBody.safeParse({
        accion: "marcar_gestionado",
        canal: "email",
        hechaEn,
      }).success;

    it("admite ahora, ayer y hace 29 días", () => {
      expect(con(new Date())).toBe(true);
      expect(con(new Date(Date.now() - 24 * 3600 * 1000))).toBe(true);
      expect(con(new Date(Date.now() - 29 * 24 * 3600 * 1000))).toBe(true);
    });

    it("rechaza el futuro (con un margen de unos minutos por el reloj del móvil)", () => {
      expect(con(new Date(Date.now() + 2 * 60 * 1000))).toBe(true);
      expect(con(new Date(Date.now() + 10 * 60 * 1000))).toBe(false);
      expect(con(new Date(Date.now() + 24 * 3600 * 1000))).toBe(false);
    });

    it("rechaza hace más de 30 días (una errata saltaría la regla de los 90)", () => {
      expect(con(new Date(Date.now() - 31 * 24 * 3600 * 1000))).toBe(false);
      expect(con("1999-01-01")).toBe(false);
    });

    it("rechaza una fecha que no lo es", () => {
      expect(con("no es una fecha")).toBe(false);
    });
  });

  it("textoFinal y canal: el canal tiene que ser uno conocido", () => {
    expect(
      DecisionBody.safeParse({
        accion: "marcar_gestionado",
        canal: "paloma_mensajera",
      }).success
    ).toBe(false);
    expect(
      DecisionBody.safeParse({
        accion: "marcar_gestionado",
        canal: "formulario",
        textoFinal: "Lo que envié",
      }).success
    ).toBe(true);
  });
});

describe("AjustesPutBody", () => {
  it("valida los rangos", () => {
    expect(AjustesPutBody.safeParse({ topeSemanal: 0 }).success).toBe(true);
    expect(AjustesPutBody.safeParse({ topeSemanal: 20 }).success).toBe(true);
    expect(AjustesPutBody.safeParse({ topeSemanal: 21 }).success).toBe(false);
    expect(AjustesPutBody.safeParse({ topeSemanal: -1 }).success).toBe(false);
    expect(AjustesPutBody.safeParse({ topeSemanal: 2.5 }).success).toBe(false);
    expect(AjustesPutBody.safeParse({ umbralDeSimilitud: 0.4 }).success).toBe(
      true
    );
    expect(AjustesPutBody.safeParse({ umbralDeSimilitud: 0.9 }).success).toBe(
      true
    );
    // 1.0 desactivaría la regla de plantilla repetida; < 0.4 pisaría el aviso.
    expect(AjustesPutBody.safeParse({ umbralDeSimilitud: 1 }).success).toBe(
      false
    );
    expect(AjustesPutBody.safeParse({ umbralDeSimilitud: 0.3 }).success).toBe(
      false
    );
  });

  it("los umbrales por objetivo van los tres a la vez", () => {
    expect(
      AjustesPutBody.safeParse({
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60 },
      }).success
    ).toBe(false);
    expect(
      AjustesPutBody.safeParse({
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 101 },
      }).success
    ).toBe(false);
    expect(
      AjustesPutBody.safeParse({
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 50, BACKLINKS: 40 },
      }).success
    ).toBe(true);
  });

  it("las claves `sistema.*` no se editan y lo desconocido se rechaza", () => {
    const r = AjustesPutBody.safeParse({
      pausa: true,
      "sistema.conocimiento": { commitSha: "abc1234" },
    });
    expect(r.success).toBe(false);
    expect(mensajes(r).join(" ")).toContain("del sistema");
    expect(AjustesPutBody.safeParse({ pausa: true, otra: 1 }).success).toBe(
      false
    );
  });

  it("exige al menos un ajuste y devuelve solo los conocidos", () => {
    expect(AjustesPutBody.safeParse({}).success).toBe(false);
    expect(AjustesPutBody.parse({ pausa: false })).toEqual({
      topeSemanal: undefined,
      umbralDeSimilitud: undefined,
      umbralesPorObjetivo: undefined,
      pausa: false,
    });
  });
});

describe("consultas", () => {
  it("la paginación tiene valores por defecto y límites", () => {
    expect(Paginacion.parse({})).toEqual({ pagina: 1, limite: 50 });
    expect(Paginacion.parse({ pagina: "3", limite: "200" })).toEqual({
      pagina: 3,
      limite: 200,
    });
    for (const q of [
      { pagina: "0" },
      { limite: "0" },
      { limite: "201" },
      { pagina: "x" },
    ]) {
      expect(Paginacion.safeParse(q).success).toBe(false);
    }
  });

  it("estado admite una lista separada por comas, repeticiones y solo valores válidos", () => {
    const r = ListadoDeOportunidadesQuery.parse({
      estado: "calificada, bloqueada,calificada",
    });
    expect(r.estado).toEqual(["calificada", "bloqueada"]);
    expect(
      ListadoDeOportunidadesQuery.parse({ estado: ["aprobada", "devuelta"] })
        .estado
    ).toEqual(["aprobada", "devuelta"]);
    expect(
      ListadoDeOportunidadesQuery.parse({ estado: "aprobada" }).estado
    ).toEqual(["aprobada"]);
    expect(
      ListadoDeOportunidadesQuery.safeParse({ estado: "aprobada,inventado" })
        .success
    ).toBe(false);
    expect(ListadoDeOportunidadesQuery.safeParse({ estado: "" }).success).toBe(
      false
    );
  });

  it("orden por defecto `recientes` y solo tres opciones", () => {
    expect(ListadoDeOportunidadesQuery.parse({}).orden).toBe("recientes");
    expect(
      ListadoDeOportunidadesQuery.safeParse({ orden: "aleatorio" }).success
    ).toBe(false);
  });

  it("un booleano de consulta no confunde «false» con verdadero", () => {
    expect(booleanoDeConsulta.parse("false")).toBe(false);
    expect(booleanoDeConsulta.parse("0")).toBe(false);
    expect(booleanoDeConsulta.parse("true")).toBe(true);
    expect(booleanoDeConsulta.parse("1")).toBe(true);
    expect(booleanoDeConsulta.safeParse("yes").success).toBe(false);
  });

  it("dominio normalizado: minúsculas, sin www, sin esquema", () => {
    expect(dominioNormalizado.parse(" WWW.Ejemplo.COM ")).toBe("ejemplo.com");
    expect(dominioNormalizado.safeParse("https://ejemplo.com").success).toBe(
      false
    );
    expect(dominioNormalizado.safeParse("ejemplo.com/ruta").success).toBe(
      false
    );
    expect(dominioNormalizado.safeParse("localhost").success).toBe(false);
  });
});
