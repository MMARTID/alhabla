import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { DPA_FECHA, DPA_VERSION, SUBENCARGADOS } from "@/lib/dpa";
import { absoluteUrl, ogImages, siteName } from "@/lib/seo";

const titulo = "Contrato de encargado del tratamiento (DPA)";
const descripcion =
  "El contrato de tratamiento de datos que aceptas al registrarte en Alhabla: qué hace con los datos de las personas que llaman a tu negocio, con quién los comparte y cómo los protege.";

export const metadata: Metadata = {
  title: titulo,
  description: descripcion,
  alternates: { canonical: absoluteUrl("/legal/dpa") },
  openGraph: {
    title: `${titulo} | ${siteName}`,
    description: descripcion,
    url: absoluteUrl("/legal/dpa"),
    siteName,
    locale: "es_ES",
    type: "website",
    images: ogImages("/legal/dpa", `${titulo} | ${siteName}`),
  },
  robots: { index: true, follow: true },
};

const fuerte = "font-semibold text-tinta";

export default function DpaPage() {
  return (
    <LegalPage title={titulo} description={descripcion} updatedAt={DPA_FECHA} indice>
      <LegalSection title="Partes y objeto" id="partes">
        <p>
          Este contrato regula el tratamiento de datos personales que{" "}
          <strong className={fuerte}>Miguel Martín Delgado</strong>, autónomo con NIF 49456776Z y domicilio en Carrer
          Sot de Bacs 175, 08470 Sant Celoni (Barcelona), titular de Alhabla (el «Encargado»), realiza por cuenta del
          negocio que se registra en Alhabla (el «Responsable»), conforme al artículo 28 del Reglamento (UE) 2016/679
          (RGPD) y a la Ley Orgánica 3/2018. Versión {DPA_VERSION}. Se acepta al registrarse y forma parte del contrato de
          servicio.
        </p>
        <p>
          Solo cubre los datos de las personas que llaman o escriben al negocio, de sus clientes y de sus profesionales.
          Los datos de la cuenta, la facturación y la seguridad del servicio los trata Alhabla como responsable, según la{" "}
          <a href="/legal/privacidad" className="font-medium text-morado-tinta underline underline-offset-2">
            política de privacidad
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Qué se trata y durante cuánto tiempo" id="tratamiento">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className={fuerte}>Objeto y finalidad:</strong> atender las llamadas y los WhatsApp del negocio con la
            recepcionista de IA, consultar la agenda, reservar, modificar o cancelar citas, avisar a clientes y ofrecer al
            dueño su asistente por WhatsApp y el panel.
          </li>
          <li>
            <strong className={fuerte}>Interesados:</strong> personas que llaman o escriben al negocio, clientes del
            negocio y sus profesionales.
          </li>
          <li>
            <strong className={fuerte}>Datos:</strong> nombre, teléfono, correo si lo facilitan, contenido de la
            conversación (transcripción y resumen), servicio pedido, fecha y profesional de la cita, y la grabación de
            audio únicamente si quien llama da permiso. Alhabla no pide datos de categorías especiales (por ejemplo, de
            salud); si una persona los revela, ver «Obligaciones del Responsable».
          </li>
          <li>
            <strong className={fuerte}>Duración:</strong> mientras el Responsable tenga cuenta. Alhabla borra el audio a los
            30 días y el texto de las conversaciones a los 90, como describe la política de privacidad.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Obligaciones del Encargado" id="encargado">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Tratar los datos solo siguiendo las instrucciones documentadas del Responsable: este contrato, la
            configuración que haga en el panel y lo que pida por escrito. Si una instrucción infringe el RGPD, se lo dirá.
          </li>
          <li>
            Garantizar que las personas con acceso a los datos están sujetas a confidencialidad.
          </li>
          <li>
            Aplicar las medidas de seguridad descritas al final de este contrato y revisarlas cuando cambie el servicio.
          </li>
          <li>
            Ayudar al Responsable, en un plazo de cinco días hábiles desde su petición, a atender los derechos de acceso,
            rectificación, supresión, limitación, oposición y portabilidad, y a hacer evaluaciones de impacto o consultas
            previas si las necesita. Si una persona se dirige directamente a Alhabla, se lo trasladará.
          </li>
          <li>
            Mantener un registro de actividades de tratamiento como encargado.
          </li>
          <li>
            Al terminar el servicio o a petición del Responsable, borrar los datos y no conservar copias, salvo lo que la
            ley obligue a guardar. El Responsable puede exportar antes su historial desde el panel.
          </li>
          <li>
            Facilitar la información necesaria para demostrar el cumplimiento y permitir auditorías razonables, como máximo
            una al año y con quince días de aviso, salvo una brecha de seguridad.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Brechas de seguridad" id="brechas">
        <p>
          Alhabla avisará al Responsable <strong className={fuerte}>sin demora indebida y, como máximo, en 24 horas</strong>{" "}
          desde que tenga constancia razonable de una brecha que afecte a sus datos. El aviso describirá lo ocurrido, los
          datos y las personas afectadas, las consecuencias probables y las medidas tomadas, y se completará según se
          sepa más. La notificación a la AEPD y a los afectados corresponde al Responsable.
        </p>
      </LegalSection>

      <LegalSection title="Subencargados" id="subencargados">
        <p>
          El Responsable autoriza con carácter general que Alhabla use los subencargados de la tabla, con las mismas
          obligaciones de protección de datos por contrato. Si añade o cambia alguno, avisará por correo con{" "}
          <strong className={fuerte}>quince días de antelación</strong>; el Responsable puede oponerse en ese plazo por
          motivos razonables de protección de datos y, si no se encuentra solución, cancelar el servicio sin penalización.
          Alhabla responde ante el Responsable del cumplimiento de sus subencargados.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-linea text-tinta">
                <th className="py-2 pr-4 font-semibold">Subencargado</th>
                <th className="py-2 pr-4 font-semibold">Qué hace</th>
                <th className="py-2 font-semibold">Dónde</th>
              </tr>
            </thead>
            <tbody>
              {SUBENCARGADOS.map((s) => (
                <tr key={s.nombre} className="border-b border-linea-suave align-top">
                  <td className="py-3 pr-4 font-medium text-tinta">{s.nombre}</td>
                  <td className="py-3 pr-4">{s.funcion}</td>
                  <td className="py-3">{s.ubicacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
                <p>
          Telnyx, además de tratar el contenido por cuenta del Responsable, actúa como responsable independiente de sus
          datos técnicos de uso (marcas de hora, número de tokens, latencias o códigos de error) y puede tratar el
          contenido para mejorar sus servicios en los términos de su anexo de tratamiento de datos, que le impide usarlo
          para entrenar modelos que ofrezca a otros sin consentimiento previo por escrito, salvo con datos
          desidentificados.
        </p>
        <p>
          Google, Microsoft y Apple no son subencargados de Alhabla: son los proveedores de calendario que el Responsable
          decide conectar.
        </p>
      </LegalSection>

      <LegalSection title="Transferencias internacionales" id="transferencias">
                <p>
          Algunos subencargados pueden tratar datos fuera del Espacio Económico Europeo.{" "}
          <strong className={fuerte}>Alhabla no garantiza hoy que todo se procese dentro de la UE:</strong> la cuenta de
          Alhabla en Telnyx tiene localidad de datos en Alemania y el audio se procesa en Fráncfort, pero la región de los
          modelos de lenguaje que ejecuta Telnyx no está asegurada, y el modelo de OpenAI de tu asistente por WhatsApp
          puede procesar fuera del EEE. Alhabla avisará si esto cambia.
        </p>
        <p>
          Telnyx está certificada en el Marco de Privacidad de Datos UE-EE. UU., y su contrato de tratamiento de datos
          incorpora las cláusulas contractuales tipo de la Comisión Europea (Decisión 2021/914) para toda transferencia a
          un país sin decisión de adecuación y, si esa certificación dejara de estar vigente, para Estados Unidos; además,
          se compromete a asegurar una garantía válida antes de cualquier transferencia a sus propios subencargados fuera
          del EEE. Para el resto de subencargados, Alhabla solo los usa si la transferencia se ampara en una decisión de
          adecuación (incluido el Marco de Privacidad de Datos UE-EE. UU. si el proveedor está certificado), en cláusulas
          contractuales tipo u otra garantía del capítulo V del RGPD, y facilitará al Responsable información sobre las
          garantías aplicables si la pide en privacidad@alhabla.ai.
        </p>
      </LegalSection>

      <LegalSection title="Obligaciones del Responsable" id="responsable">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Tener base legal para tratar los datos de quienes le llaman e informarles, por ejemplo en su web o en su
            rótulo. Alhabla avisa al descolgar de que habla una inteligencia artificial y pide permiso antes de grabar.
          </li>
          <li>
            Configurar la recepcionista para no pedir datos que no necesite. Si trabaja con datos de salud, por ejemplo en
            fisioterapia, debe valorar su base legal y no pedirlos por la recepcionista salvo lo imprescindible para la
            cita.
          </li>
          <li>Atender los derechos de las personas y notificar las brechas a la AEPD cuando corresponda.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Responsabilidad, ley aplicable y cambios" id="ley">
        <p>
          La responsabilidad de cada parte se rige por el RGPD y por las condiciones del servicio. Este contrato se rige
          por la ley española y, para cualquier discrepancia, ambas partes se someten a los juzgados y tribunales de
          Barcelona, salvo que la ley imponga otro fuero. Alhabla puede actualizar este contrato por cambios legales o del
          servicio; avisará por correo con quince días de antelación y publicará aquí la nueva versión, indicando su
          número.
        </p>
      </LegalSection>

      <LegalSection title="Medidas de seguridad" id="medidas">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cada negocio solo ve sus datos: todas las consultas se filtran por la cuenta autenticada.</li>
          <li>Comunicaciones cifradas con TLS; contraseñas guardadas con hash, nunca en texto legible.</li>
          <li>
            Los tokens de calendario y las contraseñas de aplicación de Apple se almacenan cifrados (AES-256-GCM), con la
            clave en un gestor de secretos.
          </li>
          <li>
            El almacenamiento de grabaciones es privado y se reproduce con enlaces firmados que caducan; los proveedores
            (Cloudflare R2 y Google Cloud) cifran los datos en reposo. El audio se borra a los 30 días y el texto a los 90.
          </li>
          <li>
            En las llamadas de voz, los datos personales (nombre, teléfono, correo y dirección) se redactan en la copia que
            conserva Telnyx. En los mensajes de WhatsApp esa redacción no está disponible y Telnyx conserva el texto tal
            cual.
          </li>
          <li>Los webhooks de proveedores se verifican con firma criptográfica y las peticiones tienen límite de uso.</li>
          <li>Acceso del equipo limitado a lo necesario para dar soporte o resolver incidencias.</li>
          <li>Procedimiento escrito de respuesta ante brechas, con aviso al Responsable en 24 horas.</li>
        </ul>
        <p>
          Alhabla revisa estas medidas al menos cada seis meses y cuando cambie un proveedor o una función que afecte a los
          datos.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
