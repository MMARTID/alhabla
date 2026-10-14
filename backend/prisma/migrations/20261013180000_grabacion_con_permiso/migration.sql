-- Expand: una tabla nueva y una columna opcional que la revisión anterior no
-- lee. Grabación con permiso: solo se graba a quien lo ha aceptado, y el
-- permiso se recuerda por negocio y teléfono (lib/contextoDeLlamada.ts).
CREATE TABLE "clientes_del_negocio" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "grabacionAceptada" BOOLEAN,
    "grabacionDecididaAt" TIMESTAMP(3),
    "grabacionCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_del_negocio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clientes_del_negocio_businessId_telefono_key" ON "clientes_del_negocio"("businessId", "telefono");

-- La FK a businesses toma un bloqueo breve sobre businesses; lock_timeout lo
-- acota para no quedarse esperando detrás de una transacción larga.
SET lock_timeout = '5s';
ALTER TABLE "clientes_del_negocio" ADD CONSTRAINT "clientes_del_negocio_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calls" ADD COLUMN "grabacionPermitida" BOOLEAN;
