import { Lock } from "lucide-react";
import { formatearDistancia } from "@/lib/formato";
import type { Ajustes } from "@/lib/types";

/** Los nombres de las claves del sistema que sabemos explicar. */
const ETIQUETA_DE_CLAVE_DEL_SISTEMA = new Map<string, string>([
  ["sistema.conocimiento", "Sincronización del conocimiento"],
]);

/** Las claves `sistema.*` no se editan: las escribe el propio sistema. */
export function clavesDelSistema(ajustes: Ajustes): Array<{
  clave: string;
  actualizadoEn: string | null;
}> {
  return Object.entries(ajustes.actualizadoEn)
    .filter(([clave]) => clave.startsWith("sistema."))
    .map(([clave, actualizadoEn]) => ({ clave, actualizadoEn }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
}

/**
 * Lo que se enseña pero no se toca: los plazos fijos del código y las claves
 * que escribe el sistema (`sistema.*`). Sin ningún campo editable a propósito.
 */
export function SoloLectura({ ajustes }: { ajustes: Ajustes }) {
  const delSistema = clavesDelSistema(ajustes);
  return (
    <section
      aria-labelledby="ajustes-solo-lectura"
      className="panel p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-relleno-fuerte text-apagado">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="ajustes-solo-lectura"
            className="text-base font-semibold text-tinta"
          >
            Fijo, solo lectura
          </h2>
          <p className="mt-1 text-sm text-muted">
            Plazos que fija el código y valores que escribe el sistema. No se
            cambian desde aquí.
          </p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-linea-suave text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
          <dt className="text-tinta-2">
            Retención de textos de páginas ajenas
          </dt>
          <dd className="font-semibold text-tinta">
            {ajustes.soloLectura.retencionDias} días
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
          <dt className="text-tinta-2">Entre dos contactos al mismo dominio</dt>
          <dd className="font-semibold text-tinta">
            {ajustes.soloLectura.diasEntreContactosAlMismoDominio} días
          </dd>
        </div>
        {delSistema.map(({ clave, actualizadoEn }) => (
          <div
            key={clave}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
          >
            <dt className="min-w-0 text-tinta-2">
              {ETIQUETA_DE_CLAVE_DEL_SISTEMA.get(clave) ?? "Valor del sistema"}
              <span className="block break-all font-mono text-xs text-muted">
                {clave}
              </span>
            </dt>
            <dd className="text-tinta">
              {actualizadoEn
                ? `Actualizado ${formatearDistancia(actualizadoEn)}`
                : "Sin actualizar"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
