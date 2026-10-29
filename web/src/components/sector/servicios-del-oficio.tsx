import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import type { NicheAccent } from "@/lib/niche-landings";
import type { NivelDeServicio, ServicioDelOficio } from "@/lib/sectores/tipos";

/** Las etiquetas de la app (frontend/src/components/professional-service-levels.tsx). */
const ETIQUETA: Record<NivelDeServicio, string> = {
  especialista: "Especialista",
  "lo-hace": "Lo hace",
  "no-sugerir": "No sugerir",
};

/** Los tonos de la app (servicios-escritorio.tsx, `TONO_DEL_NIVEL`), con
 * el acento del sector donde la app pone su morado. */
const TONO: Record<NivelDeServicio, string> = {
  especialista: "",
  "lo-hace": "border-exito-borde bg-exito-fondo text-exito",
  "no-sugerir": "border-linea bg-superficie text-apagado",
};

function estiloDelNivel(
  nivel: NivelDeServicio,
  acento: NicheAccent
): CSSProperties | undefined {
  if (nivel !== "especialista") return undefined;
  return {
    backgroundColor: acento.soft,
    color: acento.deep,
    borderColor: `color-mix(in srgb, ${acento.strong} 30%, transparent)`,
  };
}

/**
 * La tabla de servicios de la app (Agente → Servicios,
 * frontend/src/components/escritorio/agente/servicios-escritorio.tsx)
 * dibujada y quieta: cada servicio con su duración y, por persona, el nivel
 * como la pastilla desplegable de la app. Sin precio ni «Activo», que aquí
 * no cuentan nada. Desde `sm` es la tabla de la app; en el móvil, la misma
 * tabla con el equipo en la cabecera y, por servicio, su fila de nombre y
 * duración y debajo las tres pastillas.
 */
export function ServiciosDelOficio({
  equipo,
  servicios,
  acento,
}: {
  equipo: readonly [string, string, string];
  servicios: readonly ServicioDelOficio[];
  acento: NicheAccent;
}) {
  return (
    <figure aria-label="Tabla de servicios de ejemplo, como se ve en el panel">
      <div className="overflow-hidden rounded-3xl border border-linea bg-superficie">
        <table className="hidden w-full table-fixed text-sm sm:table">
          <caption className="sr-only">
            Servicios, duración y nivel de cada profesional
          </caption>
          <colgroup>
            <col />
            <col className="w-[5.75rem]" />
            {equipo.map((nombre, i) => (
              <col
                key={nombre}
                className={i === 2 ? "w-[8.5rem]" : "w-[7.75rem]"}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-linea bg-relleno text-left text-xs font-semibold uppercase tracking-[0.06em] text-apagado">
              <th scope="col" className="px-4 py-3 font-semibold">
                Servicio
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Duración
              </th>
              {equipo.map((nombre, i) => (
                <th
                  key={nombre}
                  scope="col"
                  className={`py-3 text-[13px] font-semibold normal-case tracking-normal text-tinta-2 ${
                    i === 2 ? "pl-1.5 pr-4" : "px-1.5"
                  }`}
                >
                  {nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicios.map(({ servicio, minutos, niveles }) => (
              <tr
                key={servicio}
                className="border-b border-linea-suave last:border-b-0"
              >
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-semibold leading-5 text-tinta"
                >
                  {servicio}
                </th>
                <td className="px-2 py-3">
                  <Duracion minutos={minutos} />
                </td>
                {niveles.map((nivel, i) => (
                  <td
                    key={equipo[i]}
                    className={`py-3 ${i === 2 ? "pl-1.5 pr-4" : "px-1.5"}`}
                  >
                    <Pastilla nivel={nivel} acento={acento} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full table-fixed text-sm sm:hidden">
          <caption className="sr-only">
            Servicios, duración y nivel de cada profesional
          </caption>
          <thead>
            <tr className="border-b border-linea bg-relleno">
              {equipo.map((nombre, i) => (
                <th
                  key={nombre}
                  scope="col"
                  className={`truncate py-2.5 text-left text-[13px] font-semibold text-tinta-2 ${
                    i === 0 ? "pl-4 pr-1" : i === 2 ? "pl-1 pr-4" : "px-1"
                  }`}
                >
                  {nombre}
                </th>
              ))}
            </tr>
          </thead>
          {servicios.map(({ servicio, minutos, niveles }) => (
            <tbody
              key={servicio}
              className="border-b border-linea-suave last:border-b-0"
            >
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="px-4 pb-2 pt-4 text-left font-normal"
                >
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold leading-5 text-tinta">
                      {servicio}
                    </span>
                    <Duracion minutos={minutos} />
                  </span>
                </th>
              </tr>
              <tr>
                {niveles.map((nivel, i) => (
                  <td
                    key={equipo[i]}
                    className={`pb-4 ${
                      i === 0 ? "pl-4 pr-1" : i === 2 ? "pl-1 pr-4" : "px-1"
                    }`}
                  >
                    <Pastilla nivel={nivel} acento={acento} />
                  </td>
                ))}
              </tr>
            </tbody>
          ))}
        </table>
      </div>
    </figure>
  );
}

/** La duración como el campo de la app: número y «min» apagado. */
function Duracion({ minutos }: { minutos: number }) {
  return (
    <span className="whitespace-nowrap text-sm tabular-nums text-tinta">
      {minutos} <span className="text-xs text-apagado">min</span>
    </span>
  );
}

/** El nivel como la pastilla desplegable de la app (aquí no se despliega). */
function Pastilla({
  nivel,
  acento,
}: {
  nivel: NivelDeServicio;
  acento: NicheAccent;
}) {
  return (
    <span
      className={`flex h-8 w-full items-center justify-between gap-1 rounded-full border pl-3 pr-2 text-xs font-semibold ${TONO[nivel]}`}
      style={estiloDelNivel(nivel, acento)}
    >
      <span className="truncate">{ETIQUETA[nivel]}</span>
      <ChevronDown
        className="hidden h-3.5 w-3.5 shrink-0 opacity-70 sm:block"
        aria-hidden="true"
      />
    </span>
  );
}
