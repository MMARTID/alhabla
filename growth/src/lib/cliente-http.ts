import { api } from "./api";
import type { ClienteGrowth } from "./cliente";

/**
 * Pasa un objeto de filtros a parámetros de consulta: sin vacíos, las listas
 * separadas por comas (el backend las espera así: `estado=a,b`) y los
 * booleanos como texto.
 */
export function aParametros(
  filtros: object | undefined
): Record<string, string> {
  const parametros: Record<string, string> = {};
  if (!filtros) return parametros;
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    if (Array.isArray(valor)) {
      if (valor.length > 0) parametros[clave] = valor.join(",");
      continue;
    }
    parametros[clave] = String(valor);
  }
  return parametros;
}

const RUTA = "/growth/admin";

const segmento = (valor: string) => encodeURIComponent(valor);

/**
 * El cliente de verdad. Un POST sin cuerpo manda `{}`: Fastify 5 responde 400
 * a un POST con `content-type: application/json` y cuerpo vacío.
 */
export const clienteHttp: ClienteGrowth = {
  yo: async () => (await api.get(`${RUTA}/yo`)).data,
  resumen: async () => (await api.get(`${RUTA}/resumen`)).data,

  listarOportunidades: async (filtros) =>
    (await api.get(`${RUTA}/oportunidades`, { params: aParametros(filtros) }))
      .data,
  anadirUrl: async (nueva) =>
    (await api.post(`${RUTA}/oportunidades`, nueva)).data,
  detalleDeOportunidad: async (id) =>
    (await api.get(`${RUTA}/oportunidades/${segmento(id)}`)).data,
  decidir: async (id, decision) =>
    (await api.post(`${RUTA}/oportunidades/${segmento(id)}/decision`, decision))
      .data,

  listarBorradores: async (filtros) =>
    (await api.get(`${RUTA}/borradores`, { params: aParametros(filtros) }))
      .data,
  detalleDeBorrador: async (id) =>
    (await api.get(`${RUTA}/borradores/${segmento(id)}`)).data,
  editarBorrador: async (id, cambios) =>
    (await api.patch(`${RUTA}/borradores/${segmento(id)}`, cambios)).data,

  listarDecisiones: async (filtros) =>
    (await api.get(`${RUTA}/decisiones`, { params: aParametros(filtros) }))
      .data,
  listarGestiones: async (filtros) =>
    (await api.get(`${RUTA}/gestiones`, { params: aParametros(filtros) })).data,

  conocimiento: async (tipo) =>
    (await api.get(`${RUTA}/conocimiento`, { params: aParametros({ tipo }) }))
      .data,
  historialDeAfirmacion: async (clave) =>
    (await api.get(`${RUTA}/conocimiento/${segmento(clave)}/historial`)).data,

  listarEjecuciones: async (filtros) =>
    (await api.get(`${RUTA}/ejecuciones`, { params: aParametros(filtros) }))
      .data,
  detalleDeEjecucion: async (id) =>
    (await api.get(`${RUTA}/ejecuciones/${segmento(id)}`)).data,

  ajustes: async () => (await api.get(`${RUTA}/ajustes`)).data,
  guardarAjustes: async (cambios) =>
    (await api.put(`${RUTA}/ajustes`, cambios)).data,

  competidores: async () => (await api.get(`${RUTA}/competidores`)).data,
  detalleDeCompetidor: async (id) =>
    (await api.get(`${RUTA}/competidores/${segmento(id)}`)).data,
  analisisDeCompetidor: async (id, analisisId) =>
    (
      await api.get(
        `${RUTA}/competidores/${segmento(id)}/analisis/${segmento(analisisId)}`
      )
    ).data,
  anadirCompetidor: async (alta) =>
    (await api.post(`${RUTA}/competidores`, alta)).data,
  editarCompetidor: async (id, cambios) =>
    (await api.patch(`${RUTA}/competidores/${segmento(id)}`, cambios)).data,
  quitarCompetidor: async (id) => {
    // 204 sin cuerpo.
    await api.delete(`${RUTA}/competidores/${segmento(id)}`);
  },
  aceptarCompetidor: async (id) =>
    (await api.post(`${RUTA}/competidores/${segmento(id)}/aceptar`, {})).data,
  reanalizarCompetidor: async (id) =>
    (await api.post(`${RUTA}/competidores/${segmento(id)}/reanalizar`, {}))
      .data,
  revisarAnalisis: async (id, analisisId, revision) =>
    (
      await api.post(
        `${RUTA}/competidores/${segmento(id)}/analisis/${segmento(analisisId)}/revisar`,
        revision
      )
    ).data,
};
