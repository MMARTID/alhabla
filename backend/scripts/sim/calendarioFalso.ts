// Mando del calendario falso de backend-sim (PLAN-AGENDA-PRINCIPAL.md, «Cómo se
// comprueba»). Lo lanza el MCP de desarrollo (`calendario_falso`) DENTRO del
// contenedor alhabla_backend_sim, para que use el mismo código, la misma BD y
// el mismo CALENDARIOS_FALSOS que el backend que atiende las llamadas
// simuladas:
//
//   docker exec alhabla_backend_sim npx tsx scripts/sim/calendarioFalso.ts <acción> '<json>'
//
// Escribe el resultado como JSON en la última línea, tras `@@RESULTADO@@`.
// Solo toca conexiones con credenciales `falso:`: nunca un calendario real.
import { prisma } from "../../src/lib/prisma.js";
import {
  calendariosFalsosActivos,
  guardarCalendarioFalso,
  leerCalendarioFalso,
  marcaDeCredencialFalsa,
  type EstadoDelCalendarioFalso,
} from "../../src/adapters/calendar/falso/calendarioFalso.js";
import type { CalendarProviderId } from "../../src/adapters/calendar/CalendarProvider.js";
import {
  guardarConexionDeCalendario,
  quitarCalendarioConectado,
  resolverConexionDeCalendario,
  SELECT_CONEXION_DE_CALENDARIO,
} from "../../src/modules/calendar/conexion.js";
import {
  sincronizarCopiaDeLaCita,
  volcarAgendaAlCalendario,
} from "../../src/modules/calendar/copiaDeLaCita.js";
import { recordarCalendarioDesconectado } from "../../src/modules/whatsapp/alertas.js";

const SEPARADOR = "@@RESULTADO@@";

type Entrada = {
  businessId?: string;
  bookingId?: string;
  proveedor?: CalendarProviderId;
  estado?: EstadoDelCalendarioFalso;
  eventId?: string;
  inicio?: string;
  fin?: string;
  duracionMinutos?: number;
  titulo?: string;
};

const marcaDelNegocio = (businessId: string) => `falso:${businessId}`;

function exigir<T>(valor: T | undefined, nombre: string): T {
  if (valor === undefined || valor === null || valor === "") {
    throw new Error(`Falta «${nombre}».`);
  }
  return valor;
}

/** La conexión activa del negocio, solo si es falsa. */
async function conexionFalsa(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: SELECT_CONEXION_DE_CALENDARIO,
  });
  if (!business) throw new Error(`No existe el negocio ${businessId}.`);
  const fila = business.calendarConnections.find(
    (f) => f.provider === (business.calendarProvider ?? "google")
  );
  const conexion = resolverConexionDeCalendario(business);
  const marca = marcaDeCredencialFalsa(conexion.credentials);
  return { business, fila, conexion, marca };
}

async function exigirConexionFalsa(businessId: string): Promise<string> {
  const { fila, marca } = await conexionFalsa(businessId);
  if (!fila) {
    throw new Error(
      "El negocio no tiene calendario conectado: primero «conectar»."
    );
  }
  // Una fila revocada no tiene credenciales, pero sigue siendo la falsa si
  // el calendario falso del negocio existe.
  return marca ?? marcaDelNegocio(businessId);
}

async function estadoCompleto(businessId: string) {
  const { business, fila, conexion, marca } = await conexionFalsa(businessId);
  const calendario = await leerCalendarioFalso(
    marca ?? marcaDelNegocio(businessId)
  );
  return {
    conexion: fila
      ? {
          proveedor: fila.provider,
          conectada: fila.connected,
          credenciales: conexion.credentials ? "falsas" : "ninguna",
          desconectadaEn: fila.disconnectedAt,
          ultimoError: fila.lastError,
        }
      : null,
    proveedorActivo: business.calendarProvider,
    calendarioFalso: calendario,
  };
}

