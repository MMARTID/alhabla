import type { ReactNode } from "react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import type { NicheAccent } from "@/lib/niche-landings";
import type { Escenario } from "@/lib/gestor-guiones";
import { Reveal } from "@/components/scroll-reveal";

/** Verde de marca de WhatsApp, solo para su logotipo. */
const VERDE_WHATSAPP = "#25D366";

export type BurbujaDeChat = {
  /** «yo»: quien tiene el móvil (el dueño o el cliente), a la derecha y en
   * negro; «alhabla»: tu asistente o la recepcionista, a la izquierda. */
  de: "yo" | "alhabla";
  texto: ReactNode;
  /** Los botones pegados al mensaje, como en WhatsApp. */
  botones?: readonly string[];
  /** El botón que pulsó quien tiene el móvil, resaltado. */
  pulsado?: string | null;
  /** Una acción ya hecha («Hecho: …»), en verde de estado. */
  hecho?: boolean;
};

/**
 * Mockup quieto de un chat de WhatsApp con Alhabla. Colores de burbuja
 * iguales al resto del sitio (negro/blanco): el icono y la cabecera ya
 * dejan claro que es WhatsApp, así que no hace falta el verde de marca de
 * WhatsApp en las burbujas (la Regla del Acento Único). Los botones
 * pulsados no se repiten como burbuja: se resaltan en el mensaje.
 */
export function ChatDeWhatsapp({
  titulo,
  subtitulo,
  burbujas,
  etiqueta,
  pie,
  accent,
  entrada = true,
}: {
  titulo: string;
  subtitulo: string;
  burbujas: BurbujaDeChat[];
  /** Nombre accesible del chat («Conversación de ejemplo con…»). */
  etiqueta: string;
  /** Nota bajo el chat («Ejemplo; los nombres son inventados.»). */
  pie?: string;
  /** Acento del sector para el botón pulsado; sin él, el morado. */
  accent?: NicheAccent;
  /** Las burbujas entran una a una al verse. Las landings de sector lo
   * quitan: allí el único movimiento es la transcripción de la llamada. */
  entrada?: boolean;
}) {
  return (
    <figure aria-label={etiqueta}>
      <div className="overflow-hidden rounded-3xl border border-linea bg-superficie">
        <div className="flex items-center gap-3 border-b border-linea bg-relleno px-4 py-3 sm:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-exito-fondo">
            <SiWhatsapp
              className="h-5 w-5"
              color={VERDE_WHATSAPP}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-tinta">
              {titulo}
            </p>
            <p className="text-xs leading-4 text-apagado">{subtitulo}</p>
          </div>
        </div>

        <ol className="flex flex-col gap-2 p-4 sm:p-5">
          {burbujas.map((burbuja, i) => (
            <li key={i} className="list-none">
              {entrada ? (
                <Reveal delay={Math.min(i * 0.1, 0.72)} y={10}>
                  <Mensaje burbuja={burbuja} accent={accent} />
                </Reveal>
              ) : (
                <Mensaje burbuja={burbuja} accent={accent} />
              )}
            </li>
          ))}
        </ol>
      </div>
      {pie ? (
        <figcaption className="mt-3 px-1 text-xs leading-5 text-tenue">
          {pie}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * La conversación del dueño con tu asistente (/agenda-por-whatsapp y la
 * pieza de las páginas que la enseñan). Pinta una situación de
 * `lib/gestor-guiones.ts`, la misma fuente que la simulación de las
 * landings: los textos están contrastados con el backend allí y no hay una
 * segunda copia que pueda quedarse atrás. El botón que pulsa el dueño es el
 * turno siguiente del guion.
 */
export function OwnerAssistantChatMockup({
  escenario,
  accent,
  pie,
  entrada = true,
}: {
  escenario: Escenario;
  accent?: NicheAccent;
  pie?: string;
  /** Ver `ChatDeWhatsapp`. */
  entrada?: boolean;
}) {
  const turnos = escenario.turnos;
  const burbujas: BurbujaDeChat[] = [];
  turnos.forEach((turno, i) => {
    if (turno.de === "boton") return;
    const siguiente = turnos[i + 1];
    burbujas.push(
      turno.de === "dueno"
        ? { de: "yo", texto: turno.texto }
        : {
            de: "alhabla",
            texto: turno.texto,
            botones: turno.botones,
            pulsado: siguiente?.de === "boton" ? siguiente.texto : null,
            hecho: turno.texto.startsWith("Hecho:"),
          }
    );
  });
  return (
    <ChatDeWhatsapp
      titulo="Alhabla"
      subtitulo="Tu asistente por WhatsApp"
      etiqueta="Conversación de ejemplo con tu asistente por WhatsApp"
      burbujas={burbujas}
      accent={accent}
      pie={pie}
      entrada={entrada}
    />
  );
}

function Mensaje({
  burbuja,
  accent,
}: {
  burbuja: BurbujaDeChat;
  accent?: NicheAccent;
}) {
  if (burbuja.de === "yo") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-tinta px-3.5 py-2 text-sm font-medium leading-5 text-sobre-tinta">
          {burbuja.texto}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p
        className={
          burbuja.hecho
            ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-exito-fondo px-3.5 py-2 text-sm font-semibold leading-5 text-exito"
            : "max-w-[85%] rounded-2xl rounded-bl-sm border border-linea bg-superficie px-3.5 py-2 text-sm leading-5 text-tinta"
        }
      >
        {burbuja.texto}
      </p>
      {burbuja.botones?.length ? (
        <div className="flex w-full gap-1.5 pl-1 sm:max-w-[85%]">
          {burbuja.botones.map((boton) =>
            boton === burbuja.pulsado ? (
              <span
                key={boton}
                className={`flex-1 rounded-full border px-3 py-1.5 text-center text-sm font-semibold ${
                  accent ? "" : "border-morado bg-lavado text-morado-tinta"
                }`}
                style={
                  accent
                    ? {
                        borderColor: accent.strong,
                        backgroundColor: accent.soft,
                        color: accent.deep,
                      }
                    : undefined
                }
              >
                {boton}
              </span>
            ) : (
              <span
                key={boton}
                className="flex-1 rounded-full border border-linea px-3 py-1.5 text-center text-sm font-medium text-apagado"
              >
                {boton}
              </span>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
