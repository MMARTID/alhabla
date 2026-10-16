import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { Writable } from "node:stream";
import { contactoRoutes } from "../../../src/modules/contacto/routes.js";
import { enqueueEmailJob } from "../../../src/lib/cloudTasks.js";

vi.mock("../../../src/lib/cloudTasks.js", () => ({
  enqueueEmailJob: vi.fn(),
}));

const mockedEnqueueEmailJob = vi.mocked(enqueueEmailJob);

const SOLICITUD = {
  nombre: "Lucía Pérez",
  email: "Lucia.Perez@Ejemplo.es ",
  telefono: "+34 600 12 34 56",
  negocio: "Peluquería Lucía",
  sedes: "2-4",
  mensaje: "Tenemos dos locales y queremos saber si el agente sirve para los dos.",
};

/** Instancia con el logger capturado, para mirar qué se escribe. */
async function crearApp(opciones: { conLimite?: boolean } = {}) {
  const lineas: string[] = [];
  const app = Fastify({
    logger: {
      level: "info",
      stream: new Writable({
        write(fragmento, _codificacion, listo) {
          lineas.push(fragmento.toString());
          listo();
        },
      }),
    },
  });
  if (opciones.conLimite) {
    const { default: rateLimit } = await import("@fastify/rate-limit");
    await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  }
  await app.register(contactoRoutes);
  await app.ready();
  return { app, logs: () => lineas.join("") };
}

function enviar(app: Awaited<ReturnType<typeof crearApp>>["app"], body: unknown) {
  return app.inject({ method: "POST", url: "/contacto", payload: body as object });
}

describe("POST /contacto", () => {
  beforeEach(() => {
    mockedEnqueueEmailJob.mockReset();
    mockedEnqueueEmailJob.mockResolvedValue(undefined);
  });

  it("avisa al equipo en hola@alhabla.ai con los datos de la solicitud", async () => {
    const { app } = await crearApp();

    const respuesta = await enviar(app, SOLICITUD);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ ok: true });
    expect(mockedEnqueueEmailJob).toHaveBeenCalledTimes(1);
    const [correo, idDeTarea] = mockedEnqueueEmailJob.mock.calls[0];
    expect(correo.fromAlias).toBe("support");
    expect(correo.toAddress).toBe("hola@alhabla.ai");
    expect(correo.html).toContain("Lucía Pérez");
    // El email se normaliza: sin espacios y en minúsculas.
    expect(correo.html).toContain("mailto:lucia.perez@ejemplo.es");
    expect(correo.html).toContain("Peluquería Lucía");
    expect(correo.html).toContain("2–4 sedes");
    expect(correo.html).toContain("tel:+34600123456");
    expect(correo.html).toContain("queremos saber si el agente sirve");
    // Cada solicitud es una tarea distinta y su id, la clave de envío único.
    expect(idDeTarea).toMatch(/^contacto-[0-9a-f-]{36}$/);
  });

  it("no pone datos personales en el asunto del correo", async () => {
    const { app } = await crearApp();

    await enviar(app, SOLICITUD);

    const [correo] = mockedEnqueueEmailJob.mock.calls[0];
    expect(correo.subject).toBe("Contacto desde la web · 2–4 sedes");
  });

  it("no escribe nombre, email, teléfono, negocio ni mensaje en los logs", async () => {
    const { app, logs } = await crearApp();

    await enviar(app, SOLICITUD);

    const escrito = logs();
    expect(escrito).toContain("[Contacto] Solicitud recibida");
    for (const dato of ["Lucía", "lucia.perez", "600 12", "600123456", "Peluquería", "dos locales"]) {
      expect(escrito).not.toContain(dato);
    }
  });

  it("escapa el HTML de lo que escribe el visitante", async () => {
    const { app } = await crearApp();

    await enviar(app, {
      ...SOLICITUD,
      mensaje: '<a href="https://malo.example">pincha</a>',
    });

    const [correo] = mockedEnqueueEmailJob.mock.calls[0];
    expect(correo.html).not.toContain('<a href="https://malo.example">');
    expect(correo.html).toContain("&lt;a href=&quot;https://malo.example&quot;&gt;");
  });

  it("acepta teléfono y mensaje vacíos", async () => {
    const { app } = await crearApp();

    const respuesta = await enviar(app, {
      ...SOLICITUD,
      telefono: "",
      mensaje: "   ",
      sedes: "franquicia",
    });

    expect(respuesta.statusCode).toBe(200);
    const [correo] = mockedEnqueueEmailJob.mock.calls[0];
    expect(correo.html).toContain("Franquicia");
    expect(correo.html).not.toContain("tel:");
  });

  it("rechaza con 400 y mensajes en español lo que no vale", async () => {
    const { app } = await crearApp();

    const respuesta = await enviar(app, {
      ...SOLICITUD,
      nombre: " ",
      email: "no-es-un-email",
      telefono: "llámame",
      sedes: "muchas",
    });

    expect(respuesta.statusCode).toBe(400);
    const mensajes = (respuesta.json().error as Array<{ message: string }>).map(
      (error) => error.message
    );
    expect(mensajes).toEqual(
      expect.arrayContaining([
        "Escribe tu nombre.",
        "Escribe un email válido.",
        "Escribe un teléfono válido.",
        "Indica cuántas sedes tenéis.",
      ])
    );
    expect(mockedEnqueueEmailJob).not.toHaveBeenCalled();
  });

  it("pide los obligatorios cuando no llegan", async () => {
    const { app } = await crearApp();

    const respuesta = await enviar(app, {});

    expect(respuesta.statusCode).toBe(400);
    const campos = (respuesta.json().error as Array<{ path: string[] }>).map(
      (error) => error.path[0]
    );
    expect(campos).toEqual(
      expect.arrayContaining(["nombre", "email", "negocio", "sedes"])
    );
    expect(campos).not.toContain("telefono");
    expect(campos).not.toContain("mensaje");
  });

  it("un teléfono con muy pocas cifras no vale", async () => {
    const { app } = await crearApp();

    const respuesta = await enviar(app, { ...SOLICITUD, telefono: "600 12" });

    expect(respuesta.statusCode).toBe(400);
  });

  it("si la trampa anti-bots llega rellena, contesta bien y no manda nada", async () => {
    const { app, logs } = await crearApp();

    const respuesta = await enviar(app, {
      ...SOLICITUD,
      sitioWeb: "https://spam.example",
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ ok: true });
    expect(mockedEnqueueEmailJob).not.toHaveBeenCalled();
    expect(logs()).toContain("trampa anti-bots");
  });

  it("si el correo no sale, devuelve 502 con el buzón para escribir a mano", async () => {
    mockedEnqueueEmailJob.mockRejectedValue(new Error("Zoho caído"));
    const { app, logs } = await crearApp();

    const respuesta = await enviar(app, SOLICITUD);

    expect(respuesta.statusCode).toBe(502);
    expect(respuesta.json().error).toContain("hola@alhabla.ai");
    const escrito = logs();
    expect(escrito).toContain("[Contacto] No se pudo encolar el aviso al equipo");
    expect(escrito).toContain("Zoho caído");
    expect(escrito).not.toContain("lucia.perez");
  });

  it("limita a 5 envíos cada 10 minutos por visitante, aunque el global sea más alto", async () => {
    const { app } = await crearApp({ conLimite: true });

    const estados: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      estados.push((await enviar(app, SOLICITUD)).statusCode);
    }

    expect(estados).toEqual([200, 200, 200, 200, 200, 429]);
    expect(mockedEnqueueEmailJob).toHaveBeenCalledTimes(5);
  });
});
