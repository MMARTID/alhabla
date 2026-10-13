-- Última actividad de cada conversación, la que ordena y filtra el historial
-- del panel. Solo añade (expand): la revisión anterior no conoce la columna y
-- sus inserciones toman el DEFAULT.
SET lock_timeout = '5s';

-- CURRENT_TIMESTAMP es estable: Postgres 11+ añade la columna sin reescribir
-- la tabla.
ALTER TABLE "calls" ADD COLUMN "ultimaActividadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Relleno: en las llamadas de voz, su inicio; en los chats de WhatsApp, el
-- último mensaje que conste en su conversación (GREATEST ignora los NULL).
UPDATE "calls" SET "ultimaActividadAt" = "startedAt";

UPDATE "calls" c
SET "ultimaActividadAt" = GREATEST(c."startedAt", a."ultimoEntrante", a."ultimoSaliente")
FROM (
  SELECT "callId", MAX("lastInboundAt") AS "ultimoEntrante", MAX("lastOutboundAt") AS "ultimoSaliente"
  FROM "client_conversations"
  GROUP BY "callId"
) a
WHERE a."callId" = c."callId";

CREATE INDEX "calls_businessId_ultimaActividadAt_idx" ON "calls"("businessId", "ultimaActividadAt");
