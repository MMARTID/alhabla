import { describe, it, expect, vi } from "vitest";
import {
  CANTIDAD_DE_TELEFONOS_DE_FICCION,
  ESCENARIOS_NO_DISPONIBLES,
  MARCA_DE_LAS_BAJAS_DE_LABORATORIO,
  NEGOCIOS_DE_LABORATORIO,
  NEGOCIO_POR_ESCENARIO,
  PREFIJO_DEL_NOMBRE_DE_LABORATORIO,
  TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
  TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO,
  TELEFONOS_DICTADOS_DE_LABORATORIO,
  esTelefonoDeFiccion,
  idDelNegocioDelGuion,
  negocioDeLaboratorio,
  telefonoDeFiccion,
} from "../../scripts/laboratorioDePrompt.negocios.js";
import { todosLosGuiones } from "../../scripts/laboratorioDePrompt.escenarios.js";
import {
  AYUDA,
  ErrorDeUso,
  aplicarPlan,
  borrarSiembra,
  diaDeLaSemanaDe,
  especificaciones,
  exigirBdDeDevLocal,
  exigirSiembraSinDestinatarios,
  fechaLocalDe,
  instanteDeHoraLocal,
  parsearArgumentos,
  planificarSiembra,
  planificarTodo,
  ponerBajas,
  prepararEntorno,
  proximoDiaDeLaSemana,
  proximosViernesALas10,
  restablecerPlan,
  telefonosConBaja,
  type ClienteDeSiembra,
  type PlanDeNegocio,
} from "../../scripts/sembrarNegociosDeLaboratorio.js";
import { TITULO_DEL_BLOQUE_DE_TRANSFERENCIA } from "../../src/lib/managedAgentPrompt.js";
import {
  esLineaDeClientesEspanola,
  isValidE164Phone,
} from "../../src/lib/phone.js";
import { checkBusinessHours } from "../../src/lib/businessSchedule.js";

// Viernes 30-10-2026, 13:00 en Madrid (CET).
const AHORA = new Date("2026-10-30T12:00:00Z");

const planes = planificarTodo({ ahora: AHORA, listaDeEspera: false });
const plan = (clave: string): PlanDeNegocio => {
  const encontrado = planes.find((p) => p.clave === clave);
  if (!encontrado) throw new Error(`no hay plan ${clave}`);
  return encontrado;
};

const ajustesDe = (clave: string) =>
  plan(clave).negocio.agentSettings as Record<string, unknown>;

// ---------------------------------------------------------------------------
// El contrato con el laboratorio
// ---------------------------------------------------------------------------

