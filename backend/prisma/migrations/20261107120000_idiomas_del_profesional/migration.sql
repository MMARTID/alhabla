-- Idiomas que habla cada profesional además del castellano (códigos del
-- catálogo de la recepcionista). La recepcionista da la cita primero a quien
-- habla el idioma de quien llama.
-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "idiomas" TEXT[] DEFAULT ARRAY[]::TEXT[];
