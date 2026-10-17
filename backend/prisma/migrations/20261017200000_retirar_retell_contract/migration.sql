-- Retirada de Retell (PLAN-RETIRAR-RETELL.md, PR 3, contract). La PR 2 dejó
-- de usar estos campos y los marcó con @ignore: la revisión que sirve
-- mientras dura este despliegue ya no los selecciona, así que borrarlos no
-- rompe sus consultas. Los datos que se pierden no los lee nadie.

-- Enrutamiento, failover y número de Retell en el negocio.
DROP INDEX "businesses_retellPhoneNumberId_key";
DROP INDEX "businesses_retellPhoneNumber_key";
ALTER TABLE "businesses" DROP COLUMN "orchestrator",
DROP COLUMN "retellPhoneNumber",
DROP COLUMN "retellPhoneNumberId",
DROP COLUMN "voiceFailoverActive",
DROP COLUMN "voiceFailoverReason",
DROP COLUMN "voiceRoutingChangedAt",
DROP COLUMN "voiceRoutingTarget";

-- Agente y LLM de Retell.
DROP INDEX "agents_retellAgentId_idx";
DROP INDEX "agents_retellAgentId_key";
ALTER TABLE "agents" DROP COLUMN "retellAgentId",
DROP COLUMN "retellLlmId";

-- Rachas del health-check de Telnyx (el failover automático a Retell).
DROP TABLE "salud_telnyx";
