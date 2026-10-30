"use client";

import { BookOpen, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { D2Chips, type OpcionDeChip } from "@/components/comunes/d2-chips";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { useConocimiento } from "@/lib/consultas";
import { ETIQUETA_DE_TIPO_DE_AFIRMACION } from "@/lib/etiquetas";
import type { RespuestaDeConocimiento, TipoDeAfirmacion } from "@/lib/types";
import { BarraDeSnapshot } from "./barra-de-snapshot";
import { CambiosRecientes } from "./cambios-recientes";
import { GrupoDeAfirmaciones } from "./grupo-de-afirmaciones";
import {
  ORDEN_DE_TIPOS,
  coincideConLaBusqueda,
  normalizarParaBuscar,
} from "./utilidades";

/**
 * Conocimiento: qué sabe el sistema de Alhabla. Las afirmaciones vigentes
 * agrupadas por tipo, cada una con su clave, su fuente y su commit; el estado
 * de la última sincronización; lo que cambió hace poco; y, arriba del todo,
 * lo que NO se puede decir (los términos prohibidos y las limitaciones).
 */
export function VistaDeConocimiento() {
  const consulta = useConocimiento();
  return (
    <>
      <EncabezadoDePagina
        titulo="Conocimiento"
        descripcion="Lo que Alhabla puede decir, con su fuente y su commit. Un borrador solo puede afirmar lo que está aquí."
      />
      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudo cargar el conocimiento"
        filas={5}
      >
        {(datos) => <ContenidoDeConocimiento datos={datos} />}
      </EstadoDeConsulta>
    </>
  );
}

function ContenidoDeConocimiento({
  datos,
}: {
  datos: RespuestaDeConocimiento;
}) {
  const [tipo, setTipo] = useState<TipoDeAfirmacion | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const consulta = normalizarParaBuscar(busqueda);

  const total = ORDEN_DE_TIPOS.reduce(
    (suma, t) => suma + (datos.conteos[t] ?? datos.porTipo[t]?.length ?? 0),
    0
  );

  const opciones = useMemo<OpcionDeChip<TipoDeAfirmacion>[]>(
    () => [
      { valor: null, etiqueta: "Todo", cuenta: total },
      ...ORDEN_DE_TIPOS.map((t) => ({
        valor: t,
        etiqueta: ETIQUETA_DE_TIPO_DE_AFIRMACION[t],
        cuenta: datos.conteos[t] ?? datos.porTipo[t]?.length ?? 0,
      })),
    ],
    [datos, total]
  );

  const grupos = useMemo(
    () =>
      ORDEN_DE_TIPOS.filter((t) => tipo === null || tipo === t)
        .map((t) => {
          const todas = datos.porTipo[t] ?? [];
          return {
            tipo: t,
            total: datos.conteos[t] ?? todas.length,
            afirmaciones: todas.filter((a) =>
              coincideConLaBusqueda(a, consulta)
            ),
          };
        })
        .filter((g) => g.afirmaciones.length > 0),
    [datos, tipo, consulta]
  );

  if (datos.snapshot === null && total === 0) {
    return (
      <EstadoVacio
        icono={BookOpen}
        titulo="Todavía no se ha sincronizado el conocimiento"
      >
        Las afirmaciones salen del repositorio (precios, funciones, límites,
        sectores, comparativas y lo que no se puede decir) y las carga el
        sincronizador. Hasta entonces ningún borrador puede citar una afirmación
        vigente.
      </EstadoVacio>
    );
  }

  const visibles = grupos.reduce((suma, g) => suma + g.afirmaciones.length, 0);
  const filtrando = tipo !== null || consulta !== "";

  return (
    <div className="space-y-5">
      <BarraDeSnapshot
        snapshot={datos.snapshot}
        vigentes={datos.snapshot?.vigentes ?? total}
        truncado={datos.truncado}
      />

      <div className="space-y-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-tinta-2">
            Buscar en el conocimiento
          </span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue"
              aria-hidden="true"
            />
            <input
              type="search"
              className="field w-full pl-10"
              placeholder="Clave, texto o fuente: precio.plan, peluquería, plans.ts…"
              autoComplete="off"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </span>
        </label>
        <D2Chips
          etiqueta="Tipo de afirmación"
          opciones={opciones}
          valor={tipo}
          alCambiar={setTipo}
        />
        {filtrando ? (
          <p className="text-sm text-muted" aria-live="polite">
            {visibles} {visibles === 1 ? "afirmación" : "afirmaciones"} de{" "}
            {total}
          </p>
        ) : null}
      </div>

      {grupos.length === 0 ? (
        <EstadoVacio icono={SearchX} titulo="Ninguna afirmación coincide">
          {consulta !== ""
            ? `No hay nada vigente que contenga «${busqueda.trim()}»${tipo ? ` en ${ETIQUETA_DE_TIPO_DE_AFIRMACION[tipo].toLowerCase()}` : ""}.`
            : "No hay afirmaciones vigentes de este tipo."}
        </EstadoVacio>
      ) : (
        grupos.map((grupo) => (
          <GrupoDeAfirmaciones
            key={grupo.tipo}
            tipo={grupo.tipo}
            afirmaciones={grupo.afirmaciones}
            total={grupo.total}
          />
        ))
      )}

      {tipo === null && consulta === "" ? (
        <CambiosRecientes cambios={datos.cambiosRecientes} />
      ) : null}
    </div>
  );
}
