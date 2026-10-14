-- Idioma en que habló el cliente en su última llamada, del informe final
-- (lib/idiomaDelCliente.ts): se le saluda en él la próxima vez. Columnas
-- nulas, sin default: no reescriben la tabla.
SET lock_timeout = '5s';

ALTER TABLE "clientes_del_negocio" ADD COLUMN "idioma" TEXT;
ALTER TABLE "clientes_del_negocio" ADD COLUMN "idiomaAt" TIMESTAMP(3);
