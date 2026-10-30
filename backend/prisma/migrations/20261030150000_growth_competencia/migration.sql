-- AlterTable
ALTER TABLE "growth_competidores" ADD COLUMN     "analisisSolicitadoEn" TIMESTAMP(3),
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'por_analizar',
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'repo',
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "growth_competidor_analisis" (
    "id" TEXT NOT NULL,
    "competidorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "resumen" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "ejecucionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "revisadoEn" TIMESTAMP(3),
    "notaDeRevision" TEXT,

    CONSTRAINT "growth_competidor_analisis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growth_competidor_analisis_competidorId_creadoEn_idx" ON "growth_competidor_analisis"("competidorId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "growth_competidor_analisis_competidorId_version_key" ON "growth_competidor_analisis"("competidorId", "version");

-- AddForeignKey
ALTER TABLE "growth_competidor_analisis" ADD CONSTRAINT "growth_competidor_analisis_competidorId_fkey" FOREIGN KEY ("competidorId") REFERENCES "growth_competidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
