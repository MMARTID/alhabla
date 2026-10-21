import Link from "next/link";
import { Scale } from "lucide-react";
import { Fuentes, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * «¿Es legal que una IA conteste el teléfono de mi negocio?» (2026-10-20).
 * Búsqueda real: «es legal grabar llamadas en españa» sale 1.ª. Todo lo que
 * dice está contrastado con el texto de cada norma (BOE, DOUE vía BOE, AEPD,
 * Comisión Europea, TJUE) el 20-10-2026; no es asesoramiento jurídico y lo
 * dice. Los hechos de Alhabla (saludo, grabación opcional, transferencia)
 * salen de backend/src/lib/idiomas/catalogo.ts y AGENTS.md.
 */
const ruta = "/guias/ley-y-recepcionista-de-ia";
const titulo = "¿Es legal que una IA conteste el teléfono de tu negocio?";
const descripcion =
  "Aviso de IA (art. 50 del Reglamento europeo), grabación de llamadas, Ley 10/2025, idiomas y recordatorios por WhatsApp: lo que obliga a un pequeño negocio.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

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
      ctaSecundario={{ texto: "Cómo avisa Alhabla", href: "#aviso" }}
      entradilla={
        <>
          <p>
            Sí. En España un negocio puede dejar que una inteligencia artificial coja el teléfono y reserve citas. Lo
            que la ley pide es transparencia: que quien llama sepa que habla con una IA, que se le informe si la
            llamada se graba, que los recordatorios no lleven publicidad y, en una clínica, más cuidado con los datos
            de salud.
          </p>
          <p className="text-base">
            Esta guía resume qué dice cada norma, a quién obliga y qué hace Alhabla en cada caso, con el artículo
            concreto y el enlace al texto oficial. Es información, no asesoramiento jurídico.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Tengo que avisar yo de que contesta una IA?",
          answer:
            "El Reglamento europeo pone esa obligación en el proveedor del sistema, que en este caso es Alhabla: por eso la recepcionista lo dice siempre en la primera frase. Tú no tienes que añadir nada a tu saludo.",
        },
        {
          question: "¿Puedo grabar las llamadas de mis clientes?",
          answer:
            "Sí, informando al inicio de la llamada de quién graba, para qué, y de que puede ejercer sus derechos. Si la base es el consentimiento, el cliente tiene que poder negarse. Alhabla solo graba a quien da permiso, y si dice que no se queda únicamente la transcripción.",
        },
        {
          question: "¿Me afecta la Ley 10/2025 de atención a la clientela?",
          answer:
            "Casi seguro que no de forma directa: obliga a empresas de servicios básicos (luz, agua, telecomunicaciones, transporte, banca…) y al resto solo si tienen 250 trabajadores o más, o facturan más de 50 millones. Lo que sí toca a todas es la reforma del artículo 21 de la ley de consumidores, que explicamos abajo.",
        },
        {
          question: "¿Puede ser la IA el único teléfono de mi negocio?",
          answer:
            "La ley de consumidores pide que la atención al cliente por teléfono garantice una atención personal directa, más allá de otros medios técnicos. Para no depender de cómo se interprete, deja siempre una vía para hablar con una persona. Si das el número de Alhabla como número principal de tu negocio, la recepcionista puede pasar la llamada a tu móvil cuando el cliente lo pida. Con el desvío no hace falta: tu teléfono suena primero y la recepcionista solo coge lo que tú no coges.",
        },
        {
          question: "¿Tengo que firmar algo con el proveedor de la recepcionista?",
          answer:
            "Sí: un contrato de encargo del tratamiento (art. 28 del RGPD), que se puede aceptar por medios electrónicos. En España no existe un documento aparte tipo «BAA» como en Estados Unidos; si hay transferencias fuera del Espacio Económico Europeo, se suman las garantías del capítulo V del RGPD.",
        },
        {
          question: "¿Qué pasa si no se avisa de que es una IA?",
          answer:
            "El Reglamento prevé multas de hasta 15 millones de euros o el 3 % de la facturación, y para pymes se aplica la menor de las dos cifras. El proyecto de ley español lo califica como infracción grave del proveedor.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-catalan", titulo: "Atención en catalán" },
        { href: "/recepcionista-ia-en-euskera", titulo: "Atención en euskera" },
        { href: "/recepcionista-ia-en-gallego", titulo: "Atención en gallego" },
        { href: "/integraciones/whatsapp", titulo: "WhatsApp para confirmar y recordar citas" },
        { href: "/legal/privacidad", titulo: "Política de privacidad de Alhabla" },
      ]}
      cierre="Una recepcionista que dice la verdad desde la primera frase."
    >
      <Seccion titulo="Lo esencial en una tabla" entradilla={<p>Qué norma obliga a una peluquería o un salón de un autónomo, según el texto de cada una.</p>}>
        <Tabla
          cabecera={["Norma", "¿Obliga a un pequeño negocio?", "Qué pide"]}
          filas={[
            ["Reglamento de IA, art. 50.1", "No directamente: obliga al proveedor (Alhabla)", "Avisar de que es una IA en la primera interacción."],
            ["RGPD y LOPDGDD", "Sí", "Informar al grabar y tratar los datos solo para lo necesario."],
            ["Ley 10/2025", "No, salvo grupos grandes o servicios básicos", "Atención humana a petición y esperas de menos de 3 minutos."],
            ["Ley de consumidores, art. 21", "Depende de la interpretación (21.2); sí (21.3)", "Atención personal directa por teléfono; responder reclamaciones en 15 días."],
            ["LSSI, art. 21", "Solo si el mensaje lleva publicidad", "Consentimiento para comunicaciones comerciales."],
            ["RGPD, art. 9 (salud)", "No en peluquería; sí en fisioterapia", "Base legal específica y más medidas para los datos de salud."],
          ]}
        />
      </Seccion>

      <Seccion fondo id="aviso" titulo="1. El aviso de que contesta una IA">
        <Texto>
          <p>
            El <strong>artículo 50.1 del Reglamento (UE) 2024/1689</strong>, de Inteligencia Artificial, obliga a los
            proveedores a diseñar los sistemas que hablan con personas de forma que estas sepan que están hablando con
            una IA, salvo que resulte evidente. El apartado 5 pide que se informe de forma clara y distinguible, como
            tarde en la primera interacción. Se aplica desde el <strong>2 de agosto de 2026</strong> (art. 113), y el
            reglamento «Ómnibus» de 2026 no cambió esta obligación.
          </p>
          <p>
            Quién es quién: el <strong>proveedor</strong> es quien comercializa el sistema con su nombre (Alhabla); tu
            negocio es el <strong>responsable del despliegue</strong>, quien lo usa bajo su autoridad. El aviso es
            obligación del proveedor. Las directrices de la Comisión Europea de julio de 2026 concretan que, en una
            llamada, debe ser una frase hablada al principio (un tono no basta), que conviene recordarlo en llamadas
            largas y que un agente de IA debe decir en nombre de quién actúa.
          </p>
          <p>
            Cómo lo hace Alhabla: la primera frase de cada llamada nombra tu negocio y dice que atiende una
            inteligencia artificial, en el idioma en que saluda. En castellano: <strong>«Peluquería Sol, te atiende su
            asistente de inteligencia artificial. ¿En qué te ayudo?»</strong>; en catalán, euskera, gallego y los demás
            idiomas, la misma idea con las palabras «inteligencia artificial» traducidas, nunca «asistente» a secas. A
            quien ya ha reservado le saluda por su nombre sin quitar el aviso: «Hola, Laura, soy la asistente de
            inteligencia artificial de Peluquería Sol».
          </p>
          <p>
            Sanciones: hasta 15 millones de euros o el 3 % del volumen de negocio (art. 99.4), la cifra menor en el caso
            de las pymes (art. 99.6). En España, el Proyecto de Ley Orgánica para el buen uso y la gobernanza de la IA
            (BOCG de 12 de junio de 2026, todavía en tramitación) califica como grave que el proveedor no avise. La
            autoridad de vigilancia es la AESIA.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="2. Grabar y transcribir las llamadas">
        <Texto>
          <p>
            La voz es un dato personal. Si la llamada se graba, hay que informar en el momento de obtener los datos
            (art. 13 del RGPD). La <strong>LOPDGDD, en su artículo 11</strong>, permite dar una información básica: quién
            es el responsable, para qué se graba, que se pueden ejercer los derechos y dónde consultar el resto. Según
            el Informe 0030/2023 de la AEPD, para grabar llamadas de atención al cliente con fines de calidad la base es
            el consentimiento o el interés legítimo, no una obligación legal; si se usa el consentimiento, el cliente
            tiene que poder decir que no.
          </p>
          <p>
            Transcribir también es tratar datos. La AEPD recordó en 2026 que hay que informar del plazo de conservación
            de la grabación y de la transcripción, que la transcripción debe ser exacta y que se puede pedir
            rectificarla. Los datos se guardan solo el tiempo necesario (art. 5.1.e).
          </p>
          <p>
            Cómo lo hace Alhabla: <strong>solo graba con permiso del cliente</strong>. La recepcionista se lo pregunta
            una sola vez, mientras comprueba la agenda, y le dice para qué: que el negocio pueda revisar sus llamadas. A
            quien ya aceptó, se lo recuerda al descolgar («La llamada se graba; si prefieres que no, dímelo»). Si no
            acepta, no se guarda audio. La transcripción de cada llamada sí se guarda siempre, durante 90 días, en tu
            panel para que veas qué se pidió; menciónalo en la información de privacidad de tu negocio.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota tipo="importante" titulo="No grabar no significa no tratar datos">
            Aunque el cliente no deje grabar, la llamada se transcribe y la cita guarda su nombre y su teléfono. Tu
            información de privacidad debe cubrir esos tratamientos igualmente.
          </Nota>
        </div>
      </Seccion>

      <Seccion fondo titulo="3. La Ley 10/2025 y la atención por una persona">
        <Texto>
          <p>
            La <strong>Ley 10/2025, de 26 de diciembre, de servicios de atención a la clientela</strong> está en vigor
            desde el 28 de diciembre de 2025, con doce meses para adaptarse. Prohíbe usar contestadores automáticos como
            medio exclusivo de atención (art. 8.1), exige que los sistemas automáticos ofrezcan una persona en cualquier
            momento (art. 8.2) y que el 95 % de las llamadas se atiendan en menos de tres minutos (art. 10.3).
          </p>
          <p>
            Pero su artículo 2 limita a quién obliga: empresas de servicios básicos de interés general (agua, gas,
            electricidad, transporte de viajeros, servicios postales, telecomunicaciones y servicios financieros) de
            cualquier tamaño y, el resto, solo si el año anterior tuvieron al menos 250 personas en plantilla o más de
            50 millones de facturación o 43 de balance. Una peluquería o un centro de estética independiente queda fuera.
          </p>
          <p>
            Lo que sí alcanza a todas las empresas es la reforma que esa misma ley hizo del{" "}
            <strong>artículo 21 de la ley general de consumidores</strong>: si la atención al cliente usa el teléfono,
            debe garantizar una atención personal directa, más allá de otros medios técnicos complementarios, y las
            reclamaciones deben contestarse en un máximo de quince días. Si la línea de un salón cuenta como «servicio de
            atención al cliente» a estos efectos es una cuestión de interpretación; lo prudente es que siempre haya una
            persona a la que llegar.
          </p>
          <p>
            Cómo lo hace Alhabla: con el desvío, tu teléfono sigue sonando primero y la recepcionista solo coge lo que
            tú no puedes; en ese caso no pasa llamadas. Si publicas el número de Alhabla como principal, puedes elegir
            que te pase la llamada al móvil cuando el cliente lo pida o, solo dentro de tu horario, también ante una
            queja o una urgencia, con un aviso previo para que sepas quién es.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="4. Atender en catalán, euskera o gallego">
        <Tabla
          cabecera={["Comunidad", "Norma", "Qué dice para un pequeño comercio"]}
          filas={[
            ["Cataluña", "Llei 1/1998, art. 32.1; Codi de consum, art. 128-1", "Las empresas deben estar en condiciones de atender en cualquiera de las lenguas oficiales. El Constitucional (STC 88/2017) matizó que el art. 128-1 no crea por sí solo un deber exigible a cada empleado."],
            ["Euskadi", "Ley 4/2023, arts. 79 y 83", "Derecho a usar euskera o castellano; la obligación de tener los dos recae en servicios básicos y grandes establecimientos."],
            ["Galicia", "Lei 2/2012, art. 46", "Derecho a usar cualquier lengua oficial; la administración incentiva el gallego."],
            ["Illes Balears", "Llei 7/2014, art. 30.1", "La información basta en una de las dos lenguas oficiales."],
            ["Comunitat Valenciana", "Decreto Legislativo 1/2019, art. 8.3", "No se puede negar la atención ni atender incorrectamente por la lengua oficial que se use."],
          ]}
          nota="Resumen de los textos consolidados en el BOE a 20 de octubre de 2026."
        />
        <div className="mt-6">
          <Texto>
            <p>
              Alhabla activa sola la lengua cooficial según el código postal de la dirección del negocio (Cataluña y
              Baleares, catalán; Euskadi, euskera; Galicia, gallego). Si la dirección no lo lleva, puedes elegir esa
              lengua como idioma principal, y en la Comunitat Valenciana, el catalán. Detalles en <Link href="/recepcionista-ia-en-catalan">catalán</Link>,{" "}
              <Link href="/recepcionista-ia-en-euskera">euskera</Link> y <Link href="/recepcionista-ia-en-gallego">gallego</Link>.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion fondo titulo="5. Recordatorios de cita por WhatsApp">
        <Texto>
          <p>
            Recordar a un cliente la cita que ha pedido es parte del servicio que contrató: la base es la ejecución del
            contrato (art. 6.1.b del RGPD). Lo que convierte un recordatorio en otra cosa es la publicidad. La{" "}
            <strong>LSSI, en su artículo 21</strong>, prohíbe las comunicaciones comerciales por medios electrónicos que
            no se hayan pedido, salvo a clientes anteriores sobre productos similares y ofreciendo la baja en cada
            envío. La AEPD ya ha aplicado ese artículo a mensajes de WhatsApp (procedimiento PS/00323/2020).
          </p>
          <p>
            Regla práctica: un recordatorio dice el servicio, el día, la hora y cómo cambiarla. Si quieres anunciar una
            promoción, hazlo aparte y con el consentimiento de quien la recibe. Los recordatorios de Alhabla (en los
            planes Pro y Scale) solo llevan los datos de la cita y los botones Confirmo, Cancelar y Cambiar.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="6. Clínicas: los datos de salud">
        <Texto>
          <p>
            El RGPD define como datos de salud los que revelan información sobre el estado de salud, incluida la
            prestación de asistencia sanitaria (art. 4.15), y el Tribunal de Justicia de la UE entiende que basta con que
            se pueda deducir (asunto C-21/23, 2024). Por eso una cita en una consulta de fisioterapia es un dato de salud,
            y también la frase «me duele la rodilla» si queda transcrita, en cualquier negocio.
          </p>
          <p>
            Para la clínica, eso significa una base del artículo 9.2 (la asistencia sanitaria, letra h), valorar la
            evaluación de impacto según las listas de la AEPD (los profesionales sanitarios que ejercen de forma
            individual suelen quedar exentos) y un delegado de protección de datos si es un centro sanitario obligado a
            llevar historia clínica, salvo que se ejerza a título individual (art. 34.1.l de la LOPDGDD). Con el
            proveedor de la recepcionista basta el contrato de encargo del artículo 28: no hay un «BAA» como en Estados
            Unidos, porque esa figura es de la ley HIPAA de allí.
          </p>
          <p>
            Antes de contratar cualquier recepcionista de IA para una clínica, pide el contrato de encargo y pregunta
            dónde se tratan los datos y con qué garantías. En la{" "}
            <Link href="/legal/privacidad">política de privacidad de Alhabla</Link> están nuestros proveedores y las
            garantías de las transferencias fuera del Espacio Económico Europeo.
          </p>
        </Texto>
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
