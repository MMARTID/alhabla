-- Sustituye a Memorystore (Redis): solo estado efímero. Plan de corte en el
-- PR A (cerrojos, límite de peticiones y purga) y el PR B (el resto).
-- Expand: cuatro CREATE TABLE y una FK de claves_temporales a businesses; la
-- revisión anterior no usa estas tablas. El ADD CONSTRAINT … REFERENCES
-- "businesses" toma un bloqueo SHARE ROW EXCLUSIVE breve sobre businesses
-- (bloquea escrituras, no lecturas) y espera a que acabe cualquier
-- transacción abierta que escriba en ella; mientras espera, bloquea a todos
-- los escritores que llegan detrás. lock_timeout lo acota a 5 s: si no lo
-- consigue, la migración entera falla sin crear nada (Prisma la ejecuta como
-- una sola transacción) y se recupera como dice AGENTS.md (§ Corte de Redis).
-- No habrá migración de contract: al apagar Redis no se borra nada de
-- Postgres.
SET lock_timeout = '5s';

-- Las caducidades se comparan siempre con now() de la BD, nunca con el reloj
-- de una instancia.

-- 1. Arrendamientos (antes SET NX PX + compare-and-delete en Lua). LOGGED: un
--    failover de Cloud SQL no puede vaciar un cerrojo con su poseedor dentro.
CREATE TABLE "cerrojos" (
    "clave" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "cerrojos_pkey" PRIMARY KEY ("clave")
);

-- 2. Clave-valor con caducidad (antes SET EX / GET / GETDEL / HSET / HSETNX).
--    businessId (opcional) borra en cascada lo del negocio al borrar la cuenta.
CREATE TABLE "claves_temporales" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "businessId" TEXT,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "claves_temporales_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "claves_temporales_expiraEn_idx" ON "claves_temporales"("expiraEn");
CREATE INDEX "claves_temporales_businessId_idx" ON "claves_temporales"("businessId");
ALTER TABLE "claves_temporales" ADD CONSTRAINT "claves_temporales_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Contadores de ventana fija: límite de peticiones, turnos de chat, avisos
--    por hora y límite de «Comprobar desvío». UNLOGGED: no escriben WAL ni dejan
--    IPs en el PITR, y perderlos en un crash solo reinicia ventanas. Sin índice
--    secundario y con fillfactor 70 para que los UPDATE sean HOT. Prisma no
--    representa UNLOGGED ni los WITH (...): el modelo `Contador` del schema
--    no los menciona y `migrate diff` no los ve como drift.
CREATE UNLOGGED TABLE "contadores" (
    "clave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "contadores_pkey" PRIMARY KEY ("clave")
) WITH (fillfactor = 70, autovacuum_vacuum_scale_factor = 0.05);

-- 4. Rachas del health-check de Telnyx: una sola fila (id 'telnyx'). La usa
--    el PR B; se crea ya para que el corte tenga una sola migración.
CREATE TABLE "salud_telnyx" (
    "id" TEXT NOT NULL DEFAULT 'telnyx',
    "malas" INTEGER NOT NULL DEFAULT 0,
    "buenas" INTEGER NOT NULL DEFAULT 0,
    "ultimoTick" BIGINT NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salud_telnyx_pkey" PRIMARY KEY ("id")
);
