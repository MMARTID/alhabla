import { describe, it, expect } from "vitest";
import {
  buildManagedAgentPrompt,
  DEFAULT_AGENT_SETTINGS,
  parseAgentSettings,
} from "../../src/lib/managedAgentPrompt.js";
import {
  contextoDelCliente,
  MAX_CARACTERES_DE_INFORMACION_EN_EL_PROMPT,
  reglasDelChat,
  VARIABLE_DEL_CONTEXTO_DEL_CLIENTE,
} from "../../src/lib/seccionesDelPrompt.js";
import { buildTelnyxAssistantPayload } from "../../src/lib/telnyxAssistantPayload.js";
import { resolverIdiomas } from "../../src/lib/idiomas/resolver.js";
import { idiomasQueHabla } from "../../src/lib/idiomas/catalogo.js";

/**
 * El prompt compacto (v2, F2 de PLAN-PROMPT-DINAMICO.md). El censo de reglas
 * (reglasDelPrompt.test.ts) ya exige que cada regla tenga sitio en v2; aquí
 * va lo que cambia de forma: qué secciones salen, la variable del cliente
 * conocido, las reglas del chat fuera del prompt y el payload.
 */

const V2 = { ...DEFAULT_AGENT_SETTINGS, versionDelPrompt: "v2" as const };

const ENTRADA = {
  businessName: "El petit saló",
  businessType: "peluqueria" as const,
  businessDetails: "Aceptamos tarjeta y Bizum.",
  timezone: "Europe/Madrid",
  settings: V2,
};

function titulos(prompt: string): string[] {
  return prompt
    .split("\n\n")
    .filter((bloque) => bloque.startsWith("## "))
    .map((bloque) => bloque.split("\n", 1)[0]!);
}

describe("prompt v2", () => {
  const prompt = buildManagedAgentPrompt(ENTRADA);

  it("parseAgentSettings acepta «v2»", () => {
    expect(parseAgentSettings(V2).versionDelPrompt).toBe("v2");
  });

  it("deja fuera lo que ya dicen las respuestas de las tools y el chat", () => {
    const secciones = titulos(prompt);
    for (const fuera of [
      "## Precios",
      "## Profesionales",
      "## Límites",
      "## Uso de herramientas",
      "## Cita existente",
      "## Cliente",
      "## Información del negocio",
    ]) {
      expect(secciones, fuera).not.toContain(fuera);
    }
    expect(secciones).toEqual([
      "## Rol",
      "## Conversación",
      "## Lo que ofrece el negocio",
      "## Este negocio",
      "## Reserva",
      "## Herramientas",
      "## Grabación",
      "## Recados",
      "## Cierre",
      "## Al terminar la llamada",
      "## Chat por WhatsApp",
      "## Referencia temporal",
      "## Idioma",
    ]);
  });

  it("cabe muy por debajo de v1", () => {
    const v1 = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: DEFAULT_AGENT_SETTINGS,
    });
    expect(prompt.length).toBeLessThan(v1.length * 0.7);
  });

  // Laboratorio del 31-10: con el cierre y el informe reescritos, al
  // despedirse en el chat seguía llamando a tools; vuelven los de v1.
  it("el cierre y el informe son los de v1", () => {
    const v1 = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: DEFAULT_AGENT_SETTINGS,
    });
    const bloque = (texto: string, titulo: string) => {
      const desde = texto.indexOf(titulo);
      return texto.slice(desde, texto.indexOf("\n\n## ", desde));
    };
    for (const titulo of ["## Cierre", "## Al terminar la llamada"]) {
      expect(bloque(prompt, titulo), titulo).toBe(bloque(v1, titulo));
    }
  });

  it("el chat, solo el gancho: las reglas llegan en el primer mensaje", () => {
    const desde = prompt.indexOf("## Chat por WhatsApp");
    const chat = prompt.slice(desde, prompt.indexOf("\n\n## ", desde));
    expect(chat).toContain("sigue las instrucciones del sistema");
    expect(chat).toContain("no preguntes por el WhatsApp");
    expect(chat.length).toBeLessThan(500);
  });

  it("lleva {{contexto_cliente}} antes de la referencia temporal y el idioma al final", () => {
    const i = prompt.indexOf(VARIABLE_DEL_CONTEXTO_DEL_CLIENTE);
    expect(i).toBeGreaterThan(prompt.indexOf("## Cierre"));
    expect(i).toBeLessThan(prompt.indexOf("## Referencia temporal"));
    expect(titulos(prompt).at(-1)).toBe("## Idioma");
  });

  it("la información corta va en «## Este negocio»; la larga, a get_catalog", () => {
    expect(prompt).toContain(
      "Información del negocio: Aceptamos tarjeta y Bizum."
    );
    const larga = buildManagedAgentPrompt({
      ...ENTRADA,
      businessDetails: "x".repeat(
        MAX_CARACTERES_DE_INFORMACION_EN_EL_PROMPT + 1
      ),
    });
    expect(larga).not.toContain("xxxx");
    expect(larga).toContain("te la da get_catalog en su campo informacion");
  });

  it("con un solo idioma, «Habla siempre en…» en Rol y sin «## Idioma»", () => {
    const uno = buildManagedAgentPrompt({ ...ENTRADA, idiomas: ["es-ES"] });
    expect(uno).toContain("Habla siempre en español de España.");
    expect(titulos(uno)).not.toContain("## Idioma");
  });

  // Laboratorio del 31-10: con el idioma compactado decía «they're called
  // mechas» (E2, 1 de 9): vuelven la instrucción de Rol y el recordatorio
  // de v1.
  it("el idioma, como en v1: instrucción en Rol y recordatorio al final", () => {
    expect(prompt).toContain("no son nombres propios");
    expect(prompt).toContain("(aunque te conteste en castellano)");
  });

  it("sin lista de espera, invita a volver a llamar; con ella, lo dice la tool", () => {
    const frase = "invítale a volver a llamar más adelante";
    expect(prompt).not.toContain(frase);
    expect(
      buildManagedAgentPrompt({ ...ENTRADA, listaDeEspera: false })
    ).toContain(frase);
  });

  it("la pregunta del WhatsApp depende del plan, como en v1", () => {
    expect(prompt).toContain("la confirmación y un recordatorio por WhatsApp");
    const sinRecordatorio = buildManagedAgentPrompt({
      ...ENTRADA,
      recordatorioPorWhatsapp: false,
    });
    expect(sinRecordatorio).not.toContain("un recordatorio");
  });

  it("no pregunta qué fecha es un día de la semana: lo comprueba", () => {
    expect(prompt).toContain(
      "no preguntes qué fecha es: compruébalo con check_availability"
    );
  });
});

