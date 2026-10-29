import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";
import { formatPlanPrice, plans, TRIAL_DAYS } from "@/lib/plans";

export const runtime = "nodejs";
export const alt = "Planes y precios de Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Planes y precios",
    titulo: "Recepcionista de IA: que no se te escape ninguna llamada",
    subtitulo: `Minutos incluidos y tu asistente por WhatsApp en cada plan. Sin permanencia y con ${TRIAL_DAYS} días de prueba.`,
    pastilla: null,
    pie: "Cancela cuando quieras",
    derecha: {
      tipo: "precios",
      planes: plans.map((plan) => ({
        nombre: plan.name,
        precio: formatPlanPrice(plan.price),
        destacado: plan.id === "pro",
      })),
    },
  });
}
