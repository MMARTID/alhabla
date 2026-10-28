-- PLAN-AGENDA-ALHABLA.md, fase 1: dónde reserva cada negocio. Aditiva.
ALTER TABLE "businesses" ADD COLUMN "modoDeAgenda" TEXT NOT NULL DEFAULT 'sin_elegir';

-- Relleno: quien tiene una conexión de calendario con credenciales ya
-- reserva fuera (`externo`), con la regla de siempre; el resto se queda en
-- `sin_elegir` hasta que el dueño elija. Nadie pasa a `alhabla` solo.
UPDATE "businesses" b
SET "modoDeAgenda" = 'externo'
WHERE EXISTS (
  SELECT 1 FROM "calendar_connections" c
  WHERE c."businessId" = b.id AND c.credentials IS NOT NULL
);
