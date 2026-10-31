import { prisma } from "../../../src/lib/prisma.js";
import { comprobarEntornoDeTest } from "../helpers/entornoDeTest.js";

/**
 * Lo común de los tests de integración de Alhabla Growth. `resetDb()` no toca
 * las tablas `growth_*`, así que cada fichero las vacía aquí, hijos antes que
 * padres.
 */
export async function limpiarGrowth(): Promise<void> {
  // Segunda barrera, por si alguien llama a esto sin pasar por setup.ts.
  comprobarEntornoDeTest();
  await prisma.$transaction([
    prisma.growthMedicion.deleteMany(),
    prisma.growthGestion.deleteMany(),
    prisma.growthDecision.deleteMany(),
    prisma.growthRevisionCumplimiento.deleteMany(),
    prisma.growthBorrador.deleteMany(),
    prisma.growthInvestigacion.deleteMany(),
    prisma.growthEnlaceEntrante.deleteMany(),
    prisma.growthOportunidad.deleteMany(),
    prisma.growthEjecucion.deleteMany(),
    prisma.growthFuente.deleteMany(),
    prisma.growthAfirmacion.deleteMany(),
    prisma.growthNicho.deleteMany(),
    prisma.growthCompetidorAnalisis.deleteMany(),
    prisma.growthCompetidor.deleteMany(),
    prisma.growthPagina.deleteMany(),
    prisma.growthAjuste.deleteMany(),
    prisma.growthTarea.deleteMany(),
    prisma.growthTokenAgente.deleteMany(),
  ]);
}

const DIA = 24 * 60 * 60 * 1000;
export const hace = (dias: number) => new Date(Date.now() - dias * DIA);
export const dentroDe = (dias: number) => new Date(Date.now() + dias * DIA);

export async function crearFuente() {
  return prisma.growthFuente.create({
    data: { id: "fuente_web", tipo: "web", nombre: "Búsqueda web" },
  });
}

let contador = 0;

export async function crearOportunidad(datos: {
  id: string;
  estado: Parameters<
    typeof prisma.growthOportunidad.create
  >[0]["data"]["estado"];
  retencionHasta?: Date;
  expiraEn?: Date | null;
  extracto?: string;
}) {
  contador += 1;
  return prisma.growthOportunidad.create({
    data: {
      id: datos.id,
      claveExterna: `clave-${datos.id}-${contador}`,
      fuenteId: "fuente_web",
      url: `https://${datos.id}.example.com/pagina`,
      dominio: `${datos.id}.example.com`,
      titulo: `Título de ${datos.id}`,
      extracto: datos.extracto ?? "Texto de una página de un tercero.",
      objetivoPrincipal: "BACKLINKS",
      estado: datos.estado,
      retencionHasta: datos.retencionHasta ?? dentroDe(100),
      expiraEn: datos.expiraEn ?? null,
    },
  });
}

export async function crearBorrador(datos: {
  id: string;
  oportunidadId: string;
  estado: Parameters<typeof prisma.growthBorrador.create>[0]["data"]["estado"];
  afirmaciones?: string[];
  version?: number;
}) {
  return prisma.growthBorrador.create({
    data: {
      id: datos.id,
      oportunidadId: datos.oportunidadId,
      version: datos.version ?? 1,
      tipo: "email",
      objetivo: "BACKLINKS",
      texto: "Hola, soy el fundador de Alhabla.",
      afirmaciones: datos.afirmaciones ?? [],
      estado: datos.estado,
    },
  });
}
