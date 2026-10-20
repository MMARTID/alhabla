import { describe, expect, it } from "vitest";
import { MOMENTOS, PLANTILLAS } from "@/components/herramientas/plantillas-de-cita";
import { contarSms, rellenarCampos } from "@/components/herramientas/sms";

/**
 * Las plantillas de /herramientas/plantillas-recordatorio-de-cita prometen
 * SMS de un solo mensaje (160 caracteres en GSM-7) y fisioterapia sin
 * servicio (guía de la AEPD para el sector sanitario). Si alguien edita un
 * texto y se pasa, que falle aquí y no en la factura del cliente.
 */
describe("contarSms", () => {
  it("cuenta 160 en GSM-7 y cae a 70 con una vocal con tilde aguda", () => {
    expect(contarSms("a".repeat(160))).toMatchObject({ gsm7: true, mensajes: 1 });
    expect(contarSms("a".repeat(161)).mensajes).toBe(2);
    expect(contarSms("Mañana, ¿vienes? Café").gsm7).toBe(true);
    const conTilde = contarSms(`${"a".repeat(70)}á`);
    expect(conTilde).toMatchObject({ gsm7: false, fueraDeGsm7: ["á"], mensajes: 2 });
  });

  it("el euro cuenta doble", () => {
    expect(contarSms("10 €").caracteres).toBe(5);
  });
});

describe("rellenarCampos", () => {
  it("sustituye los campos con valor y deja a la vista los que no", () => {
    expect(rellenarCampos("{negocio}: el {día}", { negocio: "Sol" })).toBe("Sol: el {día}");
  });
});

describe("plantillas de cita", () => {
  for (const sector of PLANTILLAS) {
    for (const { id } of MOMENTOS) {
      const { whatsapp, sms } = sector.mensajes[id];

      it(`${sector.nombre} · ${id}: el SMS cabe en uno, sin tildes que lo partan`, () => {
        const cuenta = contarSms(rellenarCampos(sms, sector.ejemplo));
        expect(cuenta.fueraDeGsm7).toEqual([]);
        expect(cuenta.caracteres).toBeLessThanOrEqual(160);
        // El SMS no se puede contestar si sale con remitente alfanumérico.
        expect(sms).toContain("{teléfono}");
        expect(sms.startsWith("{negocio}")).toBe(true);
      });

      it(`${sector.nombre} · ${id}: dice quién escribe y no deja campos desconocidos`, () => {
        expect(whatsapp).toContain("{negocio}");
        const campos = [...`${whatsapp} ${sms}`.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
        for (const campo of campos) {
          expect(["nombre", "día", "hora", "servicio", "profesional", "negocio", "teléfono"]).toContain(campo);
        }
      });
    }
  }

  it("fisioterapia no menciona el servicio en ningún mensaje", () => {
    const fisio = PLANTILLAS.find((s) => s.id === "fisioterapia");
    expect(fisio).toBeDefined();
    for (const { whatsapp, sms } of Object.values(fisio!.mensajes)) {
      expect(`${whatsapp} ${sms}`).not.toContain("{servicio}");
    }
  });
});
