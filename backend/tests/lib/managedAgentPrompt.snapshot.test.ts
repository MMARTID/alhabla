import { describe, it, expect } from "vitest";
import {
  buildManagedAgentPrompt,
  DEFAULT_AGENT_SETTINGS,
} from "../../src/lib/managedAgentPrompt.js";
import { ajustesParaRetell } from "../../src/lib/idiomas/resolver.js";
import { idiomasQueHabla } from "../../src/lib/idiomas/catalogo.js";
import type { TransferenciaAlDueno } from "../../src/lib/transferenciaAlDueno.js";

/**
 * Instantáneas del prompt gestionado completo en las combinaciones que lo
 * cambian: nicho, tono, objetivo, estilo, escalada, idiomas (los de Telnyx y
 * los de Retell), restricciones, lista de espera, privacidad del número,
 * transferencia e información del negocio. Son la red para reorganizar
 * managedAgentPrompt.ts: cualquier carácter distinto cambia el
 * `telnyxConfigHash` y fuerza un updateAssistant en todos los agentes (y
 * una versión nueva en Retell). Actualizarlas solo a propósito.
 */
const transferencia = (
  modo: TransferenciaAlDueno["modo"]
): TransferenciaAlDueno => ({
  modo,
  origen: "+34910000000",
  destino: "+34600000000",
  activa: true,
});

const CASOS: Array<[string, Parameters<typeof buildManagedAgentPrompt>[0]]> = [
  [
    "por defecto: sin nicho ni nada más",
    { businessName: "Negocio", settings: DEFAULT_AGENT_SETTINGS },
  ],
  [
    "peluquería con todo: información, restricciones en horas, transferencia si lo pide",
    {
      businessName: "Peluquería Ana",
      businessDetails:
        "  Aceptamos tarjeta y Bizum.\nHay parking en la calle de atrás.  ",
      businessType: "peluqueria",
      settings: DEFAULT_AGENT_SETTINGS,
      timezone: "Atlantic/Canary",
      minAdvanceBookingMinutes: 120,
      maxAppointmentDurationMinutes: 90,
      listaDeEspera: true,
      ocultarNumeroDelNegocio: false,
      transferenciaAlDueno: transferencia("si_lo_pide"),
    },
  ],
  [
    "barbería sin lista de espera, número oculto y transferencia siempre",
    {
      businessName: "Barbería Leo",
      businessType: "barberia",
      settings: DEFAULT_AGENT_SETTINGS,
      minAdvanceBookingMinutes: 45,
      listaDeEspera: false,
      ocultarNumeroDelNegocio: true,
      transferenciaAlDueno: transferencia("siempre"),
    },
  ],
  [
    "fisioterapia: profesional, atención al cliente, equilibrado y que le llamen",
    {
      businessName: "Fisio Centro",
      businessType: "fisioterapia",
      settings: {
        ...DEFAULT_AGENT_SETTINGS,
        tone: "professional",
        primaryGoal: "customer_service",
        responseStyle: "balanced",
        escalation: "request_callback",
      },
      timezone: "Marte/Olympus",
    },
  ],
  [
    "centro de estética: directo y captación, transferencia inactiva",
    {
      businessName: "Estética Luz",
      businessType: "centro-de-estetica",
      settings: {
        ...DEFAULT_AGENT_SETTINGS,
        tone: "direct",
        primaryGoal: "lead_capture",
      },
      transferenciaAlDueno: {
        modo: "nunca",
        origen: null,
        destino: null,
        activa: false,
      },
    },
  ],
  [
    "salón de uñas con los idiomas de Retell (solo español)",
    {
      businessName: "Uñas Bea",
      businessType: "salon-de-unas",
      settings: ajustesParaRetell(DEFAULT_AGENT_SETTINGS),
      idiomas: ajustesParaRetell(DEFAULT_AGENT_SETTINGS).languages,
    },
  ],
  [
    "otro negocio con el catalán de principal",
    {
      businessName: "Botiga",
      businessType: "other",
      settings: {
        ...DEFAULT_AGENT_SETTINGS,
        voiceLanguage: "ca-ES",
        languages: idiomasQueHabla("ca-ES"),
      },
    },
  ],
];

describe("prompt gestionado (instantáneas)", () => {
  for (const [nombre, entrada] of CASOS) {
    it(nombre, () => {
      expect(buildManagedAgentPrompt(entrada)).toMatchSnapshot();
    });
  }
});
