import type { Prisma } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";

/**
 * Lo común de los tests de integración de las correcciones de la 1b: filas
 * sueltas con el dominio, las fechas y los estados que cada caso necesita,
 * sin pasar por los servicios (que son lo que se prueba).
 */

const DIA = 24 * 60 * 60 * 1000;
export const hace = (dias: number) => new Date(Date.now() - dias * DIA);
export const dentroDe = (dias: number) => new Date(Date.now() + dias * DIA);

/** Un mensaje que pasa todas las reglas duras con la base de conocimiento vacía. */
export const TEXTO_QUE_CUMPLE =
  "Hola, soy el fundador de Alhabla, una recepcionista de IA para pequeños negocios. Hemos visto vuestro directorio y creemos que encaja con lo que ofrecéis. ¿Os interesaría incluirnos? Un saludo.";

/**
 * El mensaje que cumple las reglas, distinto de cualquier otro: la regla de
 * plantilla repetida compara grupos de tres palabras, así que cada semilla
 * añade palabras que no aparecen en ningún otro texto.
 */
export function textoUnico(semilla: string): string {
  const raras = Array.from({ length: 50 }, (_, i) => `zq${semilla}w${i}`);
  return `${TEXTO_QUE_CUMPLE} ${raras.join(" ")}`;
}

let contador = 0;

export async function asegurarFuente() {
  return prisma.growthFuente.upsert({
    where: { id: "fuente_web" },
    create: { id: "fuente_web", tipo: "web", nombre: "Búsqueda web" },
    update: {},
  });
}

export async function sembrarOportunidad(datos: {
  id: string;
  dominio?: string;
  estado: Prisma.GrowthOportunidadUncheckedCreateInput["estado"];
  expiraEn?: Date | null;
  titulo?: string;
  extracto?: string;
  motivoDescarte?: string | null;
  datos?: Prisma.InputJsonObject;
}) {
  contador += 1;
  const dominio = datos.dominio ?? `${datos.id}.ejemplo.com`;
  return prisma.growthOportunidad.create({
    data: {
      id: datos.id,
      claveExterna: `clave-${datos.id}-${contador}`,
      fuenteId: "fuente_web",
      url: `https://${dominio}/pagina-${contador}`,
      dominio,
      titulo: datos.titulo ?? `Título de ${datos.id}`,
      extracto: datos.extracto ?? "Texto de una página de un tercero.",
      objetivoPrincipal: "BACKLINKS",
      estado: datos.estado,
      motivoDescarte: datos.motivoDescarte ?? null,
      datos: datos.datos,
      expiraEn: datos.expiraEn ?? null,
      retencionHasta: dentroDe(100),
    },
  });
}

export async function sembrarBorrador(datos: {
  id: string;
  oportunidadId: string;
  estado: Prisma.GrowthBorradorUncheckedCreateInput["estado"];
  version?: number;
  texto?: string;
  asunto?: string | null;
  enlaceUrl?: string | null;
  creadoEn?: Date;
}) {
  return prisma.growthBorrador.create({
    data: {
      id: datos.id,
      oportunidadId: datos.oportunidadId,
      version: datos.version ?? 1,
      tipo: "email",
      objetivo: "BACKLINKS",
      asunto: datos.asunto ?? null,
      texto: datos.texto ?? textoUnico(datos.id.replace(/[^a-zA-Z0-9]/g, "")),
      enlaceUrl:
        datos.enlaceUrl === undefined
          ? "https://alhabla.ai/peluquerias?utm_source=listado"
          : datos.enlaceUrl,
      afirmaciones: [],
      estado: datos.estado,
      ...(datos.creadoEn ? { creadoEn: datos.creadoEn } : {}),
    },
  });
}

/** Una oportunidad con un borrador, en el mismo estado de pendiente de aprobar. */
export async function pendienteDeAprobar(id: string, dominio: string) {
  await sembrarOportunidad({ id, dominio, estado: "pendiente_aprobacion" });
  return sembrarBorrador({
    id: `b_${id}`,
    oportunidadId: id,
    estado: "pendiente_aprobacion",
  });
}

/** Una gestión ya hecha con un dominio hace `dias` días (para el enfriamiento y el tope). */
export async function gestionHecha(id: string, dominio: string, dias: number) {
  await sembrarOportunidad({ id, dominio, estado: "gestionada" });
  await sembrarBorrador({
    id: `b_${id}`,
    oportunidadId: id,
    estado: "gestionado",
  });
  return prisma.growthGestion.create({
    data: {
      borradorId: `b_${id}`,
      canal: "email",
      dominio,
      hechaEn: hace(dias),
      resultado: "pendiente",
    },
  });
}

export async function fijarTopeSemanal(tope: number) {
  await prisma.growthAjuste.upsert({
    where: { clave: "topeSemanal" },
    create: { clave: "topeSemanal", valor: tope },
    update: { valor: tope },
  });
}

/** Todo lo que cambia cuando una edición escribe algo: para probar que un 409 no escribió nada. */
export async function fotoDeLoEscrito() {
  const [borradores, oportunidades, revisiones, decisiones] = await Promise.all(
    [
      prisma.growthBorrador.findMany({ orderBy: { id: "asc" } }),
      prisma.growthOportunidad.findMany({ orderBy: { id: "asc" } }),
      prisma.growthRevisionCumplimiento.count(),
      prisma.growthDecision.count(),
    ]
  );
  return { borradores, oportunidades, revisiones, decisiones };
}
