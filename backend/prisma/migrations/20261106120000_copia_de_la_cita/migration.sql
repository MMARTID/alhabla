-- PLAN-AGENDA-PRINCIPAL.md (fase 2): estado de la copia de cada cita en el
-- calendario conectado. Aditiva: las citas que ya existen quedan con
-- copiaEnCalendario a null y su evento, si lo tienen, sigue en externalEventId.
ALTER TABLE "bookings" ADD COLUMN "copiaEnCalendario" TEXT;
ALTER TABLE "bookings" ADD COLUMN "copiaIntentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "copiaError" TEXT;

-- El job de copia y el volcado al conectar buscan las pendientes.
CREATE INDEX "bookings_copiaEnCalendario_idx" ON "bookings"("copiaEnCalendario");
