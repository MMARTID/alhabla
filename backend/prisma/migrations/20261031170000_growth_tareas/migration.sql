-- CreateTable
CREATE TABLE "growth_tareas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dominio" TEXT,
    "url" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'otro',
    "pasos" JSONB NOT NULL DEFAULT '[]',
    "notas" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'repo',
    "siembra" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "resultado" TEXT,
    "notaDeResultado" TEXT,
    "hechaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "growth_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_tareas_siembra_key" ON "growth_tareas"("siembra");

-- CreateIndex
CREATE INDEX "growth_tareas_estado_orden_idx" ON "growth_tareas"("estado", "orden");
