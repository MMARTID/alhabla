-- PLAN-GROWTH.md, fase 1: tablas de Alhabla Growth. Aditiva: solo crea tipos, tablas e índices nuevos.

-- CreateEnum
CREATE TYPE "GrowthObjetivo" AS ENUM ('TRAFICO_MARCA', 'LEADS', 'BACKLINKS');

-- CreateEnum
CREATE TYPE "GrowthEstadoOportunidad" AS ENUM ('detectada', 'calificada', 'investigada', 'con_borrador', 'pendiente_aprobacion', 'aprobada', 'gestionada', 'conseguida', 'sin_respuesta', 'devuelta', 'bloqueada', 'descartada', 'caducada');

-- CreateEnum
CREATE TYPE "GrowthEstadoBorrador" AS ENUM ('borrador', 'bloqueado', 'pendiente_aprobacion', 'aprobado', 'gestionado', 'descartado');

-- CreateEnum
CREATE TYPE "GrowthTipoBorrador" AS ENUM ('email', 'formulario', 'ficha_directorio', 'texto_invitado');

-- CreateEnum
CREATE TYPE "GrowthEstadoNicho" AS ENUM ('activo', 'candidato', 'descartado');

-- CreateTable
CREATE TABLE "growth_fuentes" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,

    CONSTRAINT "growth_fuentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_nichos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "GrowthEstadoNicho" NOT NULL DEFAULT 'candidato',
    "origen" TEXT NOT NULL,
    "evidencia" JSONB,
    "puntuacion" INTEGER,
    "decididoEn" TIMESTAMP(3),
    "notas" TEXT,

    CONSTRAINT "growth_nichos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_afirmaciones" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "valor" JSONB,
    "fuente" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "nichoSlug" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),

    CONSTRAINT "growth_afirmaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_paginas" (
    "ruta" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "nichoSlug" TEXT,
    "actualizado" TIMESTAMP(3),
    "indexada" BOOLEAN,
    "comprobadaEn" TIMESTAMP(3),

    CONSTRAINT "growth_paginas_pkey" PRIMARY KEY ("ruta")
);

