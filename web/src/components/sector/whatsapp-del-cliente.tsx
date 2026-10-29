import {
  ChatDeWhatsapp,
  type BurbujaDeChat,
} from "@/components/owner-assistant-chat";
import type { NicheAccent } from "@/lib/niche-landings";
import type { MensajeDeCliente } from "@/lib/sectores/tipos";

/** Fijo del negocio en el ejemplo: el 79 es un rango sin atribuir. */
const TELEFONO_DEL_NEGOCIO = "790 41 22 18";

/**
 * Lo que recibe en su WhatsApp quien llamó: la confirmación tal como sale
 * del número «Alhabla Reservas» y, debajo, cómo la cambia contestando al
 * mensaje (la recepcionista por chat, modules/whatsapp/chatCliente.ts).
 *
 * La confirmación es literal la plantilla vigente, `confirmacion_cita_v3`
 * (es, APPROVED en producción el 29-10-2026; la primera de
 * `VERSIONES_CONFIRMACION_CON_RUTA` en modules/whatsapp/mensajesCliente.ts),
 * tal como está en backend/scripts/manual/plantillasWhatsapp/plantillas.json:
 *
 *   HEADER  Reserva confirmada
 *   BODY    Tu reserva en *{{negocio_nombre}}* está confirmada ✅
 *
 *           🛎️ *{{servicio}}*
 *           📅 {{cita}}
 *
 *           _Para cambiarla o cancelarla, llama al {{negocio_telefono}}._
 *   BUTTONS Guardar contacto · Cómo llegar
 *
 * Los emojis son del mensaje que llega, no iconos de la web: se quedan
 * porque la plantilla los lleva. Si cambia la plantilla, cambia esto.
 */
export function WhatsappDelCliente({
  negocio,
  quien,
  confirmacion,
  conversacion,
  acento,
}: {
  negocio: string;
  quien: string;
  confirmacion: { servicio: string; cuando: string };
  conversacion: MensajeDeCliente[];
  acento: NicheAccent;
}) {
  const burbujas: BurbujaDeChat[] = [
    {
      de: "alhabla",
      texto: (
        <>
          <span className="block font-semibold">Reserva confirmada</span>
          <span className="mt-1 block">
            Tu reserva en <strong className="font-semibold">{negocio}</strong>{" "}
            está confirmada <span aria-hidden="true">✅</span>
          </span>
          <span className="mt-2 block font-semibold">
            <span aria-hidden="true">🛎️ </span>
            {confirmacion.servicio}
          </span>
          <span className="block">
            <span aria-hidden="true">📅 </span>
            {confirmacion.cuando}
          </span>
          <span className="mt-2 block italic text-apagado">
            Para cambiarla o cancelarla, llama al {TELEFONO_DEL_NEGOCIO}.
          </span>
        </>
      ),
      botones: ["Guardar contacto", "Cómo llegar"],
    },
    ...conversacion.map((mensaje): BurbujaDeChat => ({
      de: mensaje.de === "cliente" ? "yo" : "alhabla",
      texto: mensaje.texto,
    })),
  ];

  return (
    <ChatDeWhatsapp
      titulo="Alhabla Reservas"
      subtitulo="Cuenta de empresa"
      etiqueta={`El WhatsApp que recibe ${quien.split(" ")[0]} después de llamar`}
      burbujas={burbujas}
      accent={acento}
      pie="Ejemplo con nombres inventados."
      entrada={false}
    />
  );
}
