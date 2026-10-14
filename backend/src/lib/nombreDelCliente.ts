/**
 * El nombre con el que se reserva tiene que ser el de quien llama. En el
 * laboratorio del 14-10 la recepcionista llamó a book_appointment antes de
 * preguntarlo, con clientName vacío, «Cliente», «No indicado» o la variable
 * del prompt sin sustituir (`{{nombre_cliente}}`): los dos últimos tipos
 * habrían creado citas con un nombre falso. book_appointment los rechaza
 * para que lo pregunte.
 */
const NOMBRES_DE_RELLENO = new Set([
  "cliente",
  "el cliente",
  "la cliente",
  "no indicado",
  "no indicada",
  "sin nombre",
  "desconocido",
  "desconocida",
  "anonimo",
  "anonima",
  "usuario",
  "nombre",
  "pendiente",
  "por confirmar",
  "n/a",
  "na",
  "x",
  "-",
]);

export function esNombreDeClienteValido(
  nombre: string | null | undefined
): boolean {
  if (typeof nombre !== "string") return false;
  const limpio = nombre.trim();
  if (!limpio || limpio.includes("{{") || limpio.includes("}}")) return false;
  const normalizado = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.,;:!¡?¿"']/g, "")
    .trim();
  return !NOMBRES_DE_RELLENO.has(normalizado);
}
