-- Cuándo se le pidió permiso para grabar en esta llamada (lib/grabacion.ts):
-- lo decide el backend, una sola vez por llamada. Columna nula, sin default:
-- no reescribe la tabla.
ALTER TABLE "calls" ADD COLUMN "grabacionPreguntadaAt" TIMESTAMP(3);
