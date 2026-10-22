import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import type { NicheAccent } from "@/lib/niche-landings";
import type { Escenario, Turno } from "@/lib/gestor-guiones";
import { Reveal } from "@/components/scroll-reveal";

const FALLBACK_ACCENT: NicheAccent = { strong: "#8b5cf6", soft: "#f3eeff", deep: "#6d28d9" };

/**
 * Mockup quieto de una conversación por WhatsApp entre el dueño y su Gestor
 * (la página del Gestor, /agenda-por-whatsapp). Desde el 2026-10-22 pinta una
 * situación de `lib/gestor-guiones.ts`, la misma fuente que la simulación de
 * las landings: los textos están contrastados con el backend allí y no hay
 * una segunda copia que pueda quedarse atrás. Cada propuesta lleva sus
 * botones pegados, como en WhatsApp, con el que pulsa el dueño (el turno
 * siguiente del guion) resaltado; los «Hecho:» van en verde de estado (una
 * acción ya hecha). Los botones pulsados no se repiten como burbuja.
 *
 * Colores de burbuja iguales al resto del sitio (negro/blanco): el icono y
 * la cabecera ya dejan claro que es WhatsApp, así que no hace falta el verde
 * de marca de WhatsApp — mantiene la Regla del Acento Único.
 */
export function OwnerAssistantChatMockup({ escenario, accent }: { escenario: Escenario; accent?: NicheAccent }) {
  const a = accent ?? FALLBACK_ACCENT;
  const turnos = escenario.turnos;
  return (
    <div className="overflow-hidden rounded-3xl border border-linea bg-white">
      <div className="flex items-center gap-3 border-b border-linea bg-relleno px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-exito-fondo text-[#25D366]">
          <SiWhatsapp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-tinta">Alhabla</p>
          <p className="text-xs leading-4 text-apagado">Tu Gestor por WhatsApp</p>
        </div>
      </div>

      <ol className="flex flex-col gap-2 p-4 sm:p-5">
        {turnos.map((turno, i) => {
          if (turno.de === "boton") return null;
          const siguiente = turnos[i + 1];
          const pulsado = siguiente?.de === "boton" ? siguiente.texto : null;
          return (
            <Reveal key={i} delay={Math.min(i * 0.1, 0.72)} y={10}>
              <li className="list-none">
                <Mensaje turno={turno} pulsado={pulsado} acento={a} />
              </li>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}

function Mensaje({
  turno,
  pulsado,
  acento,
}: {
  turno: Exclude<Turno, { de: "boton" }>;
  pulsado: string | null;
  acento: NicheAccent;
}) {
  if (turno.de === "dueno") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-tinta px-3.5 py-2 text-sm font-medium leading-5 text-white">
          {turno.texto}
        </p>
      </div>
    );
  }
  const hecho = turno.texto.startsWith("Hecho:");
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p
        className={
          hecho
            ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-exito-fondo px-3.5 py-2 text-sm font-semibold leading-5 text-exito"
            : "max-w-[85%] rounded-2xl rounded-bl-sm border border-linea bg-white px-3.5 py-2 text-sm leading-5 text-tinta"
        }
      >
        {turno.texto}
      </p>
      {turno.botones ? (
        <div className="flex w-full gap-1.5 pl-1 sm:max-w-[85%]">
          {turno.botones.map((boton) =>
            boton === pulsado ? (
              <span
                key={boton}
                className="flex-1 rounded-full border px-3 py-1.5 text-center text-sm font-semibold"
                style={{ borderColor: acento.strong, backgroundColor: acento.soft, color: acento.deep }}
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