describe("laboratorioDePrompt.negocios (contrato)", () => {
  it("cada negocio tiene un id fijo válido, único, y se llama «Lab · …»", () => {
    const ids = NEGOCIOS_DE_LABORATORIO.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const negocio of NEGOCIOS_DE_LABORATORIO) {
      expect(negocio.id).toMatch(/^[a-z0-9]{10,40}$/);
      expect(negocio.nombre.startsWith(PREFIJO_DEL_NOMBRE_DE_LABORATORIO)).toBe(
        true
      );
      expect(negocio.descripcion.length).toBeGreaterThan(10);
    }
    const claves = NEGOCIOS_DE_LABORATORIO.map((n) => n.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("cada guion de la batería tiene negocio o está marcado como no disponible con motivo", () => {
    for (const guion of todosLosGuiones()) {
      const negocio = NEGOCIO_POR_ESCENARIO[guion.clave];
      const motivo = ESCENARIOS_NO_DISPONIBLES[guion.clave];
      expect(
        Boolean(negocio) !== Boolean(motivo),
        `${guion.clave}: o tiene negocio o no está disponible, no las dos`
      ).toBe(true);
      if (negocio) {
        expect(idDelNegocioDelGuion(guion.clave)).toBe(
          negocioDeLaboratorio(negocio).id
        );
      } else {
        expect(motivo!.length).toBeGreaterThan(40);
        expect(idDelNegocioDelGuion(guion.clave)).toBeNull();
      }
    }
  });

  it("no hay claves de guion que no existan en la batería", () => {
    const claves = new Set(todosLosGuiones().map((g) => g.clave));
    for (const clave of [
      ...Object.keys(NEGOCIO_POR_ESCENARIO),
      ...Object.keys(ESCENARIOS_NO_DISPONIBLES),
    ]) {
      expect(claves.has(clave), clave).toBe(true);
    }
  });

  it("E22b (lista de espera activada) es el único guion no disponible", () => {
    expect(Object.keys(ESCENARIOS_NO_DISPONIBLES)).toEqual(["E22b"]);
    expect(ESCENARIOS_NO_DISPONIBLES.E22b).toMatch(/hueco_libre/);
  });

  it("todos los negocios mapeados existen y todos los negocios tienen especificación", () => {
    const claves = NEGOCIOS_DE_LABORATORIO.map((n) => n.clave);
    for (const clave of Object.values(NEGOCIO_POR_ESCENARIO)) {
      expect(claves).toContain(clave);
    }
    expect(especificaciones().map((e) => e.clave)).toEqual(claves);
  });

  it("agrupa los guiones que necesitan llamadas distintas en negocios distintos", () => {
    const negocioDe = (clave: string) => NEGOCIO_POR_ESCENARIO[clave];
    const distintos = [
      "E8",
      "E14",
      "E21",
      "E20",
      "E23a",
      "E19a",
      "E19b",
      "E18a",
    ];
    expect(new Set(distintos.map(negocioDe)).size).toBe(distintos.length);
    expect(negocioDe("E14")).toBe(negocioDe("E15"));
    expect(negocioDe("E18a")).toBe(negocioDe("E18b"));
    expect(negocioDe("E23a")).toBe(negocioDe("E23b"));
    expect(negocioDe("E10")).toBe("peluqueria");
  });

  it("el cliente conocido lleva las variables con las que rellenar el prompt", () => {
    expect(
      negocioDeLaboratorio("cliente-conocido").variablesDeLaLlamada
    ).toEqual({ nombre_cliente: "Marta", ultimo_servicio: "Corte" });
    // En cambios y anulaciones también es conocido: tiene una cita con
    // nombre, y en producción el saludo le llama por él.
    expect(
      negocioDeLaboratorio("peluqueria-cambios").variablesDeLaLlamada
    ).toEqual({ nombre_cliente: "Lucía", ultimo_servicio: "Corte" });
  });

  it("las citas sembradas dan las variables que dice el contrato", () => {
    for (const negocio of NEGOCIOS_DE_LABORATORIO) {
      if (!negocio.variablesDeLaLlamada) continue;
      const p = plan(negocio.clave);
      expect(p.citas.length, negocio.clave).toBeGreaterThan(0);
      for (const cita of p.citas) {
        expect(cita.clientName, negocio.clave).toBe(
          negocio.variablesDeLaLlamada.nombre_cliente
        );
        expect(cita.servicio, negocio.clave).toBe(
          negocio.variablesDeLaLlamada.ultimo_servicio
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Teléfonos de ficción
// ---------------------------------------------------------------------------

describe("teléfonos de ficción", () => {
  it("son +15550100 … +15550199, E.164 válidos y distintos", () => {
    expect(TELEFONOS_DE_CLIENTE_DE_LABORATORIO).toHaveLength(
      CANTIDAD_DE_TELEFONOS_DE_FICCION
    );
    expect(new Set(TELEFONOS_DE_CLIENTE_DE_LABORATORIO).size).toBe(100);
    expect(TELEFONOS_DE_CLIENTE_DE_LABORATORIO[0]).toBe("+15550100");
    expect(TELEFONOS_DE_CLIENTE_DE_LABORATORIO[99]).toBe("+15550199");
    for (const telefono of TELEFONOS_DE_CLIENTE_DE_LABORATORIO) {
      expect(isValidE164Phone(telefono)).toBe(true);
      expect(telefono).toMatch(/^\+155501\d\d$/);
      // Ninguno es una línea española: nada los trata como un móvil real.
      expect(esLineaDeClientesEspanola(telefono)).toBe(false);
    }
  });

  it("telefonoDeFiccion da la vuelta y esTelefonoDeFiccion rechaza lo demás", () => {
    expect(telefonoDeFiccion(100)).toBe("+15550100");
    expect(telefonoDeFiccion(-1)).toBe("+15550199");
    expect(esTelefonoDeFiccion("+15550123")).toBe(true);
    expect(esTelefonoDeFiccion("+34612345678")).toBe(false);
    expect(esTelefonoDeFiccion(null)).toBe(false);
  });

  it("los dueños de transferencia tienen forma de línea española para que la tool se registre", () => {
    for (const { origen, movilDelDueno } of Object.values(
      TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO
    )) {
      expect(esLineaDeClientesEspanola(movilDelDueno)).toBe(true);
      expect(origen).not.toBe(movilDelDueno);
    }
  });

  it("todas las llamadas y chats sembrados usan solo teléfonos de ficción (o ninguno)", () => {
    for (const p of planes) {
      for (const llamada of p.llamadas) {
        expect(
          llamada.fromNumber === null ||
            esTelefonoDeFiccion(llamada.fromNumber),
          `${p.clave} ${llamada.callId}`
        ).toBe(true);
      }
      for (const telefono of p.clientesQueAceptaron) {
        expect(esTelefonoDeFiccion(telefono)).toBe(true);
      }
    }
  });

  it("los teléfonos que dictan los guiones son de ficción y son todos los que dictan", () => {
    for (const telefono of TELEFONOS_DICTADOS_DE_LABORATORIO) {
      expect(esTelefonoDeFiccion(telefono)).toBe(true);
    }
    const dictados = todosLosGuiones().flatMap((g) =>
      (g.datos.telefonos ?? []).map((t) => `+${t.replace(/\D/g, "")}`)
    );
    expect(dictados.length).toBeGreaterThan(0);
    for (const dictado of dictados) {
      expect(TELEFONOS_DICTADOS_DE_LABORATORIO as readonly string[]).toContain(
        dictado
      );
    }
  });

  it("los teléfonos de los negocios son de ficción, únicos y de más de 9 cifras", () => {
    const telefonos = planes.map((p) => p.negocio.phone);
    expect(new Set(telefonos).size).toBe(telefonos.length);
    for (const telefono of telefonos) {
      expect(telefono).toMatch(/^\+121255501\d\d$/);
      expect(isValidE164Phone(telefono)).toBe(true);
      expect(esTelefonoDeFiccion(telefono)).toBe(false);
    }
  });

  it("las bajas cubren los 100 teléfonos de ficción y los móviles de los dueños", () => {
    const bajas = telefonosConBaja();
    expect(bajas.filter((b) => b.audiencia === "client")).toHaveLength(100);
    expect(
      bajas.filter((b) => b.audiencia === "owner").map((b) => b.telefono)
    ).toEqual(
      Object.values(TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO).map(
        (t) => t.movilDelDueno
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

describe("fechas en la zona del negocio", () => {
  it("instanteDeHoraLocal respeta el horario de verano e invierno", () => {
    const diez = (anio: number, mes: number, dia: number) =>
      instanteDeHoraLocal({ anio, mes, dia }, 10, 0).toISOString();
    expect(diez(2026, 3, 27)).toBe("2026-03-27T09:00:00.000Z"); // CET
    expect(diez(2026, 4, 3)).toBe("2026-04-03T08:00:00.000Z"); // CEST
    expect(diez(2026, 10, 23)).toBe("2026-10-23T08:00:00.000Z"); // CEST
    expect(diez(2026, 11, 6)).toBe("2026-11-06T09:00:00.000Z"); // CET
  });

  it("proximoDiaDeLaSemana es estrictamente posterior a hoy", () => {
    // Hoy es viernes 30-10: el siguiente viernes es el 6-11.
    expect(proximoDiaDeLaSemana(AHORA, 5)).toEqual({
      anio: 2026,
      mes: 11,
      dia: 6,
    });
    // Y el jueves, el 5-11.
    expect(proximoDiaDeLaSemana(AHORA, 4)).toEqual({
      anio: 2026,
      mes: 11,
      dia: 5,
    });
    expect(diaDeLaSemanaDe({ anio: 2026, mes: 11, dia: 6 })).toBe(5);
  });

  it("usa el día de Madrid, no el de UTC", () => {
    // 23:30 UTC del jueves 29 ya es viernes 30 en Madrid.
    expect(fechaLocalDe(new Date("2026-10-29T23:30:00Z"))).toEqual({
      anio: 2026,
      mes: 10,
      dia: 30,
    });
  });

  it("los viernes ocupados son los dos próximos a las 10", () => {
    expect(proximosViernesALas10(AHORA).map((d) => d.toISOString())).toEqual([
      "2026-11-06T09:00:00.000Z",
      "2026-11-13T09:00:00.000Z",
    ]);
    // Un viernes antes de las 10 cuenta el de hoy.
    expect(
      proximosViernesALas10(new Date("2026-10-30T06:00:00Z")).map((d) =>
        d.toISOString()
      )
    ).toEqual(["2026-10-30T09:00:00.000Z", "2026-11-06T09:00:00.000Z"]);
  });
});

// ---------------------------------------------------------------------------
// Lo que pide cada negocio
// ---------------------------------------------------------------------------

describe("planificarSiembra: lo que cubre cada negocio", () => {
  it("todos reservan en la agenda de Alhabla, sin Stripe ni calendario ni avisos al dueño", () => {
    expect(planes).toHaveLength(NEGOCIOS_DE_LABORATORIO.length);
    for (const p of planes) {
      expect(p.negocio.modoDeAgenda).toBe("alhabla");
      expect(p.negocio.timezone).toBe("Europe/Madrid");
      expect(p.negocio.stripeCustomerId).toBeUndefined();
      expect(p.negocio.stripePriceId).toBeUndefined();
      expect(p.negocio.subscriptionStatus).toBeUndefined();
      expect(p.negocio.active).toBe(true);
      expect(p.negocio.notificationPrefs).toEqual({ avisoPorReserva: false });
      expect(p.negocio.ownerWhatsappOptInAt).toBeUndefined();
      expect(p.emailDelDueno).toBe(`lab-${p.clave}@alhabla.local`);
      expect(p.agente.systemPrompt.length).toBeGreaterThan(5_000);
    }
  });

  it("cada negocio tiene al menos 30 llamadas libres para el laboratorio", () => {
    for (const p of planes) {
      expect(p.resumen.llamadasLibres, p.clave).toBeGreaterThanOrEqual(30);
    }
  });

  it("las llamadas son de Telnyx, cerradas y con callId «lab-<clave>-NNNN»", () => {
    for (const p of planes) {
      const ids = p.llamadas.map((l) => l.callId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const llamada of p.llamadas.filter(
        (l) => l.voiceProvider === "telnyx"
      )) {
        expect(llamada.callId.startsWith(`lab-${p.clave}-`)).toBe(true);
      }
    }
    expect(plan("peluqueria").llamadas[0]!.callId).toBe("lab-peluqueria-0001");
  });

  it("peluquería base: Mechas, sin keratina, Corte sin precio, Laura y Montse (ninguna Lara), con inglés", () => {
    const p = plan("peluqueria");
    const nombres = p.servicios.map((s) => s.name.toLowerCase());
    expect(nombres).toContain("mechas");
    expect(nombres.some((n) => n.includes("keratina"))).toBe(false);
    expect(p.servicios.find((s) => s.name === "Corte")!.priceCents).toBeNull();
    const equipo = p.profesionales.map((x) => x.name);
    expect(equipo).toEqual(expect.arrayContaining(["Laura", "Montse"]));
    expect(equipo.map((n) => n.toLowerCase())).not.toContain("lara");
    expect(ajustesDe("peluqueria").languages).toContain("en-GB");
    expect(ajustesDe("peluqueria").darPrecios).toBe("si_preguntan");
    expect(ajustesDe("peluqueria").voiceLanguage).toBe("es-ES");
    // Sin precios escritos en la información.
    expect(p.negocio.businessDetails).not.toMatch(/€|euro|\d/);
    expect(p.niveles).toEqual([]);
    expect(p.negocio.hideOwnerNumberFromClients).toBe(false);
  });

  it("peluquería base: llamadas con el permiso de grabación dado y chats de WhatsApp", () => {
    const p = plan("peluqueria");
    const voz = p.llamadas.filter((l) => l.voiceProvider === "telnyx");
    expect(voz.every((l) => l.grabacionPermitida === true)).toBe(true);
    expect(voz.every((l) => l.fromNumber !== null)).toBe(true);
    // Cada teléfono aceptó, como en E9a.
    expect(new Set(p.clientesQueAceptaron)).toEqual(
      new Set(voz.map((l) => l.fromNumber))
    );
    const chats = p.llamadas.filter((l) => l.voiceProvider === "whatsapp");
    expect(chats.length).toBeGreaterThanOrEqual(30);
    for (const chat of chats) {
      expect(chat.callId.startsWith("whatsapp:chat:")).toBe(true);
      expect(chat.fromNumber).not.toBeNull();
    }
    // Suficientes llamadas para n = 10 y dos variantes en los 7 guiones que reservan.
    expect(voz.length).toBeGreaterThanOrEqual(7 * 10 * 2);
    // Ninguna llamada libre arranca con cita ni en curso.
    expect(p.citas).toEqual([]);
  });

  it("peluquería catalana: ca-ES como principal y en zona cooficial", () => {
    const p = plan("peluqueria-ca");
    expect(ajustesDe("peluqueria-ca").voiceLanguage).toBe("ca-ES");
    expect(ajustesDe("peluqueria-ca").languages).toContain("ca-ES");
    expect(p.negocio.address).toMatch(/08\d{3} Barcelona/);
    expect(p.servicios.map((s) => s.name)).toContain("Corte");
  });

  it("peluquería con especialidades: Laura no se sugiere en Corte y Montse es la especialista", () => {
    const p = plan("peluqueria-especialidad");
    const id = (nombre: string) =>
      p.profesionales.find((x) => x.name === nombre)!.id;
    const corte = p.servicios.find((s) => s.name === "Corte")!.id;
    expect(p.niveles).toEqual([
      { professionalId: id("Laura"), serviceId: corte, level: "NO_SUGERIR" },
      { professionalId: id("Montse"), serviceId: corte, level: "ESPECIALISTA" },
    ]);
    // Hay una tercera persona libre además de Montse.
    expect(p.profesionales.length).toBeGreaterThanOrEqual(3);
  });

  it("grabación: llamadas de teléfonos distintos que aún no han decidido", () => {
    const p = plan("peluqueria-grabacion");
    const voz = p.llamadas.filter((l) => l.voiceProvider === "telnyx");
    expect(voz.every((l) => l.grabacionPermitida === null)).toBe(true);
    expect(p.clientesQueAceptaron).toEqual([]);
    expect(new Set(voz.map((l) => l.fromNumber)).size).toBe(voz.length);
    expect(voz.length).toBeGreaterThanOrEqual(20);
  });

  it("cambios y anulaciones: cada teléfono libre tiene una cita futura el jueves en otra llamada, sin solapes", () => {
    const p = plan("peluqueria-cambios");
    const libres = p.llamadas.filter((l) => !l.conCita);
    const historial = p.llamadas.filter((l) => l.conCita);
    expect(libres.length).toBeGreaterThanOrEqual(40);
    expect(historial).toHaveLength(libres.length);
    for (const libre of libres) {
      const suyas = historial.filter((h) => h.fromNumber === libre.fromNumber);
      expect(suyas).toHaveLength(1);
      const cita = p.citas.filter((c) => c.callId === suyas[0]!.callId);
      expect(cita).toHaveLength(1);
      expect(cita[0]!.programedAt.getTime()).toBeGreaterThan(AHORA.getTime());
    }
    // El jueves 5-11, entre las 9:00 y las 20:00 de Madrid.
    for (const cita of p.citas) {
      const local = fechaLocalDe(cita.programedAt);
      expect(local).toEqual({ anio: 2026, mes: 11, dia: 5 });
      const horario = checkBusinessHours(
        p.negocio.schedule,
        "Europe/Madrid",
        cita.programedAt.toISOString(),
        cita.durationMinutes
      );
      expect(horario.success && horario.isOpen).toBe(true);
    }
    // Un profesional no tiene dos citas a la vez.
    const porProfesional = new Map<string, number[]>();
    for (const cita of p.citas) {
      const lista = porProfesional.get(cita.profesional!) ?? [];
      lista.push(cita.programedAt.getTime());
      porProfesional.set(cita.profesional!, lista);
    }
    for (const inicios of porProfesional.values()) {
      expect(new Set(inicios).size).toBe(inicios.length);
    }
  });

  it("número oculto: las llamadas no traen teléfono", () => {
    const p = plan("peluqueria-telefono-oculto");
    const voz = p.llamadas.filter((l) => l.voiceProvider === "telnyx");
    expect(voz.every((l) => l.fromNumber === null)).toBe(true);
    // Sin teléfono, check_availability no puede mirar al cliente: la llamada
    // ya trae el permiso para que no pregunte por la grabación.
    expect(voz.every((l) => l.grabacionPermitida === true)).toBe(true);
  });

  it("los tres modos de precios: siempre, si preguntan (Tinte sin precio y «desde 30 €») y nunca (precio en la información)", () => {
    expect(ajustesDe("precios-siempre").darPrecios).toBe("siempre");
    expect(
      plan("precios-siempre").servicios.every((s) => s.priceCents !== null)
    ).toBe(true);

    const preguntan = plan("precios-preguntan");
    expect(ajustesDe("precios-preguntan").darPrecios).toBe("si_preguntan");
    expect(
      preguntan.servicios.find((s) => s.name === "Tinte")!.priceCents
    ).toBeNull();
    expect(
      preguntan.servicios.find((s) => s.name === "Corte")!.priceCents
    ).toBeNull();
    expect(preguntan.negocio.businessDetails).toMatch(/tintes desde 30 €/i);

    const nunca = plan("precios-nunca");
    expect(ajustesDe("precios-nunca").darPrecios).toBe("nunca");
    expect(nunca.negocio.businessDetails).toMatch(/\d+\s*€/);
  });

  it("privacidad: oculta el número del negocio, con llamadas y chats", () => {
    const p = plan("privacidad");
    expect(p.negocio.hideOwnerNumberFromClients).toBe(true);
    expect(p.resumen.llamadasLibres).toBeGreaterThanOrEqual(30);
    expect(p.resumen.chatsLibres).toBeGreaterThanOrEqual(30);
    for (const otro of planes.filter((x) => x.clave !== "privacidad")) {
      expect(otro.negocio.hideOwnerNumberFromClients).toBe(false);
    }
  });

  it("transferencia «si lo piden»: móvil del dueño válido y el bloque «Pasar la llamada» en el prompt", () => {
    const p = plan("transferencia-si-lo-piden");
    expect(ajustesDe("transferencia-si-lo-piden").pasarLlamadas).toBe(
      "si_lo_pide"
    );
    expect(esLineaDeClientesEspanola(p.negocio.ownerWhatsappNumber!)).toBe(
      true
    );
    expect(p.negocio.telnyxPhoneNumber).toBeTruthy();
    expect(p.negocio.ownerWhatsappNumber).not.toBe(p.negocio.telnyxPhoneNumber);
    expect(p.agente.systemPrompt).toContain(TITULO_DEL_BLOQUE_DE_TRANSFERENCIA);
    expect(p.agente.systemPrompt).toContain("pide de forma clara");
  });

  it("transferencia «siempre»: ningún día abre, así que a cualquier hora está fuera de horario", () => {
    const p = plan("transferencia-siempre");
    expect(ajustesDe("transferencia-siempre").pasarLlamadas).toBe("siempre");
    expect(p.agente.systemPrompt).toContain(TITULO_DEL_BLOQUE_DE_TRANSFERENCIA);
    expect(p.agente.systemPrompt).toContain(
      "Solo dentro del horario de apertura"
    );
    // Cada hora de una semana entera está cerrada.
    for (let hora = 0; hora < 7 * 24; hora++) {
      const instante = new Date(AHORA.getTime() + hora * 3_600_000);
      const resultado = checkBusinessHours(
        p.negocio.schedule,
        "Europe/Madrid",
        instante.toISOString(),
        0
      );
      expect(resultado.success && resultado.isOpen).toBe(false);
    }
    // El resto sí abre.
    const abierto = checkBusinessHours(
      plan("peluqueria").negocio.schedule,
      "Europe/Madrid",
      "2026-11-06T09:00:00.000Z",
      30
    );
    expect(abierto.success && abierto.isOpen).toBe(true);
  });

  it("solo los dos negocios de transferencia tienen número de Telnyx", () => {
    const conNumero = planes
      .filter((p) => p.negocio.telnyxPhoneNumber)
      .map((p) => p.clave);
    expect(conNumero.sort()).toEqual([
      "transferencia-si-lo-piden",
      "transferencia-siempre",
    ]);
    const conDueno = planes
      .filter((p) => p.negocio.ownerWhatsappNumber)
      .map((p) => p.clave);
    expect(conDueno.sort()).toEqual(conNumero.sort());
  });

  it("lista de espera: todos los profesionales ocupados los próximos viernes a las 10", () => {
    const p = plan("lista-de-espera");
    const viernes = proximosViernesALas10(AHORA);
    expect(p.citas).toHaveLength(viernes.length * p.profesionales.length);
    for (const dia of viernes) {
      const delDia = p.citas.filter(
        (c) => c.programedAt.getTime() === dia.getTime()
      );
      expect(delDia.map((c) => c.profesional).sort()).toEqual(
        p.profesionales.map((x) => x.name).sort()
      );
      // 10:00 en Madrid, un viernes.
      expect(diaDeLaSemanaDe(fechaLocalDe(dia))).toBe(5);
      const local = new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(dia);
      expect(local).toBe("10:00");
    }
    // Cubren la hora y media siguiente: la alternativa no es "las 10:30".
    expect(p.citas.every((c) => c.durationMinutes >= 60)).toBe(true);
    // Y la lista de espera no está en el prompt mientras hueco_libre no esté aprobada.
    expect(p.agente.systemPrompt).not.toContain(
      "te aviso por WhatsApp si se libera"
    );
  });

  it("el prompt de la lista de espera cambia con la plantilla aprobada", () => {
    const espec = especificaciones().find(
      (e) => e.clave === "lista-de-espera"
    )!;
    const sin = planificarSiembra(espec, {
      ahora: AHORA,
      listaDeEspera: false,
    });
    const con = planificarSiembra(espec, { ahora: AHORA, listaDeEspera: true });
    expect(con.agente.systemPrompt).not.toBe(sin.agente.systemPrompt);
  });

  it("cliente conocido: Marta reservó un Corte con Laura, en el pasado, y todas las llamadas son suyas", () => {
    const p = plan("cliente-conocido");
    const libres = p.llamadas.filter((l) => !l.conCita);
    expect(new Set(libres.map((l) => l.fromNumber)).size).toBe(1);
    expect(p.citas).toHaveLength(1);
    const cita = p.citas[0]!;
    expect(cita.clientName).toBe("Marta");
    expect(cita.servicio).toBe("Corte");
    expect(cita.profesional).toBe("Laura");
    expect(cita.programedAt.getTime()).toBeLessThan(AHORA.getTime());
    const historial = p.llamadas.find((l) => l.callId === cita.callId)!;
    expect(historial.fromNumber).toBe(libres[0]!.fromNumber);
    expect(p.clientesQueAceptaron).toEqual([libres[0]!.fromNumber]);
  });

  it("fisioterapia: tipo fisioterapia", () => {
    expect(plan("fisioterapia").negocio.businessType).toBe("fisioterapia");
  });

  it("es determinista: la misma hora da el mismo plan", () => {
    const otra = planificarTodo({ ahora: AHORA, listaDeEspera: false });
    expect(JSON.stringify(otra)).toBe(JSON.stringify(planes));
  });

  it("--solo rechaza un negocio que no existe", () => {
    expect(() =>
      planificarTodo({ ahora: AHORA, listaDeEspera: false }, ["nada"])
    ).toThrow(ErrorDeUso);
    expect(
      planificarTodo({ ahora: AHORA, listaDeEspera: false }, ["fisioterapia"])
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Nada sale a nadie
// ---------------------------------------------------------------------------

describe("exigirSiembraSinDestinatarios", () => {
  it("deja pasar la siembra entera", () => {
    expect(() => exigirSiembraSinDestinatarios(planes)).not.toThrow();
  });

  it("rechaza un negocio con número de Telnyx que no es de transferencia", () => {
    const mala = structuredClone(plan("peluqueria"));
    mala.negocio.telnyxPhoneNumber = "+34930000000";
    expect(() => exigirSiembraSinDestinatarios([mala])).toThrow(/Telnyx/);
  });

  it("rechaza un teléfono de cliente que no sea de ficción", () => {
    const mala = structuredClone(plan("peluqueria"));
    mala.llamadas[0]!.fromNumber = "+34612345678";
    expect(() => exigirSiembraSinDestinatarios([mala])).toThrow(/ficción/);
  });

  it("rechaza un dueño con alta de WhatsApp o con avisos por reserva", () => {
    const conAlta = structuredClone(plan("peluqueria"));
    conAlta.negocio.ownerWhatsappOptInAt = new Date();
    expect(() => exigirSiembraSinDestinatarios([conAlta])).toThrow(/dueño/);
    const conAvisos = structuredClone(plan("peluqueria"));
    conAvisos.negocio.notificationPrefs = {};
    expect(() => exigirSiembraSinDestinatarios([conAvisos])).toThrow(/dueño/);
  });

  it("rechaza citas sembradas en un negocio con número de Telnyx", () => {
    const mala = structuredClone(plan("transferencia-siempre"));
    mala.citas.push(structuredClone(plan("lista-de-espera").citas[0]!));
    expect(() => exigirSiembraSinDestinatarios([mala])).toThrow(/citas/);
  });
});

// ---------------------------------------------------------------------------
// Solo la BD de dev local
// ---------------------------------------------------------------------------

describe("exigirBdDeDevLocal", () => {
  it("traduce el host «postgres» del .env al Postgres local de Docker", () => {
    const url = exigirBdDeDevLocal(
      "postgresql://alhabla:secreto@postgres:5432/botbook"
    );
    expect(new URL(url).hostname).toBe("localhost");
    expect(new URL(url).port).toBe("5433");
  });

  it("acepta localhost", () => {
    expect(
      exigirBdDeDevLocal("postgresql://u:p@localhost:5433/botbook")
    ).toContain("localhost:5433/botbook");
  });

  it("rechaza una BD remota", () => {
    expect(() =>
      exigirBdDeDevLocal("postgresql://u:p@db.ejemplo.com:5432/botbook")
    ).toThrow(/no es local/);
  });

  it("rechaza producción por el socket de Cloud SQL, aunque el host parezca local", () => {
    expect(() =>
      exigirBdDeDevLocal(
        "postgresql://u:p@localhost/alhabla?host=/cloudsql/proyecto:europe-west1:alhabla"
      )
    ).toThrow(/no es local/);
  });

  it("rechaza la BD de los tests de integración", () => {
    expect(() =>
      exigirBdDeDevLocal("postgresql://u:p@localhost:5433/alhabla_test")
    ).toThrow(/no es la de desarrollo/);
  });

  it("rechaza cualquier otro Postgres que escuche en localhost", () => {
    // Producción tras un Cloud SQL Auth Proxy (mcp/prod.ts: 127.0.0.1 y un
    // puerto libre).
    expect(() =>
      exigirBdDeDevLocal("postgresql://alhabla:x@127.0.0.1:61234/alhabla")
    ).toThrow(/no es la de desarrollo/);
    expect(() =>
      exigirBdDeDevLocal("postgresql://alhabla:x@127.0.0.1:61234/botbook")
    ).toThrow(/Docker de desarrollo/);
    // El de Homebrew en el 5432.
    expect(() =>
      exigirBdDeDevLocal("postgresql://u:x@localhost:5432/postgres")
    ).toThrow(/no es la de desarrollo/);
  });

  it("rechaza que falte la URL", () => {
    expect(() => exigirBdDeDevLocal(undefined)).toThrow(/DATABASE_URL/);
  });

  it("prepararEntorno usa solo la DATABASE_URL del .env de dev, no la de la shell", () => {
    const antes = process.env.DATABASE_URL;
    const avisos: string[] = [];
    try {
      process.env.DATABASE_URL =
        "postgresql://alhabla:x@127.0.0.1:61234/alhabla";
      const local = prepararEntorno(
        () => ({ DATABASE_URL: "postgresql://a:b@postgres:5432/botbook" }),
        (aviso) => avisos.push(aviso)
      );
      expect(local).toContain("localhost:5433/botbook");
      expect(process.env.DATABASE_URL).toBe(local);
      expect(avisos.join("\n")).toMatch(/Se ignora la DATABASE_URL/);
      expect(() =>
        prepararEntorno(() => ({
          DATABASE_URL: "postgresql://a:b@127.0.0.1:61234/alhabla",
        }))
      ).toThrow(/no es la de desarrollo/);
    } finally {
      if (antes === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = antes;
    }
  });
});

describe("parsearArgumentos", () => {
  it("lee las opciones", () => {
    expect(parsearArgumentos([])).toMatchObject({
      borrar: false,
      restablecer: false,
      dryRun: false,
      solo: null,
    });
    expect(parsearArgumentos(["--borrar", "--dry-run"])).toMatchObject({
      borrar: true,
      dryRun: true,
    });
    expect(parsearArgumentos(["--solo", "a, b"]).solo).toEqual(["a", "b"]);
    expect(parsearArgumentos(["--solo=privacidad"]).solo).toEqual([
      "privacidad",
    ]);
    expect(parsearArgumentos(["--ayuda"]).ayuda).toBe(true);
    expect(AYUDA).toContain("--restablecer");
  });

  it("rechaza lo desconocido y las combinaciones sin sentido", () => {
    expect(() => parsearArgumentos(["--hacer-todo"])).toThrow(ErrorDeUso);
    expect(() => parsearArgumentos(["suelto"])).toThrow(ErrorDeUso);
    expect(() => parsearArgumentos(["--solo"])).toThrow(ErrorDeUso);
    expect(() => parsearArgumentos(["--borrar", "--restablecer"])).toThrow(
      ErrorDeUso
    );
  });
});

// ---------------------------------------------------------------------------
// Escritura (con un Prisma de mentira)
// ---------------------------------------------------------------------------

interface Registro {
  llamada: string;
  argumentos: unknown;
}

function prismaFalso(
  opciones: {
    negocioExistente?: { name: string } | null;
    negociosEncontrados?: Array<{ id: string; name: string }>;
    usuarioExistente?: boolean;
    bajasExistentes?: Array<{
      id: string;
      phoneNumber: string;
      audience: string;
      revokedAt: Date | null;
      inboundMessageId: string | null;
    }>;
    baseDeDatos?: string;
  } = {}
) {
  const registro: Registro[] = [];
  const modelo = (nombre: string) =>
    new Proxy(
      {},
      {
        get: (_, metodo: string) =>
          vi.fn(async (argumentos: unknown) => {
            registro.push({ llamada: `${nombre}.${metodo}`, argumentos });
            if (nombre === "business" && metodo === "findUnique") {
              return opciones.negocioExistente ?? null;
            }
            if (nombre === "business" && metodo === "findMany") {
              return opciones.negociosEncontrados ?? [];
            }
            if (nombre === "user" && metodo === "findUnique") {
              return opciones.usuarioExistente ? { id: "u1" } : null;
            }
            if (nombre === "whatsappOptOut" && metodo === "findMany") {
              return opciones.bajasExistentes ?? [];
            }
            return { count: 0 };
          }),
      }
    );
  const modelos = [
    "business",
    "user",
    "agent",
    "service",
    "professional",
    "professionalService",
    "call",
    "booking",
    "lead",
    "clienteDelNegocio",
    "clientConversation",
    "claveTemporal",
    "sentMessage",
    "inboundMessage",
    "whatsappOptOut",
  ];
  const falso: Record<string, unknown> = Object.fromEntries(
    modelos.map((m) => [m, modelo(m)])
  );
  falso.$transaction = async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(falso);
  falso.$queryRaw = async () => {
    registro.push({ llamada: "$queryRaw", argumentos: null });
    return [{ base: opciones.baseDeDatos ?? "botbook" }];
  };
  return {
    prisma: falso as unknown as ClienteDeSiembra,
    llamadas: () => registro.map((r) => r.llamada),
    de: (nombre: string) => registro.filter((r) => r.llamada === nombre),
  };
}

const depsDeEscritura = {
  ahora: () => AHORA,
  hashDeContrasenaAleatoria: vi.fn(async () => "hash-falso"),
};

describe("aplicarPlan", () => {
  it("borra lo de dentro, upsert del negocio por su id fijo y vuelve a crear todo", async () => {
    const { prisma, llamadas, de } = prismaFalso();
    const p = plan("peluqueria-cambios");
    await aplicarPlan(prisma, p, depsDeEscritura);

    const orden = llamadas();
    // Lo viejo se va antes de crear nada.
    expect(orden.indexOf("call.deleteMany")).toBeLessThan(
      orden.indexOf("business.upsert")
    );
    expect(orden.indexOf("business.upsert")).toBeLessThan(
      orden.indexOf("service.createMany")
    );
    // Las llamadas existen antes que las citas que cuelgan de ellas.
    expect(orden.indexOf("call.createMany")).toBeLessThan(
      orden.indexOf("booking.createMany")
    );

    const upsert = de("business.upsert")[0]!.argumentos as {
      where: { id: string };
      create: { id: string };
    };
    expect(upsert.where.id).toBe(p.id);
    expect(upsert.create.id).toBe(p.id);

    // Todo lo que borra va acotado a este negocio.
    const borrados = [
      ...de("call.deleteMany"),
      ...de("service.deleteMany"),
      ...de("professional.deleteMany"),
      ...de("agent.deleteMany"),
      ...de("clienteDelNegocio.deleteMany"),
    ];
    for (const borrado of borrados) {
      expect(JSON.stringify(borrado.argumentos)).toContain(p.id);
    }

    const llamadasCreadas = (
      de("call.createMany")[0]!.argumentos as {
        data: Array<{ businessId: string; status: string }>;
      }
    ).data;
    expect(llamadasCreadas).toHaveLength(p.llamadas.length);
    expect(llamadasCreadas.every((l) => l.businessId === p.id)).toBe(true);
    expect(llamadasCreadas.every((l) => l.status === "COMPLETED")).toBe(true);
    const citasCreadas = (
      de("booking.createMany")[0]!.argumentos as {
        data: Array<{ callId: string; smsConsent: boolean }>;
      }
    ).data;
    expect(citasCreadas).toHaveLength(p.citas.length);
    // Cada cita cuelga de una llamada sembrada.
    const callIds = new Set(
      llamadasCreadas.map((l) => (l as { id?: string }).id)
    );
    expect(citasCreadas.every((c) => callIds.has(c.callId))).toBe(true);
  });

  it("crea el dueño con una contraseña aleatoria con hash la primera vez, y no la cambia después", async () => {
    const nuevo = prismaFalso();
    const hash = vi.fn(async () => "hash-aleatorio");
    await aplicarPlan(nuevo.prisma, plan("fisioterapia"), {
      ahora: () => AHORA,
      hashDeContrasenaAleatoria: hash,
    });
    expect(hash).toHaveBeenCalledOnce();
    const creado = nuevo.de("user.create")[0]!.argumentos as {
      data: {
        email: string;
        password: string;
        tokenVersion: number;
        businessId: string;
      };
    };
    expect(creado.data).toMatchObject({
      email: "lab-fisioterapia@alhabla.local",
      password: "hash-aleatorio",
      tokenVersion: 0,
      businessId: plan("fisioterapia").id,
    });

    const existente = prismaFalso({ usuarioExistente: true });
    const otroHash = vi.fn(async () => "otro");
    await aplicarPlan(existente.prisma, plan("fisioterapia"), {
      ahora: () => AHORA,
      hashDeContrasenaAleatoria: otroHash,
    });
    expect(otroHash).not.toHaveBeenCalled();
    expect(existente.de("user.create")).toHaveLength(0);
    expect(existente.de("user.update")).toHaveLength(1);
  });

  it("no pisa un negocio con ese id que no se llame «Lab · …»", async () => {
    const { prisma, de } = prismaFalso({
      negocioExistente: { name: "Peluquería de una clienta" },
    });
    await expect(
      aplicarPlan(prisma, plan("peluqueria"), depsDeEscritura)
    ).rejects.toThrow(/no se toca/);
    expect(de("call.deleteMany")).toHaveLength(0);
    expect(de("business.upsert")).toHaveLength(0);
  });

  it("limpia la caché de voz del negocio, que guarda horario y ajustes una hora", async () => {
    const { prisma, de } = prismaFalso();
    await aplicarPlan(prisma, plan("peluqueria"), depsDeEscritura);
    expect(
      JSON.stringify(de("claveTemporal.deleteMany")[0]!.argumentos)
    ).toContain(`voice_config:${plan("peluqueria").id}`);
  });
});

describe("restablecerPlan", () => {
  it("borra citas y recados, repone las citas sembradas y no toca el negocio ni las llamadas", async () => {
    const { prisma, llamadas, de } = prismaFalso({
      negocioExistente: { name: "Lab · Peluquería (cambios y anulaciones)" },
    });
    const p = plan("peluqueria-cambios");
    await restablecerPlan(prisma, p, AHORA);

    const orden = llamadas();
    expect(orden).toContain("booking.deleteMany");
    expect(orden).toContain("lead.deleteMany");
    expect(orden).toContain("booking.createMany");
    expect(orden.indexOf("booking.deleteMany")).toBeLessThan(
      orden.indexOf("booking.createMany")
    );
    expect(orden).not.toContain("business.upsert");
    expect(orden).not.toContain("call.deleteMany");
    expect(orden).not.toContain("call.createMany");
    expect(
      (de("booking.createMany")[0]!.argumentos as { data: unknown[] }).data
    ).toHaveLength(p.citas.length);
    // El permiso de grabación vuelve al de la siembra.
    expect(de("call.updateMany").length).toBeGreaterThan(0);
  });

  it("en grabación deja las llamadas sin decidir y sin clientes que aceptaron", async () => {
    const { prisma, de, llamadas } = prismaFalso({
      negocioExistente: { name: "Lab · Peluquería (grabación)" },
    });
    await restablecerPlan(prisma, plan("peluqueria-grabacion"), AHORA);
    const actualizaciones = de("call.updateMany").map(
      (r) =>
        (r.argumentos as { data: { grabacionPermitida: boolean | null } }).data
    );
    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0]!.grabacionPermitida).toBeNull();
    expect(llamadas()).not.toContain("clienteDelNegocio.createMany");
  });

  it("falla si el negocio no está sembrado o no es de laboratorio", async () => {
    await expect(
      restablecerPlan(prismaFalso().prisma, plan("peluqueria"), AHORA)
    ).rejects.toThrow(/no está sembrado/);
    await expect(
      restablecerPlan(
        prismaFalso({ negocioExistente: { name: "Otro" } }).prisma,
        plan("peluqueria"),
        AHORA
      )
    ).rejects.toThrow(/no se toca/);
  });
});

describe("borrarSiembra y ponerBajas", () => {
  it("borra solo los negocios por sus ids fijos y las bajas de ficción", async () => {
    const ids = NEGOCIOS_DE_LABORATORIO.map((n) => n.id);
    const { prisma, de } = prismaFalso({
      negociosEncontrados: NEGOCIOS_DE_LABORATORIO.map((n) => ({
        id: n.id,
        name: n.nombre,
      })),
    });
    await borrarSiembra(prisma, ids);
    const borradoDeNegocios = de("business.deleteMany")[0]!.argumentos as {
      where: { id: { in: string[] } };
    };
    expect(borradoDeNegocios.where.id.in).toEqual(ids);
    const bajas = JSON.stringify(
      de("whatsappOptOut.deleteMany")[0]!.argumentos
    );
    expect(bajas).toContain("+15550100");
    expect(bajas).toContain(
      Object.values(TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO)[0]!.movilDelDueno
    );
    // Solo las bajas que puso la siembra (con su marca) de esos números:
    // una baja real que ya existía no se toca.
    expect(bajas).toContain(
      `"inboundMessageId":"${MARCA_DE_LAS_BAJAS_DE_LABORATORIO}"`
    );
  });

  it("no escribe nada si la conexión no es la base de dev", async () => {
    const { prisma, de } = prismaFalso({ baseDeDatos: "alhabla" });
    await expect(
      borrarSiembra(prisma, ["labpeluqueria0000000001"])
    ).rejects.toThrow(/no se escribe nada/);
    await expect(
      aplicarPlan(prisma, plan("peluqueria"), depsDeEscritura)
    ).rejects.toThrow(/no se escribe nada/);
    await expect(ponerBajas(prisma, AHORA)).rejects.toThrow(
      /no se escribe nada/
    );
    expect(de("business.deleteMany")).toHaveLength(0);
    expect(de("call.deleteMany")).toHaveLength(0);
    expect(de("whatsappOptOut.createMany")).toHaveLength(0);
  });

  it("no borra nada si algún id existe con un nombre que no es de laboratorio", async () => {
    const { prisma, de } = prismaFalso({
      negociosEncontrados: [
        { id: "labpeluqueria0000000001", name: "Una peluquería real" },
      ],
    });
    await expect(
      borrarSiembra(prisma, ["labpeluqueria0000000001"])
    ).rejects.toThrow(/no se borra nada/);
    expect(de("business.deleteMany")).toHaveLength(0);
  });

  it("las bajas se ponen con la marca de la siembra", async () => {
    const { prisma, de } = prismaFalso();
    expect(await ponerBajas(prisma, AHORA)).toBe(102);
    const args = de("whatsappOptOut.createMany")[0]!.argumentos as {
      data: Array<{
        phoneNumber: string;
        audience: string;
        keyword: string;
        inboundMessageId: string;
      }>;
    };
    expect(args.data).toHaveLength(102);
    expect(args.data.every((b) => b.keyword === "STOP")).toBe(true);
    expect(
      args.data.every(
        (b) => b.inboundMessageId === MARCA_DE_LAS_BAJAS_DE_LABORATORIO
      )
    ).toBe(true);
    // Los teléfonos que dictan los guiones también tienen baja.
    for (const dictado of TELEFONOS_DICTADOS_DE_LABORATORIO) {
      expect(args.data.map((b) => b.phoneNumber)).toContain(dictado);
    }
  });

  it("no duplica, reactiva las suyas revocadas y deja las ajenas vigentes", async () => {
    const { prisma, de } = prismaFalso({
      bajasExistentes: [
        {
          id: "ajena",
          phoneNumber: "+34600000001",
          audience: "owner",
          revokedAt: null,
          inboundMessageId: "msg-real",
        },
        {
          id: "nuestra",
          phoneNumber: "+15550100",
          audience: "client",
          revokedAt: new Date("2026-10-01T00:00:00Z"),
          inboundMessageId: MARCA_DE_LAS_BAJAS_DE_LABORATORIO,
        },
      ],
    });
    expect(await ponerBajas(prisma, AHORA)).toBe(101);
    const creadas = (
      de("whatsappOptOut.createMany")[0]!.argumentos as {
        data: Array<{ phoneNumber: string }>;
      }
    ).data.map((b) => b.phoneNumber);
    expect(creadas).toHaveLength(100);
    expect(creadas).not.toContain("+34600000001");
    expect(creadas).not.toContain("+15550100");
    const reactivadas = de("whatsappOptOut.updateMany")[0]!.argumentos as {
      where: { id: { in: string[] } };
      data: { revokedAt: null };
    };
    expect(reactivadas.where.id.in).toEqual(["nuestra"]);
    expect(reactivadas.data.revokedAt).toBeNull();
  });

  it("falla si un número tiene una baja revocada que no es de la siembra", async () => {
    const { prisma, de } = prismaFalso({
      bajasExistentes: [
        {
          id: "ajena",
          phoneNumber: "+34600000002",
          audience: "owner",
          revokedAt: new Date("2026-10-01T00:00:00Z"),
          inboundMessageId: "msg-real",
        },
      ],
    });
    await expect(ponerBajas(prisma, AHORA)).rejects.toThrow(
      /\+34600000002 \(owner\).*no los da de baja/
    );
    expect(de("whatsappOptOut.createMany")).toHaveLength(0);
  });
});
