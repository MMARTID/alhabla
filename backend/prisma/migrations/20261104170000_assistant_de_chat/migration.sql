-- La recepcionista en dos assistants de Telnyx: el de las llamadas
-- (telnyxAssistantId, como hasta ahora) y el del chat de clientes por
-- WhatsApp (lib/tiposDeAsistente.ts, «recepcionista_chat»). Aditiva.
ALTER TABLE "agents" ADD COLUMN "telnyxChatAssistantId" TEXT;
ALTER TABLE "agents" ADD COLUMN "telnyxChatConfigHash" TEXT;
CREATE UNIQUE INDEX "agents_telnyxChatAssistantId_key" ON "agents"("telnyxChatAssistantId");