async function ejecutar(accion: string, entrada: Entrada): Promise<unknown> {
  if (!calendariosFalsosActivos()) {
    throw new Error(
      "Este backend no tiene CALENDARIOS_FALSOS=1 (o es producción): solo funciona en backend-sim."
    );
  }
  switch (accion) {
    case "conectar": {
      const businessId = exigir(entrada.businessId, "businessId");
      const proveedor = entrada.proveedor ?? "google";
      const marca = marcaDelNegocio(businessId);
      const calendario = await leerCalendarioFalso(marca);
      await guardarCalendarioFalso(marca, { ...calendario, estado: "ok" });
      // El camino real de conectar: guarda la fila, invalida la caché de voz
      // y encola el volcado de la agenda (en dev se ejecuta en línea).
      await guardarConexionDeCalendario(businessId, {
        provider: proveedor,
        credenciales:
          proveedor === "caldav"
            ? {
                provider: "caldav",
                serverUrl: "https://calendario-falso.invalid/",
                username: "falso",
                appPassword: marca,
              }
            : { provider: proveedor, refreshToken: marca },
        calendarId: "primary",
        conectado: true,
        userEmail: `${proveedor}@calendario-falso.invalid`,
      });
      return estadoCompleto(businessId);
    }
    case "estado": {
      const businessId = exigir(entrada.businessId, "businessId");
      if (entrada.estado) {
        const marca = await exigirConexionFalsa(businessId);
        const calendario = await leerCalendarioFalso(marca);
        await guardarCalendarioFalso(marca, {
          ...calendario,
          estado: entrada.estado,
        });
      }
      return estadoCompleto(businessId);
    }
    case "apuntar": {
      const businessId = exigir(entrada.businessId, "businessId");
      const marca = await exigirConexionFalsa(businessId);
      const inicio = new Date(exigir(entrada.inicio, "inicio"));
      const fin = entrada.fin
        ? new Date(entrada.fin)
        : new Date(inicio.getTime() + (entrada.duracionMinutos ?? 60) * 60_000);
      const calendario = await leerCalendarioFalso(marca);
      const id = `amano${Date.now().toString(36)}`;
      calendario.eventos.push({
        id,
        summary: entrada.titulo ?? "Apuntado a mano",
        description: "Evento apuntado a mano en el calendario falso.",
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        origen: "a_mano",
      });
      await guardarCalendarioFalso(marca, calendario);
      return { eventId: id, ...(await estadoCompleto(businessId)) };
    }
    case "mover":
    case "borrar": {
      const businessId = exigir(entrada.businessId, "businessId");
      const eventId = exigir(entrada.eventId, "eventId");
      const marca = await exigirConexionFalsa(businessId);
      const calendario = await leerCalendarioFalso(marca);
      const evento = calendario.eventos.find((e) => e.id === eventId);
      if (!evento) throw new Error(`No hay ningún evento ${eventId}.`);
      if (accion === "borrar") {
        calendario.eventos = calendario.eventos.filter((e) => e.id !== eventId);
      } else {
        const inicio = new Date(exigir(entrada.inicio, "inicio"));
        const duracion =
          new Date(evento.fin).getTime() - new Date(evento.inicio).getTime();
        evento.inicio = inicio.toISOString();
        evento.fin = entrada.fin
          ? new Date(entrada.fin).toISOString()
          : new Date(inicio.getTime() + duracion).toISOString();
      }
      await guardarCalendarioFalso(marca, calendario);
      return estadoCompleto(businessId);
    }
    case "copiar": {
      // Lo que haría el job ahora mismo (en dev, los reintentos programados
      // a futuro solo dejan constancia en el log).
      const citas = entrada.bookingId
        ? [{ id: entrada.bookingId, copiaIntentos: 0 }]
        : await prisma.booking.findMany({
            where: {
              call: { businessId: exigir(entrada.businessId, "businessId") },
              copiaEnCalendario: "pendiente",
            },
            select: { id: true, copiaIntentos: true },
          });
      const resultados = [];
      for (const cita of citas) {
        resultados.push({
          bookingId: cita.id,
          resultado: await sincronizarCopiaDeLaCita({
            bookingId: cita.id,
            attempt: cita.copiaIntentos + 1,
          }),
        });
      }
      return { resultados };
    }
    case "volcar":
      return volcarAgendaAlCalendario({
        businessId: exigir(entrada.businessId, "businessId"),
      });
    case "recordar": {
      const businessId = exigir(entrada.businessId, "businessId");
      const { fila } = await conexionFalsa(businessId);
      if (!fila?.disconnectedAt) {
        throw new Error("El calendario del negocio no está desconectado.");
      }
      return recordarCalendarioDesconectado({
        businessId,
        provider: fila.provider,
        desconectadoEn: new Date(fila.disconnectedAt).toISOString(),
      });
    }
    case "quitar": {
      const businessId = exigir(entrada.businessId, "businessId");
      await exigirConexionFalsa(businessId);
      await quitarCalendarioConectado(businessId);
      await guardarCalendarioFalso(marcaDelNegocio(businessId), {
        estado: "ok",
        eventos: [],
      });
      return estadoCompleto(businessId);
    }
    default:
      throw new Error(
        `Acción desconocida «${accion}»: conectar, estado, apuntar, mover, borrar, copiar, volcar, recordar o quitar.`
      );
  }
}

const [accion = "", json = "{}"] = process.argv.slice(2);
try {
  const resultado = await ejecutar(accion, JSON.parse(json) as Entrada);
  console.log(`${SEPARADOR}${JSON.stringify({ ok: true, resultado })}`);
} catch (error) {
  console.log(
    `${SEPARADOR}${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}`
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
