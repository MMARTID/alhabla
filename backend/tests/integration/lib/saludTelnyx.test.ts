import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import {
  anotarLecturaDeSalud,
  reiniciarRachaBuena,
} from "../../../src/lib/saludTelnyx.js";
import { resetDb } from "../helpers/db.js";

// Contra Postgres real: las rachas del health-check de Telnyx en la fila
// única de salud_telnyx. Lo que importa es que una entrega repetida del
// Scheduler (mismo tick) no cuente dos veces, ni siquiera a la vez.
describe("rachas del health-check de Telnyx (salud_telnyx)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("dos lecturas malas de ticks distintos hacen racha; una sana la corta", async () => {
    expect(await anotarLecturaDeSalud(false, 1000n)).toEqual({
      malas: 1,
      buenas: 0,
    });
    expect(await anotarLecturaDeSalud(false, 1120n)).toEqual({
      malas: 2,
      buenas: 0,
    });
    expect(await anotarLecturaDeSalud(true, 1240n)).toEqual({
      malas: 0,
      buenas: 1,
    });
    expect(await anotarLecturaDeSalud(true, 1360n)).toEqual({
      malas: 0,
      buenas: 2,
    });
    expect(await anotarLecturaDeSalud(false, 1480n)).toEqual({
      malas: 1,
      buenas: 0,
    });
  });

  it("el mismo tick otra vez (o uno atrasado) no cuenta ni cambia nada", async () => {
    await anotarLecturaDeSalud(false, 1000n);
    expect(await anotarLecturaDeSalud(false, 1000n)).toBeNull();
    expect(await anotarLecturaDeSalud(true, 1000n)).toBeNull();
    expect(await anotarLecturaDeSalud(false, 880n)).toBeNull();
    const fila = await prisma.saludTelnyx.findUniqueOrThrow({
      where: { id: "telnyx" },
    });
    expect(fila).toMatchObject({ malas: 1, buenas: 0, ultimoTick: 1000n });
  });

  it("cinco entregas simultáneas del mismo tick: cuenta una, también con la tabla vacía", async () => {
    const primeras = await Promise.all(
      Array.from({ length: 5 }, () => anotarLecturaDeSalud(false, 1000n))
    );
    expect(primeras.filter((r) => r !== null)).toEqual([
      { malas: 1, buenas: 0 },
    ]);

    const segundas = await Promise.all(
      Array.from({ length: 5 }, () => anotarLecturaDeSalud(false, 1120n))
    );
    expect(segundas.filter((r) => r !== null)).toEqual([
      { malas: 2, buenas: 0 },
    ]);
  });

  it("una racha cuya última lectura es de hace más de media hora empieza de nuevo", async () => {
    await anotarLecturaDeSalud(false, 1000n);
    await prisma.saludTelnyx.update({
      where: { id: "telnyx" },
      data: { actualizadoEn: new Date(Date.now() - 31 * 60_000) },
    });
    expect(await anotarLecturaDeSalud(false, 2000n)).toEqual({
      malas: 1,
      buenas: 0,
    });

    // A los 29 minutos sí sigue.
    await prisma.saludTelnyx.update({
      where: { id: "telnyx" },
      data: { actualizadoEn: new Date(Date.now() - 29 * 60_000) },
    });
    expect(await anotarLecturaDeSalud(false, 3000n)).toEqual({
      malas: 2,
      buenas: 0,
    });
  });

  it("reiniciarRachaBuena pone a cero la buena sin tocar el tick", async () => {
    for (const tick of [1000n, 1120n, 1240n]) {
      await anotarLecturaDeSalud(true, tick);
    }
    await reiniciarRachaBuena();
    const fila = await prisma.saludTelnyx.findUniqueOrThrow({
      where: { id: "telnyx" },
    });
    expect(fila).toMatchObject({ buenas: 0, malas: 0, ultimoTick: 1240n });
    expect(await anotarLecturaDeSalud(true, 1360n)).toEqual({
      malas: 0,
      buenas: 1,
    });
  });
});
