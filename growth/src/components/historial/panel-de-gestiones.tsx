"use client";

import { HandHelping, SearchX } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { D2Chips, type OpcionDeChip } from "@/components/comunes/d2-chips";
import {
  D2CampoDeFecha,
  D2CampoDeFiltroDeTexto,
  D2CampoSelector,
} from "@/components/comunes/d2-campos";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { Paginacion } from "@/components/paginacion";
import { useGestiones } from "@/lib/consultas";
import {
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_RESULTADO_DE_GESTION,
} from "@/lib/etiquetas";
import { CANALES, type Canal, type ResultadoDeGestion } from "@/lib/types";
import { FilaDeGestion } from "./fila-de-gestion";
import { normalizarDominio, rangoDeFechas } from "./filtros-de-historial";

export const GESTIONES_POR_PAGINA = 20;

const RESULTADOS: readonly ResultadoDeGestion[] = [
  "pendiente",
  "aceptado",
  "rechazado",
  "sin_respuesta",
];

type Filtros = {
  resultado: ResultadoDeGestion | null;
  canal: Canal | "";
  dominio: string;
  desde: string;
  hasta: string;
};

const SIN_FILTROS: Filtros = {
  resultado: null,
  canal: "",
  dominio: "",
  desde: "",
  hasta: "",
};

/**
 * Las gestiones: lo que hiciste a mano tras aprobar (canal, dominio, fecha),
 * con su resultado y, si la hubo, la URL conseguida. De solo lectura: marcar
 * algo como gestionado se hace desde la Revisión.
 */
export function PanelDeGestiones() {
  const idErrorDeFechas = useId();
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  // Cambiar la clave vacía el campo de texto, que guarda su propio borrador.
  const [reinicio, setReinicio] = useState(0);
  const rango = rangoDeFechas(filtros.desde, filtros.hasta);

  const consulta = useGestiones({
    resultado: filtros.resultado ?? undefined,
    canal: filtros.canal || undefined,
    dominio: filtros.dominio || undefined,
    fechaDesde: rango.desde,
    fechaHasta: rango.hasta,
    pagina,
    limite: GESTIONES_POR_PAGINA,
  });

  function cambiar(parcial: Partial<Filtros>) {
    setFiltros((actuales) => ({ ...actuales, ...parcial }));
    setPagina(1);
  }

  // El backend cuenta cada resultado con los demás filtros puestos, así que
  // los contadores no cambian al elegir uno.
  const porResultado = consulta.data?.conteos.porResultado;
  const opcionesDeResultado = useMemo<
    OpcionDeChip<ResultadoDeGestion>[]
  >(() => {
    const total = RESULTADOS.reduce(
      (suma, r) => suma + (porResultado?.[r] ?? 0),
      0
    );
    return [
      {
        valor: null,
        etiqueta: "Todas",
        cuenta: porResultado ? total : undefined,
      },
      ...RESULTADOS.map((resultado) => ({
        valor: resultado,
        etiqueta: ETIQUETA_DE_RESULTADO_DE_GESTION[resultado],
        cuenta: porResultado ? (porResultado[resultado] ?? 0) : undefined,
      })),
    ];
  }, [porResultado]);

  const hayFiltros =
    filtros.resultado !== null ||
    filtros.canal !== "" ||
    filtros.dominio !== "" ||
    filtros.desde !== "" ||
    filtros.hasta !== "";

  return (
    <div>
      <div className="mb-4">
        <D2Chips
          etiqueta="Resultado de la gestión"
          opciones={opcionesDeResultado}
          valor={filtros.resultado}
          alCambiar={(resultado) => cambiar({ resultado })}
        />
      </div>

      <fieldset className="panel m-0 mb-5 min-w-0 p-4 sm:p-5">
        <legend className="sr-only">Filtros de las gestiones</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <D2CampoSelector
            className="col-span-2 lg:col-span-1"
            etiqueta="Canal"
            valor={filtros.canal}
            alCambiar={(canal) => cambiar({ canal: canal as Canal | "" })}
            opciones={CANALES.map((canal) => ({
              valor: canal,
              etiqueta: ETIQUETA_DE_CANAL[canal],
            }))}
            textoDeTodos="Todos los canales"
          />
          <D2CampoDeFiltroDeTexto
            className="col-span-2 lg:col-span-1"
            key={reinicio}
            etiqueta="Dominio"
            valorAplicado={filtros.dominio}
            normalizar={normalizarDominio}
            alAplicar={(dominio) => cambiar({ dominio })}
            placeholder="revista.example"
          />
          <D2CampoDeFecha
            etiqueta="Desde"
            valor={filtros.desde}
            alCambiar={(desde) => cambiar({ desde })}
            invalido={rango.invalido}
            descripcionDelErrorId={idErrorDeFechas}
          />
          <D2CampoDeFecha
            etiqueta="Hasta"
            valor={filtros.hasta}
            alCambiar={(hasta) => cambiar({ hasta })}
            invalido={rango.invalido}
            descripcionDelErrorId={idErrorDeFechas}
          />
        </div>
        {rango.invalido ? (
          <p
            id={idErrorDeFechas}
            className="mt-2 text-sm text-error"
            role="alert"
          >
            «Desde» es posterior a «Hasta»: no se aplica ninguna de las dos
            fechas.
          </p>
        ) : null}
        {hayFiltros ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-secondary h-11 px-4"
              onClick={() => {
                setFiltros(SIN_FILTROS);
                setPagina(1);
                setReinicio((n) => n + 1);
              }}
            >
              Quitar filtros
            </button>
          </div>
        ) : null}
      </fieldset>

      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudo cargar el historial de gestiones"
      >
        {(lista) => {
          if (lista.data.length === 0) {
            return hayFiltros ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ninguna gestión coincide con estos filtros"
              >
                Prueba con otro resultado o canal, o quita algún filtro.
              </EstadoVacio>
            ) : (
              <EstadoVacio
                icono={HandHelping}
                titulo="Todavía no hay gestiones"
              >
                Cuando envíes un correo o rellenes un formulario de una
                oportunidad aprobada y lo marques como gestionado, aparecerá
                aquí con su canal y su fecha.
              </EstadoVacio>
            );
          }
          return (
            <div aria-busy={consulta.isPlaceholderData}>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {lista.total} {lista.total === 1 ? "gestión" : "gestiones"}
                {hayFiltros ? " con estos filtros" : ""}
              </p>
              <ol
                aria-label="Gestiones"
                className={`space-y-3 ${consulta.isPlaceholderData ? "opacity-60" : ""}`}
              >
                {lista.data.map((gestion) => (
                  <FilaDeGestion key={gestion.id} gestion={gestion} />
                ))}
              </ol>
              <Paginacion
                pagina={lista.pagina}
                limite={lista.limite}
                total={lista.total}
                alCambiar={setPagina}
                cargando={consulta.isPlaceholderData}
              />
            </div>
          );
        }}
      </EstadoDeConsulta>
    </div>
  );
}
