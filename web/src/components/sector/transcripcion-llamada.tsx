import { CalendarCheck, CalendarSearch, Phone } from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import { DesplieguePorLineas } from "@/components/sector/despliegue-por-lineas";
import type { NicheAccent } from "@/lib/niche-landings";
import type { LineaDeLlamada } from "@/lib/sectores/tipos";

const ICONOS = {
  agenda: CalendarSearch,
  reserva: CalendarCheck,
  whatsapp: SiWhatsapp,
} as const;

/**
 * Cada línea en el despliegue (despliegue-por-lineas.tsx): la que ya se veía
 * al hidratar (`data-vista`) no se toca; las demás, escondidas y un poco
 * desenfocadas mientras esperan, sin transición para que no se las vea
 * irse; al desplegar entra con su retraso, una detrás de otra, con salida
 * exponencial.
 */
const CLASES_DE_LINEA =
  "list-none transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] [transition-delay:calc(var(--linea)*160ms)] group-data-[despliegue=esperando]:transition-none [&:not([data-vista])]:group-data-[despliegue=esperando]:translate-y-1.5 [&:not([data-vista])]:group-data-[despliegue=esperando]:opacity-0 [&:not([data-vista])]:group-data-[despliegue=esperando]:blur-[3px]";

/**
 * La llamada de ejemplo como se lee en el panel: transcrita sobre la
 * superficie oscura y, entre frase y frase, lo que hace la recepcionista sin
 * decirlo. El saludo es el aviso legal literal del backend
 * (lib/idiomas/catalogo.ts, `presentacion`), así que lo pone este componente
 * y no cada sector.
 */
export function TranscripcionLlamada({
  negocio,
  quien,
  duracion,
  lineas,
  acento,
}: {
  negocio: string;
  quien: string;
  duracion: string;
  lineas: LineaDeLlamada[];
  acento: NicheAccent;
}) {
  const nombre = quien.split(" ")[0];
  const todas: LineaDeLlamada[] = [
    {
      de: "recepcionista",
      texto: `${negocio}, te atiende su recepcionista de IA. ¿En qué te ayudo?`,
    },
    ...lineas,
  ];

  return (
    <figure aria-label={`Transcripción de una llamada de ejemplo a ${negocio}`}>
      <div className="rounded-3xl bg-oscuro p-5 text-white sm:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: acento.strong }}
            >
              <Phone className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{quien}</p>
              <p className="text-xs text-white/60">
                Llamada atendida · {duracion}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-xs font-medium text-white/60">
            Transcripción
          </p>
        </div>

        <DesplieguePorLineas className="mt-5 space-y-3.5">
          {todas.map((linea, i) => (
            <li key={i} className={CLASES_DE_LINEA}>
              {"accion" in linea ? (
                <Accion linea={linea} acento={acento} />
              ) : (
                <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                  <p className="text-xs font-semibold uppercase leading-6 tracking-[0.12em] text-white/60">
                    {linea.de === "recepcionista" ? "Recepcionista" : nombre}
                  </p>
                  <p
                    className={
                      linea.de === "recepcionista"
                        ? "text-[0.95rem] leading-6 text-white"
                        : "text-[0.95rem] leading-6 text-white/75"
                    }
                  >
                    {linea.texto}
                  </p>
                </div>
              )}
            </li>
          ))}
        </DesplieguePorLineas>
      </div>
      <figcaption className="mt-3 px-1 text-xs leading-5 text-apagado">
        Ejemplo con nombres inventados.
      </figcaption>
    </figure>
  );
}

function Accion({
  linea,
  acento,
}: {
  linea: Extract<LineaDeLlamada, { accion: string }>;
  acento: NicheAccent;
}) {
  const Icono = ICONOS[linea.icono];
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm leading-5 text-white/80 sm:ml-[8.5rem]">
      <Icono
        className="mt-0.5 h-4 w-4 shrink-0"
        color={acento.strong}
        style={{ color: acento.strong }}
        aria-hidden="true"
      />
      {linea.accion}
    </p>
  );
}
