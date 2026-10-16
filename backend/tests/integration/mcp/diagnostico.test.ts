import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createTestBusiness, createTestCall } from "../helpers/fixtures.js";
import { resumenDeNegocio } from "../../../mcp/resumenDeNegocio.js";
import { saludDeLlamadas } from "../../../mcp/saludDeLlamadas.js";
import { trazaDeLlamada } from "../../../mcp/trazaDeLlamada.js";

// El SQL de las herramientas de diagnóstico, contra el Postgres real
// (alhabla_test, con todas las migraciones): enums, joins por calls y
// la zona horaria de los días solo se prueban de verdad con un Postgres.
const url = process.env.DATABASE_URL!;

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000);

beforeEach(async () => {
  await resetDb();
});

describe("saludDeLlamadas (integración)", () => {
  it("marca cada pieza que falta, cuenta estados y deja fuera chats y simuladas", async () => {
    const negocio = await createTestBusiness();
    const otro = await createTestBusiness();

    // Completa y entera: sin problemas.
    const buena = await createTestCall(negocio.id, {
      voiceProvider: "telnyx",
      status: "COMPLETED",
      startedAt: hace(60),
      endedAt: hace(55),
      durationSecs: 300,
      providerConversationId: "conv-1",
      providerCostCents: 4,
      outcome: "RESOLVED",
      grabacionPermitida: true,
    });
    await prisma.transcript.create({
      data: { callId: buena.id, fullText: "hola", messages: [] },
    });
    await prisma.recording.create({
      data: { callId: buena.id, externalUrl: "https://x", storageKey: "r2/key" },
    });

    // Acabó sin nada de lo que dejan los webhooks.
    const coja = await createTestCall(negocio.id, {
      voiceProvider: "telnyx",
      status: "COMPLETED",
      startedAt: hace(45),
      endedAt: hace(40),
      durationSecs: null,
      grabacionPermitida: true,
    });

    // Zombi: en curso sin moverse desde hace más de 20 minutos.
    const zombi = await createTestCall(negocio.id, {
      voiceProvider: "telnyx",
      status: "IN_PROGRESS",
      startedAt: hace(40),
    });
    await prisma.$executeRaw`UPDATE calls SET "updatedAt" = ${hace(30)} WHERE id = ${zombi.id}`;

    // Colgaron antes de que contestara el assistant (Telnyx cobró 0): sin
    // conversación ni transcripción, y no es un fallo.
    await createTestCall(negocio.id, {
      voiceProvider: "telnyx",
      status: "COMPLETED",
      startedAt: hace(35),
      endedAt: hace(34),
      durationSecs: 34,
      providerCostCents: 0,
    });

    // Fuera del recuento: chat de WhatsApp, simulada y otro negocio.
    await createTestCall(negocio.id, { callId: "whatsapp:chat:1", status: "IN_PROGRESS" });
    await createTestCall(negocio.id, { callId: "sim-mcp-1", status: "COMPLETED" });
    await createTestCall(otro.id, { status: "COMPLETED", startedAt: hace(30) });

    await prisma.booking.create({
      data: {
        callId: buena.id,
        programedAt: new Date(Date.now() + 86_400_000),
        numberPeople: 1,
        createdVia: "voice",
        externalEventId: null,
      },
    });
    await prisma.lead.create({
      data: {
        callId: coja.id,
        type: "pending_booking",
        data: { failureCode: "CALENDAR_UNAVAILABLE" },
      },
    });
    await prisma.voiceWebhookEvent.createMany({
      data: [
        { provider: "telnyx", eventId: "e1", type: "call.hangup", result: "error", lastError: "boom", attempts: 2 },
        { provider: "telnyx", eventId: "e2", type: "call.hangup", result: "success", attempts: 1 },
        { provider: "telnyx", eventId: "e3", type: "call.cost", result: "processing", claimedAt: hace(30), attempts: 1 },
        { provider: "telnyx", eventId: "e4", type: "call.cost", result: "processing", claimedAt: hace(1), attempts: 1 },
      ],
    });

    const salud = await saludDeLlamadas(url, {
      desde: "1d",
      businessId: negocio.id,
    });

    const llamadas = salud.dias.reduce((total, dia) => total + dia.llamadas, 0);
    expect(llamadas).toBe(4);
    const problemas = salud.dias.reduce<Record<string, number>>((suma, dia) => {
      for (const [nombre, n] of Object.entries(dia.problemas)) {
        suma[nombre] = (suma[nombre] ?? 0) + (n ?? 0);
      }
      return suma;
    }, {});
    expect(problemas).toEqual({
      zombi_abierta: 1,
      sin_conversacion: 1,
      sin_duracion: 1,
      sin_coste: 1,
      sin_resultado: 1,
    });
    expect(salud.ejemplos?.map((e) => e.id).sort()).toEqual(
      [coja.id, zombi.id].sort()
    );
    expect(salud.citasPorCanal).toEqual([
      { canal: "voice", creadas: "1", canceladas: "0", sinEventoEnCalendario: "1" },
    ]);
    expect(salud.reservasPendientesPorCodigo).toEqual([
      expect.objectContaining({ codigo: "CALENDAR_UNAVAILABLE", total: "1", sinResolver: "1" }),
    ]);
    // El que está procesándose ahora mismo (e4) no es un problema.
    expect(
      salud.webhooksQueNoAcabaronBien.map((w) => [w.tipo, w.resultado, w.n])
    ).toEqual(
      expect.arrayContaining([
        ["call.hangup", "error", "1"],
        ["call.cost", "processing_colgado", "1"],
      ])
    );
    expect(salud.webhooksQueNoAcabaronBien).toHaveLength(2);
  });

  it("el día va en hora de Madrid: las 23:30 UTC de un día de verano ya es el siguiente", async () => {
    const negocio = await createTestBusiness();
    await createTestCall(negocio.id, {
      status: "COMPLETED",
      startedAt: new Date("2026-07-14T23:30:00Z"),
      endedAt: new Date("2026-07-14T23:35:00Z"),
      durationSecs: 300,
    });
    const salud = await saludDeLlamadas(url, {
      desde: "2026-07-14T00:00:00Z",
      businessId: negocio.id,
      ejemplos: 0,
    });
    expect(salud.dias.map((d) => d.dia)).toEqual(["2026-07-15"]);
  });
});

