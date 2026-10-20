import { describe, it, expect } from "vitest";
import { textoDeAusencia, textoDeAusenciaEnElDia, tramoDeAusenciaEnElDia } from "@/lib/ausencias";

const MADRID = "Europe/Madrid";
// 9 y 10 de noviembre de 2026 en Madrid (CET, UTC+1), días enteros.
const DOS_DIAS = { startsAt: "2026-11-08T23:00:00.000Z", endsAt: "2026-11-10T23:00:00.000Z" };
const MANANA = { startsAt: "2026-11-09T08:00:00.000Z", endsAt: "2026-11-09T13:00:00.000Z" };

describe("tramoDeAusenciaEnElDia", () => {
  it("cubre los días enteros de una ausencia larga y no cuenta el día siguiente (fin exclusivo)", () => {
    expect(tramoDeAusenciaEnElDia(DOS_DIAS, "2026-11-09", MADRID)).toEqual({ desde: 0, hasta: 1440 });
    expect(tramoDeAusenciaEnElDia(DOS_DIAS, "2026-11-10", MADRID)).toEqual({ desde: 0, hasta: 1440 });
    expect(tramoDeAusenciaEnElDia(DOS_DIAS, "2026-11-08", MADRID)).toBeNull();
    expect(tramoDeAusenciaEnElDia(DOS_DIAS, "2026-11-11", MADRID)).toBeNull();
  });

  it("recorta un tramo con horas a la hora local del negocio", () => {
    expect(tramoDeAusenciaEnElDia(MANANA, "2026-11-09", MADRID)).toEqual({ desde: 540, hasta: 840 });
    expect(tramoDeAusenciaEnElDia(MANANA, "2026-11-10", MADRID)).toBeNull();
  });

  it("una ausencia que cruza la medianoche se parte en el día de cada lado", () => {
    const noche = { startsAt: "2026-11-09T21:00:00.000Z", endsAt: "2026-11-10T07:00:00.000Z" };
    expect(tramoDeAusenciaEnElDia(noche, "2026-11-09", MADRID)).toEqual({ desde: 1320, hasta: 1440 });
    expect(tramoDeAusenciaEnElDia(noche, "2026-11-10", MADRID)).toEqual({ desde: 0, hasta: 480 });
  });
});

describe("textos de ausencia", () => {
  it("dice el tramo del día en lenguaje del dueño", () => {
    expect(textoDeAusenciaEnElDia({ desde: 0, hasta: 1440 })).toBe("todo el día");
    expect(textoDeAusenciaEnElDia({ desde: 540, hasta: 840 })).toBe("de 09:00 a 14:00");
    expect(textoDeAusenciaEnElDia({ desde: 960, hasta: 1440 })).toBe("desde las 16:00");
    expect(textoDeAusenciaEnElDia({ desde: 0, hasta: 840 })).toBe("hasta las 14:00");
  });

  it("describe días enteros, un tramo con horas y los cambios de mes", () => {
    expect(textoDeAusencia(DOS_DIAS, MADRID)).toBe("del 9 al 10 de noviembre");
    expect(textoDeAusencia({ startsAt: DOS_DIAS.startsAt, endsAt: "2026-11-09T23:00:00.000Z" }, MADRID)).toBe(
      "el 9 de noviembre"
    );
    expect(textoDeAusencia(MANANA, MADRID)).toBe("el 9 de noviembre de 09:00 a 14:00");
    expect(textoDeAusencia({ startsAt: "2026-10-29T23:00:00.000Z", endsAt: "2026-11-02T23:00:00.000Z" }, MADRID)).toBe(
      "del 30 de octubre al 2 de noviembre"
    );
  });
});