-- CreateTable
CREATE TABLE "growth_ejecuciones" (
    "id" TEXT NOT NULL,
    "disparador" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "resumen" JSONB,
    "modulos" JSONB,
    "versionPrompts" TEXT,
    "error" TEXT,

    CONSTRAINT "growth_ejecuciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_oportunidades" (
    "id" TEXT NOT NULL,
    "claveExterna" TEXT NOT NULL,
    "fuenteId" TEXT NOT NULL,
    "nichoId" TEXT,
    "url" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "extracto" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "detectadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "objetivoPrincipal" "GrowthObjetivo" NOT NULL,
    "puntTrafico" INTEGER NOT NULL DEFAULT 0,
    "puntLeads" INTEGER NOT NULL DEFAULT 0,
    "puntBacklinks" INTEGER NOT NULL DEFAULT 0,
    "estado" "GrowthEstadoOportunidad" NOT NULL DEFAULT 'detectada',
    "motivoDescarte" TEXT,
    "datos" JSONB,
    "expiraEn" TIMESTAMP(3),
    "retencionHasta" TIMESTAMP(3) NOT NULL,
    "ejecucionId" TEXT,

    CONSTRAINT "growth_oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_investigaciones" (
    "oportunidadId" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "quienEdita" TEXT,
    "viaDeContacto" TEXT,
    "competidoresEnlazados" JSONB,
    "contexto" JSONB,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_investigaciones_pkey" PRIMARY KEY ("oportunidadId")
);

-- CreateTable
CREATE TABLE "growth_borradores" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tipo" "GrowthTipoBorrador" NOT NULL,
    "objetivo" "GrowthObjetivo" NOT NULL,
    "asunto" TEXT,
    "texto" TEXT NOT NULL,
    "enlaceUrl" TEXT,
    "utm" JSONB,
    "afirmaciones" TEXT[],
    "estado" "GrowthEstadoBorrador" NOT NULL DEFAULT 'borrador',
    "textoFinal" TEXT,
    "editadoPorHumano" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_borradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_revisiones_cumplimiento" (
    "id" TEXT NOT NULL,
    "borradorId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "comprobaciones" JSONB NOT NULL,
    "revisor" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_revisiones_cumplimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_decisiones" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT,
    "borradorId" TEXT,
    "accion" TEXT NOT NULL,
    "motivo" TEXT,
    "por" TEXT NOT NULL,
    "en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_decisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_gestiones" (
    "id" TEXT NOT NULL,
    "borradorId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "hechaEn" TIMESTAMP(3) NOT NULL,
    "respuestaEn" TIMESTAMP(3),
    "resultado" TEXT NOT NULL DEFAULT 'pendiente',
    "urlConseguida" TEXT,
    "notas" TEXT,

    CONSTRAINT "growth_gestiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_mediciones" (
    "id" TEXT NOT NULL,
    "gestionId" TEXT,
    "enlaceId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricas" JSONB NOT NULL,
    "origen" TEXT NOT NULL,

    CONSTRAINT "growth_mediciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_competidores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "notas" TEXT,

    CONSTRAINT "growth_competidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_enlaces_entrantes" (
    "id" TEXT NOT NULL,
    "dominioOrigen" TEXT NOT NULL,
    "urlOrigen" TEXT NOT NULL,
    "urlDestino" TEXT NOT NULL,
    "anchor" TEXT,
    "rel" TEXT NOT NULL,
    "primeraVistaEn" TIMESTAMP(3) NOT NULL,
    "perdidoEn" TIMESTAMP(3),
    "fuente" TEXT NOT NULL,
    "oportunidadId" TEXT,

    CONSTRAINT "growth_enlaces_entrantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_consultas_geo" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "nichoSlug" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "growth_consultas_geo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_resultados_geo" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "ejecutadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motor" TEXT NOT NULL,
    "mencionaAlhabla" BOOLEAN NOT NULL,
    "urlCitada" TEXT,
    "competidoresCitados" JSONB,

    CONSTRAINT "growth_resultados_geo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_metricas_seo" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "clics" INTEGER NOT NULL,
    "impresiones" INTEGER NOT NULL,
    "posicion" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "growth_metricas_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_ajustes" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_ajustes_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "growth_tokens_agente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "alcances" TEXT[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoEn" TIMESTAMP(3),
    "ultimoUso" TIMESTAMP(3),

    CONSTRAINT "growth_tokens_agente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_nichos_slug_key" ON "growth_nichos"("slug");

-- CreateIndex
CREATE INDEX "growth_afirmaciones_clave_vigenteHasta_idx" ON "growth_afirmaciones"("clave", "vigenteHasta");

-- CreateIndex
CREATE UNIQUE INDEX "growth_oportunidades_claveExterna_key" ON "growth_oportunidades"("claveExterna");

-- CreateIndex
CREATE INDEX "growth_oportunidades_estado_objetivoPrincipal_idx" ON "growth_oportunidades"("estado", "objetivoPrincipal");

-- CreateIndex
CREATE INDEX "growth_oportunidades_dominio_idx" ON "growth_oportunidades"("dominio");

-- CreateIndex
CREATE INDEX "growth_borradores_oportunidadId_estado_idx" ON "growth_borradores"("oportunidadId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "growth_gestiones_borradorId_key" ON "growth_gestiones"("borradorId");

-- CreateIndex
CREATE INDEX "growth_gestiones_dominio_hechaEn_idx" ON "growth_gestiones"("dominio", "hechaEn");

-- CreateIndex
CREATE UNIQUE INDEX "growth_competidores_dominio_key" ON "growth_competidores"("dominio");

-- CreateIndex
CREATE UNIQUE INDEX "growth_enlaces_entrantes_urlOrigen_urlDestino_key" ON "growth_enlaces_entrantes"("urlOrigen", "urlDestino");

-- CreateIndex
CREATE UNIQUE INDEX "growth_metricas_seo_fecha_tipo_clave_key" ON "growth_metricas_seo"("fecha", "tipo", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "growth_tokens_agente_hashToken_key" ON "growth_tokens_agente"("hashToken");

-- AddForeignKey
ALTER TABLE "growth_oportunidades" ADD CONSTRAINT "growth_oportunidades_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "growth_fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_oportunidades" ADD CONSTRAINT "growth_oportunidades_nichoId_fkey" FOREIGN KEY ("nichoId") REFERENCES "growth_nichos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_oportunidades" ADD CONSTRAINT "growth_oportunidades_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "growth_ejecuciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_investigaciones" ADD CONSTRAINT "growth_investigaciones_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "growth_oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_borradores" ADD CONSTRAINT "growth_borradores_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "growth_oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_revisiones_cumplimiento" ADD CONSTRAINT "growth_revisiones_cumplimiento_borradorId_fkey" FOREIGN KEY ("borradorId") REFERENCES "growth_borradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_decisiones" ADD CONSTRAINT "growth_decisiones_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "growth_oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_decisiones" ADD CONSTRAINT "growth_decisiones_borradorId_fkey" FOREIGN KEY ("borradorId") REFERENCES "growth_borradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_gestiones" ADD CONSTRAINT "growth_gestiones_borradorId_fkey" FOREIGN KEY ("borradorId") REFERENCES "growth_borradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_mediciones" ADD CONSTRAINT "growth_mediciones_gestionId_fkey" FOREIGN KEY ("gestionId") REFERENCES "growth_gestiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_mediciones" ADD CONSTRAINT "growth_mediciones_enlaceId_fkey" FOREIGN KEY ("enlaceId") REFERENCES "growth_enlaces_entrantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_enlaces_entrantes" ADD CONSTRAINT "growth_enlaces_entrantes_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "growth_oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_resultados_geo" ADD CONSTRAINT "growth_resultados_geo_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "growth_consultas_geo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