describe("contextoDelCliente", () => {
  it("vacío si no se conoce a quien llama", () => {
    expect(contextoDelCliente(null, "Corte")).toBe("");
  });

  it("con nombre, el bloque «## Cliente» con su último servicio", () => {
    const bloque = contextoDelCliente("Marta", "Corte");
    expect(bloque.startsWith("## Cliente\n")).toBe(true);
    expect(bloque).toContain("como Marta (Corte)");
    expect(bloque).toContain("no se los vuelvas a pedir");
  });

  it("sin servicio, sin paréntesis", () => {
    expect(contextoDelCliente("Marta", null)).toContain("como Marta.");
  });
});

describe("reglasDelChat", () => {
  it("dicen lo del marcador, el aviso de IA, ni grabar ni colgar y el informe una sola vez", () => {
    const reglas = reglasDelChat({
      nombreDelNegocio: "El petit saló",
      ocultarNumero: false,
    });
    expect(reglas).toContain("[WhatsApp · número · fecha y hora]");
    expect(reglas).toContain(
      "que le atiende la recepcionista de IA de El petit saló"
    );
    expect(reglas).toContain("no uses preferencia_de_grabacion ni end_call");
    expect(reglas).toContain("llama UNA sola vez a informar_al_negocio");
    expect(reglas).toContain("dale el teléfono del negocio");
  });

  it("con el número oculto, recado y ningún teléfono", () => {
    const reglas = reglasDelChat({
      nombreDelNegocio: "El petit saló",
      ocultarNumero: true,
    });
    expect(reglas).toContain("no le des ningún teléfono");
    expect(reglas).not.toContain("dale el teléfono del negocio");
  });
});

describe("payload del assistant con v2", () => {
  const payload = (instructions: string) =>
    buildTelnyxAssistantPayload({
      businessId: "negocio",
      agentId: "agente",
      businessName: "El petit saló",
      instructions,
      greeting: "",
      idiomas: resolverIdiomas({
        languages: ["es-ES"],
        voiceLanguage: "es-ES",
        voiceGender: "femenina",
      }),
      voice: "Telnyx.Ultra.isabel",
    });

  it("contexto_cliente vacío por defecto si el prompt lo usa (el chat no lo manda)", () => {
    expect(payload(buildManagedAgentPrompt(ENTRADA)).dynamicVariables).toEqual({
      nombre_cliente: "",
      ultimo_servicio: "",
      contexto_cliente: "",
    });
  });

  it("con v1 las variables por defecto no cambian", () => {
    expect(
      payload(
        buildManagedAgentPrompt({
          ...ENTRADA,
          settings: DEFAULT_AGENT_SETTINGS,
        })
      ).dynamicVariables
    ).toEqual({ nombre_cliente: "", ultimo_servicio: "" });
  });
});

describe("prompt v2 (instantánea)", () => {
  it("El petit saló, peluquería con 9 idiomas", () => {
    expect(
      buildManagedAgentPrompt({
        ...ENTRADA,
        settings: {
          ...V2,
          voiceLanguage: "ca-ES",
          languages: idiomasQueHabla("ca-ES"),
        },
      })
    ).toMatchSnapshot();
  });
});
