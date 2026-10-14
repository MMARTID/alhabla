-- Cuándo se le pidió permiso para grabar en esta llamada (lib/grabacion.ts):
-- lo decide el backend, una sola vez por llamada. Columna nula, sin default:
-- no reescribe la tabla, pero toma un bloqueo breve sobre calls.
SET lock_timeout = '5s';

ALTER TABLE "calls" ADD COLUMN "grabacionPreguntadaAt" TIMESTAMP(3);
