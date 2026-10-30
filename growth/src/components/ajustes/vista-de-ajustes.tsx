"use client";

import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { useAjustes } from "@/lib/consultas";
import { FormularioDeAjustes } from "./formulario-de-ajustes";
import { ListaDeCompetidores } from "./lista-de-competidores";
import { SoloLectura } from "./solo-lectura";
import { TarjetaDePausa } from "./tarjeta-de-pausa";

/**
 * Ajustes: el control del sistema. La pausa general (con confirmación), los
 * umbrales de puntuación por objetivo, el tope de contactos y el umbral de
 * similitud; lo fijo en solo lectura y la lista de competidores. Cada cambio
 * queda en el Historial.
 */
export function VistaDeAjustes() {
  const consulta = useAjustes();
  return (
    <>
      <EncabezadoDePagina
        titulo="Ajustes"
        descripcion="Umbrales, topes de contacto y el interruptor general de pausa. Cada cambio queda en el Historial."
      />
      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudieron cargar los ajustes"
        filas={4}
      >
        {(ajustes) => (
          <div className="space-y-5">
            <TarjetaDePausa ajustes={ajustes} />
            <FormularioDeAjustes ajustes={ajustes} />
            <SoloLectura ajustes={ajustes} />
          </div>
        )}
      </EstadoDeConsulta>
      <ListaDeCompetidores />
    </>
  );
}
