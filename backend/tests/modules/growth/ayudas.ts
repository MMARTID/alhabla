import { vi } from "vitest";
import { hashDeToken } from "../../../src/modules/growth/tokens.js";

/**
 * Un `prisma` de mentira con todos los modelos de Growth. Se crea dentro de
 * `vi.hoisted` (el `vi.mock` de `lib/prisma.js` se eleva por encima de los
 * imports):
 *
 *   const { prismaMock } = await vi.hoisted(async () => {
 *     const { crearPrismaMock } = await import("./ayudas.js");
 *     return { prismaMock: crearPrismaMock() };
 *   });
 */
export function crearPrismaMock() {
  const modelo = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  });
  return {
    growthTokenAgente: modelo(),
    growthOportunidad: modelo(),
    growthInvestigacion: modelo(),
    growthBorrador: modelo(),
    growthRevisionCumplimiento: modelo(),
    growthDecision: modelo(),
    growthGestion: modelo(),
    growthAfirmacion: modelo(),
    growthCompetidor: modelo(),
    growthCompetidorAnalisis: modelo(),
    growthAjuste: modelo(),
    growthFuente: modelo(),
    growthNicho: modelo(),
    growthEjecucion: modelo(),
    growthTarea: modelo(),
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  };
}

export type PrismaMock = ReturnType<typeof crearPrismaMock>;

export const TOKEN = "gta_token-de-prueba";
export const ADMIN = "admin@alhabla.ai";

export function registroDeToken(cambios: Record<string, unknown> = {}) {
  return {
    id: "tok_1",
    nombre: "agente-semanal",
    hashToken: hashDeToken(TOKEN),
    alcances: ["leer", "escribir"],
    revocadoEn: null,
    ultimoUso: new Date(),
    ...cambios,
  };
}

export function comoAgente(token = TOKEN) {
  return { authorization: `Bearer ${token}` };
}

export function comoAdmin() {
  return { authorization: "Bearer id-token-de-google" };
}

export const DIA = 24 * 60 * 60 * 1000;
export const hace = (dias: number) => new Date(Date.now() - dias * DIA);
export const dentroDe = (dias: number) => new Date(Date.now() + dias * DIA);

export const TEXTO_DE_BORRADOR =
  "Hola, soy el fundador de Alhabla. Hemos hecho una recepcionista de IA para peluquerías que atiende las llamadas y reserva en el calendario del negocio. Si os encaja, nos gustaría aparecer en vuestro listado. Un saludo.";

export type OpcionesDeContexto = {
  afirmaciones?: unknown[];
  competidores?: { nombre: string; dominio: string }[];
  ajustes?: { clave: string; valor: unknown; actualizadoEn?: Date }[];
  textosDeOtras?: string[];
  textosDeLaMisma?: string[];
  gestionesDelDominio?: Date[];
  hechasEstaSemana?: number;
  aprobadasSinGestionar?: number;
  aprobadasDelDominio?: number;
};

/**
 * Responde todas las consultas de `contextoDeCumplimiento` (el borrador que
 * cumple todo, salvo que se diga otra cosa).
 */
export function prepararContexto(
  prisma: PrismaMock,
  opciones: OpcionesDeContexto = {}
) {
  prisma.growthAfirmacion.findMany.mockResolvedValue(
    opciones.afirmaciones ?? [
      {
        clave: "funcion.reserva_en_calendario",
        tipo: "funcion",
        texto: "Reserva en el calendario del negocio",
        valor: null,
      },
      {
        clave: "prohibida.proveedor",
        tipo: "prohibida",
        texto: "No se nombra al proveedor de telefonía",
        valor: { terminos: ["Telnyx"], palabrasEnteras: true },
      },
    ]
  );
  prisma.growthCompetidor.findMany.mockResolvedValue(
    opciones.competidores ?? []
  );
  prisma.growthAjuste.findMany.mockResolvedValue(
    (opciones.ajustes ?? []).map((a) => ({
      actualizadoEn: new Date(),
      ...a,
    }))
  );
  // Dos consultas distintas: los textos de OTRAS oportunidades (`oportunidadId:
  // { not }`) y los de la misma (`oportunidadId: "o1"`).
  prisma.growthBorrador.findMany.mockImplementation(
    async ({ where }: { where: { oportunidadId: unknown } }) =>
      (typeof where.oportunidadId === "object"
        ? (opciones.textosDeOtras ?? [])
        : (opciones.textosDeLaMisma ?? [])
      ).map((texto) => ({ texto, textoFinal: null }))
  );
  prisma.growthGestion.findMany.mockResolvedValue(
    (opciones.gestionesDelDominio ?? []).map((hechaEn) => ({ hechaEn }))
  );
  prisma.growthGestion.count.mockResolvedValue(opciones.hechasEstaSemana ?? 0);
  prisma.growthOportunidad.count.mockImplementation(
    async ({ where }: { where: { dominio?: string } }) =>
      where.dominio
        ? (opciones.aprobadasDelDominio ?? 0)
        : (opciones.aprobadasSinGestionar ?? 0)
  );
}
