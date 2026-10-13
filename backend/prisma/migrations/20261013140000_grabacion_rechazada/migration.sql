-- Expand: una columna nueva y opcional que la revisión anterior no lee.
-- Cuándo pidió quien llama que no se grabara la llamada (tool no_grabar): el
-- audio no se copia a R2 y se borra en el proveedor; la transcripción queda.
ALTER TABLE "calls" ADD COLUMN "grabacionRechazadaAt" TIMESTAMP(3);
