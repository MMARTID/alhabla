-- La recepcionista de una zona cooficial en dos assistants de voz: el de
-- siempre (flux y voz Ultra, telnyxAssistantId) y el de la lengua
-- (telnyxCooficialAssistantId, Soniox y Marta o Sergio), al que el backend
-- cambia a mitad de llamada (lib/cambioDeIdioma.ts). Con dos conversaciones
-- de Telnyx por llamada, la Call guarda todas y cuántas espera. Aditiva.
ALTER TABLE "agents" ADD COLUMN "telnyxCooficialAssistantId" TEXT;
ALTER TABLE "agents" ADD COLUMN "telnyxCooficialConfigHash" TEXT;
CREATE UNIQUE INDEX "agents_telnyxCooficialAssistantId_key" ON "agents"("telnyxCooficialAssistantId");
ALTER TABLE "calls" ADD COLUMN "conversacionesDeTelnyx" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "calls" ADD COLUMN "assistantsArrancados" INTEGER NOT NULL DEFAULT 1;