describe("trazaDeLlamada (integración)", () => {
  it("encuentra la llamada por su callId y trae cita, pendientes, piezas y solapadas", async () => {
    const negocio = await createTestBusiness();
    const profesional = await prisma.professional.create({
      data: { businessId: negocio.id, name: "Marta" },
    });
    const servicio = await prisma.service.create({
      data: { businessId: negocio.id, name: "Corte", durationMinutes: 30 },
    });
    const llamada = await createTestCall(negocio.id, {
      callId: "v3:traza",
      voiceProvider: "telnyx",
      status: "COMPLETED",
      startedAt: hace(30),
      endedAt: hace(25),
      fromNumber: "+34600111222",
    });
    // Se solapan con ella (también la de otro negocio: las peticiones a las
    // tools no dicen de quién son); la de después y el chat no cuentan.
    await createTestCall(negocio.id, { startedAt: hace(28), endedAt: hace(20) });
    const otro = await createTestBusiness();
    await createTestCall(otro.id, { startedAt: hace(28), endedAt: hace(20) });
    await createTestCall(otro.id, { startedAt: hace(10), endedAt: hace(5) });
    await createTestCall(otro.id, { callId: "whatsapp:chat:9", startedAt: hace(28) });

    await prisma.booking.create({
      data: {
        callId: llamada.id,
        programedAt: new Date(Date.now() + 86_400_000),
        numberPeople: 1,
        professionalId: profesional.id,
        serviceIds: [servicio.id],
        clientPhone: "+34600111222",
        externalCalendarProvider: "google",
        externalEventId: "evento-1",
      },
    });
    await prisma.lead.create({
      data: {
        callId: llamada.id,
        type: "pending_booking",
        data: { failureCode: "BOOKING_LOCK_TIMEOUT", startDateTime: "2026-10-20T10:00:00+02:00" },
      },
    });
    await prisma.transcript.create({
      data: { callId: llamada.id, fullText: "hola", messages: [{ role: "user", text: "hola" }] },
    });

    const traza = await trazaDeLlamada("dev", url, {
      llamada: "v3:traza",
      conLogs: false,
    });

    expect(traza.llamada).toMatchObject({
      id: llamada.id,
      estado: "COMPLETED",
      fromNumber: "+34••••••222",
    });
    expect(traza.cita).toMatchObject({
      profesional: "Marta",
      servicios: ["Corte"],
      externalEventId: "evento-1",
      clientPhone: "+34••••••222",
    });
    expect(traza.reservasPendientes).toEqual([
      expect.objectContaining({
        codigoDeFallo: "BOOKING_LOCK_TIMEOUT",
        horaPedida: "2026-10-20T10:00:00+02:00",
      }),
    ]);
    expect(traza).toMatchObject({
      transcripcion: { mensajes: 1, caracteres: 4 },
      grabacion: null,
      llamadasSolapadas: "2",
      logs: { omitidos: true },
    });
  });
});

describe("resumenDeNegocio (integración)", () => {
  it("resume un negocio sin sacar sus credenciales, con la actividad por calls", async () => {
    const negocio = await createTestBusiness({ name: "Barbería Única" });
    await createTestBusiness({ name: "Otra cosa" });
    await prisma.agent.create({
      data: {
        businessId: negocio.id,
        name: "Recepcionista",
        systemPrompt: "x",
        telnyxAssistantId: "assistant-1",
        telnyxSyncError: "falló",
      },
    });
    const llamada = await createTestCall(negocio.id, { startedAt: hace(60) });
    await prisma.booking.create({
      data: {
        callId: llamada.id,
        programedAt: new Date(Date.now() + 86_400_000),
        numberPeople: 1,
      },
    });

    const resumen = (await resumenDeNegocio(url, { buscar: "barbería" })) as {
      negocio: Record<string, unknown>;
      calendarios: Record<string, unknown>[];
      agentes: Record<string, unknown>[];
      actividad: Record<string, unknown>;
    };

    expect(resumen.negocio).toMatchObject({ id: negocio.id, nombre: "Barbería Única" });
    expect(resumen.calendarios).toEqual([
      expect.objectContaining({ proveedor: "google", conectado: true, tieneCredenciales: true }),
    ]);
    expect(JSON.stringify(resumen)).not.toContain("fake-refresh-token");
    expect(JSON.stringify(resumen)).not.toContain("aes-256-gcm");
    expect(resumen.agentes).toEqual([
      expect.objectContaining({ telnyxAssistantId: "assistant-1", errorDeSincronizacion: "falló" }),
    ]);
    expect(resumen.actividad).toMatchObject({
      llamadas30d: "1",
      citasCreadas30d: "1",
      citasPorDelante: "1",
    });
  });

  it("sin filtro lista todos los negocios", async () => {
    await createTestBusiness({ name: "A" });
    await createTestBusiness({ name: "B" });
    const resumen = (await resumenDeNegocio(url, {})) as { negocios: unknown[] };
    expect(resumen.negocios).toHaveLength(2);
  });
});
