import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { formatIncludedMinutes, IVA_PORCENTAJE, plans, TRIAL_DAYS, type Plan } from "@/lib/plans";
import { absoluteUrl, organizationId } from "@/lib/seo";

/**
 * Lo que /planes cuenta y la portada no (2026-10-20): /planes compartía el
 * 54 % de su texto con la portada porque solo tenía el bloque de precios.
 * Aquí va lo que busca quien ya está comparando: qué entra en cada plan,
 * cuántos minutos necesita y cómo se factura. Todo sale de lib/plans.ts y de
 * cómo factura el backend (backend/src/modules/billing/service.ts: se suman
 * los segundos de las llamadas que atiende la recepcionista en el periodo).
 */

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const [inicio, pro, scale] = plans;

type Fila = { concepto: string; valores: [boolean | string, boolean | string, boolean | string] };

const FILAS: Fila[] = [
  { concepto: "Cuota mensual sin IVA", valores: [`${inicio.price} €`, `${pro.price} €`, `${scale.price} €`] },
  { concepto: "Minutos incluidos al mes", valores: [formatIncludedMinutes(inicio.minutes), formatIncludedMinutes(pro.minutes), formatIncludedMinutes(scale.minutes)] },
  { concepto: "Minuto extra sin IVA", valores: [eur(inicio.extraPerMinute), eur(pro.extraPerMinute), eur(scale.extraPerMinute)] },
  { concepto: "Profesionales en la agenda", valores: ["Hasta 3", "Hasta 10", "Sin límite"] },
  { concepto: "Atención 24 horas, todos los días", valores: [true, true, true] },
  { concepto: "Tu asistente: horarios, precios y citas por WhatsApp", valores: [true, true, true] },
  { concepto: "Si falta alguien: te ayuda a recolocar sus citas y a avisar a cada cliente", valores: [true, true, true] },
  { concepto: "Reserva en Google, Outlook, iCloud o en la agenda de Alhabla", valores: [true, true, true] },
  { concepto: "Reparto por especialidad", valores: [true, true, true] },
  { concepto: "Confirmación de la cita por WhatsApp", valores: [true, true, true] },
  { concepto: "Avisos al dueño por WhatsApp, con botones para resolverlos", valores: [true, true, true] },
  { concepto: "Lista de espera: aviso por WhatsApp si se libera la hora que pidió el cliente", valores: [true, true, true] },
  { concepto: "Da el precio de tu catálogo (tú eliges cuándo)", valores: [true, true, true] },
  { concepto: "Aviso de IA en la primera frase y grabación solo con permiso", valores: [true, true, true] },
  { concepto: "Comprobación del desvío con una llamada de prueba", valores: [true, true, true] },
  { concepto: "Castellano y 7 idiomas más, y el catalán, euskera o gallego de tu zona", valores: [true, true, true] },
  { concepto: "Recordatorios de cita por WhatsApp", valores: [false, true, true] },
  { concepto: "Resumen semanal por email", valores: [false, true, true] },
  { concepto: "Elegir entre todas las voces", valores: [false, true, true] },
  { concepto: "Analítica de demanda no atendida", valores: [false, false, true] },
];

const EJEMPLOS = [
  { llamadas: 3, plan: inicio },
  { llamadas: 8, plan: pro },
  { llamadas: 20, plan: scale },
] as const;
const MINUTOS_POR_LLAMADA = 2;
const DIAS = 26;

export const PREGUNTAS_DE_FACTURACION = [
  {
    question: "¿Qué cuenta como minuto?",
    answer:
      "La duración de las llamadas que atiende tu recepcionista, sumada en el mes. Las llamadas que coges tú no cuentan, porque no llegan a Alhabla: con el desvío «si no contesta», solo entra lo que tú no puedes coger.",
  },
  {
    question: "¿Qué pasa si me paso de los minutos incluidos?",
    answer: `La recepcionista sigue atendiendo: no se corta ninguna llamada. Los minutos de más se cobran al precio de tu plan (${eur(inicio.extraPerMinute)}, ${eur(pro.extraPerMinute)} o ${eur(scale.extraPerMinute)} + IVA) en la factura del mes siguiente. Si te pasas a menudo, te sale mejor subir de plan.`,
  },
  {
    question: "¿Los precios llevan IVA?",
    answer: `No. Se publican sin IVA, como en el resto del sector, y al pagar se suma el ${IVA_PORCENTAJE} %. Si tu negocio está dado de alta en el IVA, te lo puedes deducir como cualquier otro gasto.`,
  },
  {
    question: "¿Cómo funciona la prueba?",
    answer: `Tienes ${TRIAL_DAYS} días para probarlo con tus llamadas reales. Si lo cancelas antes de que acaben, no pagas nada.`,
  },
  {
    question: "¿Hay permanencia o penalización por cancelar?",
    answer: "No. Pagas mes a mes y cancelas cuando quieras desde Facturación, en el panel. No hay cuota de alta.",
  },
  {
    question: "¿Puedo cambiar de plan?",
    answer: "Sí, cuando quieras: desde Facturación, en el panel, entras al portal de pago, y si lo prefieres nos escribes y lo cambiamos nosotros. Si das de alta más profesionales de los que permite tu plan, el panel te avisa para que subas al siguiente.",
  },
  {
    question: "¿Qué es el precio de fundador?",
    answer: `Un precio más bajo para los 15 primeros negocios que contratan, en cualquier plan: ${inicio.founderPrice}, ${pro.founderPrice} o ${scale.founderPrice} € + IVA al mes. Solo se muestra mientras quedan plazas.`,
  },
  {
    question: "¿Las integraciones o el WhatsApp cuestan aparte?",
    answer: "No. Calendarios, WhatsApp e idiomas van incluidos en el precio de cada plan. Los mensajes que WhatsApp cobra a las empresas los paga Alhabla.",
  },
] as const;

