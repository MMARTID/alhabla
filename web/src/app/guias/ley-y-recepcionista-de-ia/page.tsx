import type { ReactNode } from "react";
import Link from "next/link";
import { MessageCircle, PhoneIncoming, Scale } from "lucide-react";
import { Fuentes, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * «¿Es legal que una IA conteste el teléfono de mi negocio?» (normas
 * contrastadas el 2026-10-20). Búsqueda real: «es legal grabar llamadas en
 * españa» sale 1.ª. Cada apartado da arriba la respuesta corta y deja plegada
 * la letra de la norma, que es lo que citan buscadores e IA. No es
 * asesoramiento jurídico y lo dice. Los hechos de Alhabla (saludo, aviso por
 * escrito en WhatsApp, grabación opcional, transferencia) salen de
 * backend/src/lib/idiomas/catalogo.ts, modules/whatsapp/chatCliente.ts y
 * AGENTS.md; los saludos se citan literales.
 */
const ruta = "/guias/ley-y-recepcionista-de-ia";
const titulo = "¿Es legal que una IA conteste el teléfono de tu negocio?";
const descripcion =
  "Aviso de IA por teléfono y por WhatsApp, grabación de llamadas, Ley 10/2025, idiomas y datos de salud: lo que obliga a un pequeño negocio y lo que hace Alhabla.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

// Los planes que incluyen recordatorios, por su nombre en lib/plans.ts: el
// primero que los nombra y los siguientes, que dicen «Todo lo de …».
const primeroConRecordatorio = plans.findIndex((plan) => plan.features.some((f) => f.startsWith("Recordatorios")));
const nombresConRecordatorio = (primeroConRecordatorio >= 0 ? plans.slice(primeroConRecordatorio) : [])
  .map((plan) => plan.name)
  .join(" y ");

/** La letra de la norma, plegada debajo de la respuesta corta. */
function LaNorma({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-6 max-w-3xl rounded-2xl border border-linea bg-lienzo px-5">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold text-tinta marker:content-none">
        Lo que dice la norma
        <span className="text-lg leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="space-y-3 border-t border-linea py-4 text-sm leading-6 text-muted [&_strong]:font-semibold [&_strong]:text-tinta">
        {children}
      </div>
    </details>
  );
}

/** Cómo empieza una conversación con la recepcionista, por los dos canales. */
function PrimeraFrase() {
  return (
    <div className="panel p-5">
      <p className="text-sm font-semibold text-tinta">Así empieza cada conversación</p>
      <div className="mt-4 space-y-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
            <PhoneIncoming className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-tenue">Por teléfono</p>
            <p className="mt-1 text-sm leading-6 text-tinta">
              «Peluquería Sol, te atiende su recepcionista de IA. ¿En qué te ayudo?»
            </p>
          </div>
        </div>
        <div className="flex gap-3 border-t border-linea pt-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-tenue">Por WhatsApp</p>
            <p className="mt-1 text-sm leading-6 text-tinta">
              «Peluquería Sol, te atiende su recepcionista de IA.»
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeyPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[{ name: "La ley y la recepcionista de IA", path: ruta }]}
      etiqueta={{ icono: Scale, texto: "Guía legal" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="guia_ley"
      pieza={<PrimeraFrase />}
      ctaSecundario={{ texto: "Cómo avisa Alhabla", href: "#aviso" }}
      entradilla={
        <>
          <p>
            Sí. En España un negocio puede dejar que una inteligencia artificial coja el teléfono, conteste por WhatsApp
            y reserve citas. Lo que la ley pide es transparencia: que el cliente sepa que habla con una IA, que se le
            informe si se graba y que los recordatorios no lleven publicidad.
          </p>
          <p className="text-base">
            Cada apartado da la respuesta corta y, plegado, lo que dice la norma con su artículo. Es información, no
            asesoramiento jurídico.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Tengo que firmar algo con el proveedor de la recepcionista?",
          answer:
            "Sí: un contrato de encargo del tratamiento (art. 28 del RGPD), que se puede aceptar por medios electrónicos. En España no existe un documento aparte tipo «BAA» como en Estados Unidos; si hay transferencias fuera del Espacio Económico Europeo, se suman las garantías del capítulo V del RGPD.",
        },
        {
          question: "¿Qué pongo en la información de privacidad de mi negocio?",
          answer:
            "Que atiende una recepcionista de IA de un proveedor (Alhabla) que trata los datos por encargo tuyo; que la llamada se graba solo si el cliente da permiso; que se guarda la transcripción 90 días, y que la cita guarda su nombre y su teléfono. Aunque nadie deje grabar, esos datos se tratan igual.",
        },
        {
          question: "¿Qué pasa si no se avisa de que es una IA?",
          answer:
            "El Reglamento europeo prevé multas de hasta 15 millones de euros o el 3 % de la facturación, y para pymes se aplica la menor de las dos cifras. El proyecto de ley español lo califica como infracción grave del proveedor, no del negocio que usa la recepcionista.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-catalan", titulo: "Atención en catalán" },
        { href: "/agenda-por-whatsapp", titulo: "Tu asistente por WhatsApp" },
        { href: "/legal/privacidad", titulo: "Política de privacidad de Alhabla" },
      ]}
      cierre="Una recepcionista que dice la verdad desde la primera frase."
    >
      <Seccion titulo="Lo esencial en una tabla" entradilla={<p>Qué norma obliga a una peluquería o un salón de un autónomo.</p>}>
        <Tabla
          cabecera={["Norma", "¿Obliga a un pequeño negocio?", "Qué pide"]}
          filas={[
            ["Reglamento de IA, art. 50", "No directamente: obliga al proveedor (Alhabla)", "Avisar de que es una IA en la primera interacción, hablada o escrita."],
            ["RGPD y LOPDGDD", "Sí", "Informar al grabar y tratar los datos solo para lo necesario."],
            ["Ley 10/2025", "No, salvo grupos grandes o servicios básicos", "Atención humana a petición y esperas de menos de 3 minutos."],
            ["Ley de consumidores, art. 21", "Depende de la interpretación", "Atención personal directa por teléfono; responder reclamaciones en 15 días."],
            ["LSSI, art. 21", "Solo si el mensaje lleva publicidad", "Consentimiento para comunicaciones comerciales."],
            ["RGPD, art. 9 (salud)", "No en peluquería; sí en fisioterapia", "Base legal específica y más medidas para los datos de salud."],
          ]}
        />
      </Seccion>

      <Seccion fondo id="aviso" titulo="1. El aviso de que contesta una IA">
        <Texto>
          <p>
            Desde el <strong>2 de agosto de 2026</strong>, quien habla con una IA tiene que saberlo desde el principio.
            La obligación es del proveedor, no tuya: tu saludo no cambia.
          </p>
          <p>
            Alhabla lo dice en la primera frase de cada llamada, con el nombre de tu negocio y en el idioma en que
            saluda. A quien ya ha reservado le saluda por su nombre sin quitar el aviso: «Hola, Laura, soy la recepcionista de IA de
            Peluquería Sol».
          </p>
        </Texto>
        <LaNorma>
          <p>
            El <strong>artículo 50.1 del Reglamento (UE) 2024/1689</strong> obliga a los proveedores a diseñar los
            sistemas que hablan con personas de forma que estas sepan que hablan con una IA, salvo que resulte evidente.
            El apartado 5 pide hacerlo de forma clara y, como tarde, en la primera interacción. Se aplica desde el 2 de
            agosto de 2026 (art. 113); el reglamento «Ómnibus» de 2026 no cambió esta obligación.
          </p>
          <p>
            El <strong>proveedor</strong> es quien comercializa el sistema con su nombre (Alhabla); tu negocio es el{" "}
            <strong>responsable del despliegue</strong>. Las directrices de la Comisión Europea de julio de 2026 piden,
            en una llamada, una frase hablada al principio (un tono no basta) y que el agente diga en nombre de quién
            actúa. La autoridad de vigilancia en España es la AESIA.
          </p>
        </LaNorma>
      </Seccion>

      <Seccion titulo="2. Por WhatsApp, y con tu asistente">
        <Texto>
          <p>
            Cuando un cliente escribe al WhatsApp de tu negocio, la recepcionista también avisa, por escrito: si su
            primera respuesta en una conversación nueva no dice que es una inteligencia artificial, Alhabla le pone
            delante el mismo aviso del teléfono.
          </p>
          <p>
            Los recordatorios de cita (en los planes {nombresConRecordatorio}) solo llevan los datos de la cita y los
            botones Confirmo, Cancelar y Cambiar. Sin promociones: un recordatorio es parte del servicio; una oferta,
            publicidad, y esa necesita el consentimiento de quien la recibe.
          </p>
          <p>
            Tu asistente es otra cosa: le escribes tú, desde tu WhatsApp o el panel, y no habla con tus clientes por su
            cuenta. Lo que toca tu agenda (mover, anular, marcar una ausencia, avisar a quien tenía cita) te lo propone y
            espera a que pulses «Confirmar». Con tus clientes manda Alhabla; con tu agenda mandas tú.
          </p>
        </Texto>
        <LaNorma>
          <p>
            El artículo 50 no distingue entre voz y texto: cualquier sistema que interactúa con personas debe avisar. Los
            recordatorios se basan en la ejecución del contrato (art. 6.1.b del RGPD). La{" "}
            <strong>LSSI, en su artículo 21</strong>, prohíbe las comunicaciones comerciales electrónicas no pedidas,
            salvo a clientes anteriores sobre productos similares y con la baja en cada envío. La AEPD ya lo ha aplicado
            a mensajes de WhatsApp (procedimiento PS/00323/2020).
          </p>
        </LaNorma>
      </Seccion>

      <Seccion fondo titulo="3. Grabar y transcribir las llamadas">
        <Texto>
          <p>
            Se puede grabar informando al principio de quién graba y para qué, y dejando que el cliente diga que no.
          </p>
          <p>
            Alhabla <strong>solo graba con permiso</strong>: la recepcionista lo pregunta una vez y explica que es para
            que el negocio revise sus llamadas. A quien ya aceptó se lo recuerda al descolgar («La llamada se graba; si
            prefieres que no, dímelo»). Si no acepta, no se guarda audio. La transcripción sí se guarda siempre, 90 días,
            en tu panel.
          </p>
        </Texto>
        <LaNorma>
          <p>
            La voz es un dato personal: hay que informar al obtenerla (art. 13 del RGPD), y la{" "}
            <strong>LOPDGDD, en su artículo 11</strong>, permite una información básica (responsable, finalidad, derechos
            y dónde ver el resto). Según el Informe 0030/2023 de la AEPD, grabar llamadas de atención al cliente con fines
            de calidad se basa en el consentimiento o el interés legítimo; con consentimiento, el cliente tiene que poder
            negarse.
          </p>
          <p>
            Transcribir también es tratar datos: la AEPD recordó en 2026 que hay que informar del plazo de conservación,
            que la transcripción debe ser exacta y que se puede pedir rectificarla (art. 5.1.e del RGPD).
          </p>
        </LaNorma>
      </Seccion>

      <Seccion titulo="4. ¿Tiene que poder hablar con una persona?">
        <Texto>
          <p>
            La Ley 10/2025 de atención a la clientela no alcanza a un salón o una clínica independiente. La ley de
            consumidores sí pide una atención personal directa por teléfono; lo prudente es que siempre haya una persona
            a la que llegar.
          </p>
          <p>
            Con el desvío, tu teléfono suena primero y la recepcionista solo coge lo que tú no puedes. Si das el número de
            Alhabla como principal, puede pasarte la llamada al móvil cuando el cliente lo pida.
          </p>
        </Texto>
        <LaNorma>
          <p>
            La <strong>Ley 10/2025, de 26 de diciembre</strong>, en vigor desde el 28 de diciembre de 2025, prohíbe los
            contestadores como medio exclusivo (art. 8.1), exige ofrecer una persona en cualquier momento (art. 8.2) y
            atender el 95 % de las llamadas en menos de tres minutos (art. 10.3). Pero su artículo 2 la limita a
            servicios básicos (agua, gas, electricidad, transporte, correos, telecomunicaciones y finanzas) y, el resto,
            a empresas con 250 personas en plantilla o más de 50 millones de facturación.
          </p>
          <p>
            Esa misma ley reformó el <strong>artículo 21 de la ley general de consumidores</strong>, que sí alcanza a
            todas: la atención por teléfono debe garantizar una atención personal directa y las reclamaciones se
            contestan en quince días. Si la línea de un salón cuenta como «servicio de atención al cliente» es cuestión de
            interpretación.
          </p>
        </LaNorma>
      </Seccion>

      <Seccion fondo titulo="5. Atender en catalán, euskera o gallego">
        <Texto>
          <p>
            Ninguna ley autonómica obliga a un pequeño comercio a atender en las dos lenguas, pero el cliente tiene derecho
            a usar la suya. Alhabla activa sola la cooficial según el código postal del negocio, y puedes elegirla como
            idioma principal. Más en <Link href="/recepcionista-ia-en-catalan">catalán</Link>,{" "}
            <Link href="/recepcionista-ia-en-euskera">euskera</Link> y <Link href="/recepcionista-ia-en-gallego">gallego</Link>.
          </p>
        </Texto>
        <LaNorma>
          <p>
            <strong>Cataluña</strong> (Llei 1/1998, art. 32.1; Codi de consum, art. 128-1): las empresas deben poder
            atender en cualquiera de las lenguas oficiales; la STC 88/2017 matizó que no crea un deber exigible a cada
            empleado. <strong>Euskadi</strong> (Ley 4/2023, arts. 79 y 83): tener las dos lenguas obliga a servicios
            básicos y grandes establecimientos. <strong>Galicia</strong> (Lei 2/2012, art. 46): derecho a usar
            cualquiera. <strong>Illes Balears</strong> (Llei 7/2014, art. 30.1): basta una de las dos.{" "}
            <strong>Comunitat Valenciana</strong> (Decreto Legislativo 1/2019, art. 8.3): no se puede negar la atención
            por la lengua oficial que se use.
          </p>
        </LaNorma>
      </Seccion>

      <Seccion titulo="6. Clínicas: los datos de salud">
        <Texto>
          <p>
            En una consulta de fisioterapia, la propia cita es un dato de salud, y también «me duele la rodilla» si queda
            transcrito. Antes de contratar una recepcionista de IA, pide el contrato de encargo y pregunta dónde se tratan
            los datos. Los nuestros están en la <Link href="/legal/privacidad">política de privacidad de Alhabla</Link>,
            con las garantías de las transferencias fuera del Espacio Económico Europeo.
          </p>
        </Texto>
        <LaNorma>
          <p>
            El RGPD define los datos de salud en su artículo 4.15, y el Tribunal de Justicia de la UE entiende que basta
            con que se puedan deducir (asunto C-21/23, 2024). La clínica necesita una base del artículo 9.2 (asistencia
            sanitaria, letra h), valorar la evaluación de impacto según las listas de la AEPD (los profesionales que
            ejercen solos suelen quedar exentos) y un delegado de protección de datos si es un centro obligado a llevar
            historia clínica, salvo ejercicio individual (art. 34.1.l de la LOPDGDD).
          </p>
        </LaNorma>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Reglamento (UE) 2024/1689 de Inteligencia Artificial (DOUE en el BOE)", url: "https://www.boe.es/buscar/doc.php?id=DOUE-L-2024-81079" },
          { nombre: "Reglamento (UE) 2026/1744, «Ómnibus» de IA", url: "https://www.boe.es/buscar/doc.php?id=DOUE-L-2026-81147" },
          { nombre: "Comisión Europea: directrices sobre las obligaciones de transparencia (art. 50)", url: "https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems" },
          { nombre: "AESIA: preguntas frecuentes sobre el art. 50", url: "https://aesia.digital.gob.es/es/recursos/ria-articulo-50-faqs-directrices-sobre-transparencia" },
          { nombre: "Proyecto de Ley Orgánica de IA (BOCG, 12-6-2026)", url: "https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-97-1.PDF" },
          { nombre: "RGPD (DOUE en el BOE)", url: "https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807" },
          { nombre: "LOPDGDD (Ley Orgánica 3/2018)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673" },
          { nombre: "AEPD: Informe 0030/2023 sobre grabación de llamadas", url: "https://www.aepd.es/documento/2023-0030.pdf" },
          { nombre: "Ley 10/2025 de servicios de atención a la clientela", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2025-26698" },
          { nombre: "Ley general para la defensa de los consumidores (TRLGDCU)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555" },
          { nombre: "LSSI (Ley 34/2002)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758" },
          { nombre: "AEPD: procedimiento PS/00323/2020", url: "https://www.aepd.es/documento/ps-00323-2020.pdf" },
          { nombre: "Llei 1/1998 de política lingüística de Cataluña", url: "https://www.boe.es/buscar/act.php?id=BOE-A-1998-2989" },
          { nombre: "STC 88/2017", url: "https://www.boe.es/buscar/doc.php?id=BOE-A-2017-8473" },
          { nombre: "Ley 4/2023 del Estatuto de las personas consumidoras y usuarias (Euskadi)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2023-13537" },
          { nombre: "Lei 2/2012 de Galicia, de protección de consumidores", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2012-5595" },
          { nombre: "Llei 7/2014 de les Illes Balears", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2014-8820" },
          { nombre: "Decreto Legislativo 1/2019 de la Comunitat Valenciana", url: "https://www.boe.es/buscar/act.php?id=DOGV-r-2019-90594" },
          { nombre: "TJUE: comunicado sobre el asunto C-21/23", url: "https://curia.europa.eu/site/upload/docs/application/pdf/2024-10/cp240159es.pdf" },
          { nombre: "AEPD: listas de tratamientos que requieren evaluación de impacto", url: "https://www.aepd.es/documento/listas-dpia-es-35-4.pdf" },
        ]}
      />
    </PaginaGuia>
  );
}
