-- El WhatsApp Business del propio negocio en coexistencia (Beta, fase de
-- conexión; PLAN-WHATSAPP-COEXISTENCIA.md § 1). Tabla nueva, aditiva.
-- CreateTable
CREATE TABLE "whatsapp_numeros_negocio" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "metaPhoneNumberId" TEXT NOT NULL,
    "metaWabaId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "signupId" TEXT,
    "estado" TEXT NOT NULL,
    "errores" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncDeadline" TIMESTAMP(3),
    "consultadoAt" TIMESTAMP(3),
    "conectadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_numeros_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numeros_negocio_businessId_key" ON "whatsapp_numeros_negocio"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numeros_negocio_metaPhoneNumberId_key" ON "whatsapp_numeros_negocio"("metaPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numeros_negocio_phoneNumber_key" ON "whatsapp_numeros_negocio"("phoneNumber");

-- AddForeignKey
ALTER TABLE "whatsapp_numeros_negocio" ADD CONSTRAINT "whatsapp_numeros_negocio_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

