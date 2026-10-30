import { ListaDeComprobaciones } from "@/components/lista-de-comprobaciones";
import { analizarError } from "@/lib/api-errors";

/**
 * Qué hacer ante un `409` con `codigo`: el texto del backend dice qué pasó y
 * esta línea, qué hacer ahora. Los códigos son los del contrato de la API.
 */
const AYUDA_POR_CODIGO: Record<string, string> = {
  cumplimiento:
    "El borrador ha quedado bloqueado. Corrige lo que sale en rojo, guarda y vuelve a aprobar.",
  tope_semanal:
    "Marca como gestionado algún contacto ya enviado, o cambia el tope en Ajustes.",
  dominio_ya_aprobado:
    "Solo un contacto por dominio cada 90 días: gestiona o descarta primero el otro.",
  dominio_en_enfriamiento:
    "Solo un contacto por dominio cada 90 días: espera a que pasen o descarta esta oportunidad.",
  caducada: "Ya no se puede aprobar. Descártala o déjala caducar.",
  pausa: "Quita la pausa en Ajustes para que el agente vuelva a trabajar.",
  conflicto: "Alguien lo cambió mientras tanto: recarga y vuelve a revisarlo.",
  ya_calificada:
    "Esa oportunidad ya estaba calificada: recarga para ver cómo está ahora.",
};

/**
 * Los `409` de AGENDA: dependen de cuándo se hace algo (la semana llena, un
 * dominio contactado hace poco o ya aprobado), no de lo que dice el texto. El
 * backend responde sin cambiar nada: el borrador NO queda bloqueado.
 */
const CODIGOS_DE_AGENDA: ReadonlySet<string> = new Set([
  "tope_semanal",
  "dominio_en_enfriamiento",
  "dominio_ya_aprobado",
]);

/** ¿Es un fallo de agenda (y no del texto)? */
export function esFalloDeAgenda(codigo: string | null): boolean {
  return codigo !== null && CODIGOS_DE_AGENDA.has(codigo);
}

/**
 * El fallo de una acción (aprobar, guardar, descartar…) con su causa: el texto
 * del backend, qué hacer a continuación y, en un `409` de cumplimiento, las
 * reglas que fallan. Es un `role="alert"`. Lo que la persona tenía escrito no
 * se toca: este aviso nunca limpia ni redirige.
 *
 * Un fallo de AGENDA (`tope_semanal`, `dominio_en_enfriamiento`,
 * `dominio_ya_aprobado`) no es un error del texto: se pinta como aviso (ámbar,
 * no rojo) y dice que el borrador no queda bloqueado. `cambiosGuardados` es
 * `true` cuando la acción había guardado ya las ediciones (Aprobar con
 * ediciones) y lo que falló fue aprobar.
 */
export function AvisoDeErrorDeAccion({
  error,
  respaldo,
  className = "",
  cambiosGuardados = false,
}: {
  error: unknown;
  respaldo: string;
  className?: string;
  cambiosGuardados?: boolean;
}) {
  if (error === null || error === undefined) return null;
  const { mensaje, codigo, comprobaciones } = analizarError(error, respaldo);
  const ayuda = codigo ? AYUDA_POR_CODIGO[codigo] : undefined;
  const deAgenda = esFalloDeAgenda(codigo);
  const fallidas = (comprobaciones ?? []).filter((c) => !c.ok);
  const aMostrar = fallidas.length > 0 ? fallidas : (comprobaciones ?? []);
  return (
    <div
      role="alert"
      className={`rounded-[10px] border p-3 text-sm ${
        deAgenda
          ? "border-aviso-borde bg-aviso-fondo"
          : "border-error-borde bg-error-fondo"
      } ${className}`}
    >
      <p className={`font-semibold ${deAgenda ? "text-aviso" : "text-error"}`}>
        {mensaje}
      </p>
      {ayuda ? <p className="mt-1 text-tinta-2">{ayuda}</p> : null}
      {deAgenda ? (
        <p className="mt-1 text-tinta-2">
          {cambiosGuardados
            ? "Tus cambios sí se guardaron; lo que no se hizo fue aprobar. El borrador no queda bloqueado por esto."
            : "No se ha cambiado nada y el borrador no queda bloqueado: es una regla de agenda, no del texto. Lo que escribiste sigue aquí."}
        </p>
      ) : null}
      {aMostrar.length > 0 ? (
        <div className="mt-3">
          <ListaDeComprobaciones comprobaciones={aMostrar} />
        </div>
      ) : null}
    </div>
  );
}
