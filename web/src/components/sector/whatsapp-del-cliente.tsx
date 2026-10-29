import {
  ChatDeWhatsapp,
  type BurbujaDeChat,
} from "@/components/owner-assistant-chat";
import type { NicheAccent } from "@/lib/niche-landings";
import type { MensajeDeCliente } from "@/lib/sectores/tipos";

/**
 * Lo que pasa después de la llamada en el WhatsApp de quien llamó: contesta
 * a la confirmación (la cita de la escena del iPhone, que ya la enseña
 * entera en su paso 03) y la recepcionista se la cambia por chat
 * (modules/whatsapp/chatCliente.ts). La confirmación va citada, como la ve
 * en WhatsApp quien responde a un mensaje: «Reserva confirmada» es la
 * cabecera de la plantilla vigente, `confirmacion_cita_v3`, con su
 * servicio y su fecha.
 */
export function WhatsappDelCliente({
  quien,
  confirmacion,
  conversacion,
  acento,
}: {
  quien: string;
  confirmacion: { servicio: string; cuando: string };
  conversacion: MensajeDeCliente[];
  acento: NicheAccent;
}) {
  const burbujas: BurbujaDeChat[] = conversacion.map(
    (mensaje, i): BurbujaDeChat => ({
      de: mensaje.de === "cliente" ? "yo" : "alhabla",
      texto:
        i === 0 ? (
          <>
            <span className="mb-1.5 block rounded-md bg-white/10 px-2.5 py-1.5 text-xs leading-4">
              <span className="block font-semibold text-white/90">
                Alhabla Reservas
              </span>
              <span className="mt-0.5 block text-white/70">
                Reserva confirmada · {confirmacion.servicio},{" "}
                {confirmacion.cuando}
              </span>
            </span>
            {mensaje.texto}
          </>
        ) : (
          mensaje.texto
        ),
    })
  );

  return (
    <ChatDeWhatsapp
      titulo="Alhabla Reservas"
      subtitulo="Cuenta de empresa"
      etiqueta={`${quien.split(" ")[0]} contesta al WhatsApp de su cita`}
      burbujas={burbujas}
      accent={acento}
      pie="Ejemplo con nombres inventados."
      entrada={false}
    />
  );
}
