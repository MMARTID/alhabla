-- PLAN-AGENDA-ALHABLA.md, fase 3: token del feed iCal de solo lectura. Aditiva.
ALTER TABLE "businesses" ADD COLUMN "icalToken" TEXT;
CREATE UNIQUE INDEX "businesses_icalToken_key" ON "businesses"("icalToken");
