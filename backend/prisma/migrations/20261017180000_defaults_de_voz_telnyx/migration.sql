-- Retirada de Retell (PLAN-RETIRAR-RETELL.md, PR 2): los valores por defecto
-- dejan de ser "retell". Solo cambia el DEFAULT; no se toca ninguna fila ni
-- se borra ninguna columna (eso es la PR 3, contract).
ALTER TABLE "businesses" ALTER COLUMN "orchestrator" SET DEFAULT 'telnyx';
ALTER TABLE "businesses" ALTER COLUMN "voiceRoutingTarget" SET DEFAULT 'telnyx';
ALTER TABLE "calls" ALTER COLUMN "voiceProvider" SET DEFAULT 'telnyx';