/** Grafo de precios: un Offer por plan, sin IVA (`valueAddedTaxIncluded: false`). */
export function datosDePrecios() {
  return {
    "@type": "SoftwareApplication",
    "@id": `${absoluteUrl("/planes")}#app`,
    name: "Alhabla",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    publisher: { "@id": organizationId() },
    offers: plans.map((plan: Plan) => ({
      "@type": "Offer",
      name: `Plan ${plan.name}`,
      description: plan.summary,
      url: absoluteUrl("/planes"),
      priceCurrency: "EUR",
      price: String(plan.price),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(plan.price),
        priceCurrency: "EUR",
        billingDuration: "P1M",
        unitText: "mes",
        valueAddedTaxIncluded: false,
      },
    })),
  } as const;
}

function Celda({ valor }: { valor: boolean | string }) {
  if (valor === true) return <Check className="mx-auto h-4 w-4 text-morado" aria-label="Incluido" />;
  if (valor === false) return <Minus className="mx-auto h-4 w-4 text-tenue" aria-label="No incluido" />;
  return <span className="font-semibold text-tinta">{valor}</span>;
}

export function PlanesDetalle() {
  return (
    <div className="space-y-16">
      <section aria-labelledby="planes-tabla">
        <h2 id="planes-tabla" className="text-2xl font-black tracking-tight text-tinta sm:text-3xl">
          Qué incluye cada plan
        </h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-relleno">
                <th scope="col" className="border-b border-linea px-4 py-3 text-left font-semibold text-apagado">
                  &nbsp;
                </th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className={`border-b border-linea px-4 py-3 text-center font-semibold ${p.featured ? "bg-lavado text-morado-tinta" : "text-apagado"}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS.map(({ concepto, valores }) => (
                <tr key={concepto} className="border-b border-linea-suave last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-tinta">
                    {concepto}
                  </th>
                  {valores.map((v, i) => (
                    <td key={i} className={`px-4 py-3 text-center ${plans[i].featured ? "bg-lavado/50" : ""}`}>
                      <Celda valor={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="planes-minutos" className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 id="planes-minutos" className="text-2xl font-black tracking-tight text-tinta sm:text-3xl">
            ¿Cuántos minutos necesitas?
          </h2>
          <p className="mt-3 text-base leading-7 text-muted">
            Cuenta solo las llamadas que no coges tú: con el desvío «si no contesta», las demás ni llegan a la
            recepcionista. Multiplica esas llamadas al día por lo que dura una llamada de reserva (unos {MINUTOS_POR_LLAMADA}{" "}
            minutos de media en una cita sencilla) y por los días que abres al mes.
          </p>
          <p className="mt-3 text-base leading-7 text-muted">
            Si no sabes cuántas llamadas pierdes, la{" "}
            <Link href="/herramientas/calculadora-de-llamadas-perdidas" className="font-semibold text-morado-tinta underline underline-offset-4">
              calculadora de llamadas perdidas
            </Link>{" "}
            te ayuda a estimarlo. Y si te quedas corto, no se corta nada: pagas los minutos de más.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-relleno">
                <th scope="col" className="border-b border-linea px-4 py-3 text-left font-semibold text-apagado">Llamadas al día que atiende</th>
                <th scope="col" className="border-b border-linea px-4 py-3 text-left font-semibold text-apagado">Minutos al mes</th>
                <th scope="col" className="border-b border-linea px-4 py-3 text-left font-semibold text-apagado">Plan</th>
              </tr>
            </thead>
            <tbody>
              {EJEMPLOS.map(({ llamadas, plan }) => (
                <tr key={llamadas} className="border-b border-linea-suave last:border-0">
                  <td className="px-4 py-3 text-tinta">{llamadas}</td>
                  <td className="px-4 py-3 text-tinta">≈ {formatIncludedMinutes(llamadas * MINUTOS_POR_LLAMADA * DIAS)}</td>
                  <td className="px-4 py-3 font-semibold text-tinta">
                    {plan.name} ({formatIncludedMinutes(plan.minutes)} min)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs leading-5 text-muted">
            Ejemplo con {MINUTOS_POR_LLAMADA} minutos por llamada y {DIAS} días abiertos al mes. Tu caso puede variar.
          </p>
        </div>
      </section>

      <section aria-labelledby="planes-faq">
        <h2 id="planes-faq" className="text-2xl font-black tracking-tight text-tinta sm:text-3xl">
          Preguntas sobre precios y facturación
        </h2>
        <div className="mt-6 grid items-start gap-3 sm:grid-cols-2">
          {PREGUNTAS_DE_FACTURACION.map(({ question, answer }) => (
            <details key={question} className="group rounded-2xl border border-linea bg-lienzo p-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-6 text-tinta marker:content-none">
                {question}
                <span className="mt-1 text-lg leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 border-t border-linea pt-3 text-sm leading-6 text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
