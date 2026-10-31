/**
 * Los negocios de prueba del laboratorio de prompt
 * (scripts/laboratorioDePrompt.ts): qué negocio de dev necesita cada guion de
 * la batería (laboratorioDePrompt.escenarios.ts, campo `requiere`).
 *
 * Este fichero es el CONTRATO entre dos piezas y no tiene dependencias:
 * - la siembra (scripts/sembrarNegociosDeLaboratorio.ts) crea en la BD de dev
 *   estos negocios, con estos ids;
 * - el laboratorio lee de aquí el negocio de cada guion y los teléfonos de
 *   ficción, sin tocar la BD para saberlo.
 *
 * Por qué hay tantos negocios y no uno: el laboratorio reparte las llamadas
 * antiguas de un negocio por orden, sin mirar qué guion las usa (ver
 * `repartirLlamadas`), así que dos guiones que necesitan llamadas distintas
 * (un teléfono que aún no ha decidido si le graban, uno con una cita futura,
 * uno con el número oculto…) no pueden compartir negocio. Los que sí pueden
 * comparten el de la peluquería base.
 *
 * Los teléfonos de los clientes sembrados son números de ficción: nadie puede
 * contestar a +1 555 0100–0199 (ni existe el prefijo 555 como zona), y ningún
 * negocio sembrado tiene número de Telnyx para enviar (salvo los dos de
 * transferencia, que no reservan). Así una repetición del laboratorio no
 * escribe a nadie.
 */

export interface NegocioDeLaboratorio {
  /** «peluqueria», «peluqueria-ca»…: la que usa NEGOCIO_POR_ESCENARIO. */
  clave: string;
  /** Id fijo del negocio en la BD de dev, [a-z0-9]{10,40}. */
  id: string;
  /** Nombre del negocio, siempre «Lab · …». */
  nombre: string;
  /** Lo que cubre, en una frase. */
  descripcion: string;
  /**
   * Si quien llama es un cliente conocido: las variables del prompt que
   * tienen que salir de sus citas sembradas (nombre y último servicio). Las
   * calcula el laboratorio con lib/contextoDeLlamada.ts, como al contestar
   * una llamada real; aquí quedan escritas para que la siembra las use al
   * crear las citas y un test compruebe que coinciden.
   */
  variablesDeLaLlamada?: Readonly<{
    nombre_cliente: string;
    ultimo_servicio: string;
  }>;
}

/** Todo negocio sembrado se llama «Lab · …»: es lo que comprueba la siembra
 * antes de pisar o borrar nada. */
export const PREFIJO_DEL_NOMBRE_DE_LABORATORIO = "Lab · ";

export const NEGOCIOS_DE_LABORATORIO: readonly NegocioDeLaboratorio[] = [
  {
    clave: "peluqueria",
    id: "labpeluqueria0000000001",
    nombre: "Lab · Peluquería",
    descripcion:
      "Peluquería base de Madrid: Corte y Tinte sin precio, Mechas, sin keratina; Laura, Montse y Núria (ninguna Lara); castellano con inglés; precios «si preguntan» y sin precios en la información; llamadas con permiso de grabación ya dado y chats de WhatsApp.",
  },
  {
    clave: "peluqueria-ca",
    id: "labpeluqueriaca00000002",
    nombre: "Lab · Peluquería catalana",
    descripcion:
      "Peluquería de Barcelona con el catalán (ca-ES) como idioma principal y en zona cooficial; catálogo con nombres en castellano («Corte»).",
  },
  {
    clave: "peluqueria-especialidad",
    id: "labpeluqueriaesp0000003",
    nombre: "Lab · Peluquería con especialidades",
    descripcion:
      "Peluquería donde Laura está marcada «no sugerir» en Corte y Montse es la especialista: pedir a Laura hace que la recepcionista recomiende a Montse una vez.",
  },
  {
    clave: "peluqueria-grabacion",
    id: "labpeluqueriagrab000004",
    nombre: "Lab · Peluquería (grabación)",
    descripcion:
      "Peluquería cuyas llamadas antiguas son de teléfonos que aún no han decidido si les graban: check_availability trae la pregunta de grabación.",
  },
  {
    clave: "peluqueria-cambios",
    id: "labpeluqueriacamb000005",
    nombre: "Lab · Peluquería (cambios y anulaciones)",
    descripcion:
      "Peluquería cuyas llamadas antiguas son de teléfonos con una cita futura (el jueves) en el negocio, una por llamada, para cambiarla o anularla. Todas las citas están a nombre de Lucía: el cliente es conocido (como en producción, el saludo le llama por su nombre) y todas las llamadas comparten las mismas variables del prompt.",
    variablesDeLaLlamada: { nombre_cliente: "Lucía", ultimo_servicio: "Corte" },
  },
  {
    clave: "peluqueria-telefono-oculto",
    id: "labpeluqueriaocul000006",
    nombre: "Lab · Peluquería (número oculto)",
    descripcion:
      "Peluquería cuyas llamadas antiguas llegaron con el número oculto: book_appointment tiene que pedir el teléfono.",
  },
  {
    clave: "precios-siempre",
    id: "labpreciossiempre000007",
    nombre: "Lab · Precios siempre",
    descripcion:
      "Peluquería con «Dar precios» en siempre y todos los servicios con precio.",
  },
  {
    clave: "precios-preguntan",
    id: "labpreciospreguntan0008",
    nombre: "Lab · Precios si preguntan",
    descripcion:
      "Peluquería con «Dar precios» si preguntan, Tinte y Corte sin precio y «tintes desde 30 €» en la información del negocio.",
  },
  {
    clave: "precios-nunca",
    id: "labpreciosnunca00000009",
    nombre: "Lab · Precios nunca",
    descripcion:
      "Peluquería con «Dar precios» en nunca y precios escritos en la información del negocio.",
  },
  {
    clave: "privacidad",
    id: "labprivacidad0000000010",
    nombre: "Lab · Privacidad",
    descripcion:
      "Peluquería con ocultarNumeroDelNegocio: la recepcionista nunca dice el teléfono del negocio, ni por voz ni por chat.",
  },
  {
    clave: "transferencia-si-lo-piden",
    id: "labtransfsilopiden00011",
    nombre: "Lab · Transferencia si lo piden",
    descripcion:
      "Peluquería con pasar llamadas «si lo piden» y móvil del dueño válido (el assistant de prueba lo cambia por un destino inerte).",
  },
  {
    clave: "transferencia-siempre",
    id: "labtransfsiempre0000012",
    nombre: "Lab · Transferencia siempre",
    descripcion:
      "Peluquería con pasar llamadas «siempre» y un horario que no abre ningún día: a cualquier hora está fuera de horario.",
  },
  {
    clave: "lista-de-espera",
    id: "lablistadeespera0000013",
    nombre: "Lab · Lista de espera",
    descripcion:
      "Peluquería con todos los profesionales ocupados el viernes a las 10 (los próximos dos viernes). La lista de espera depende de la plantilla hueco_libre, que es global.",
  },
  {
    clave: "cliente-conocido",
    id: "labclienteconocido00014",
    nombre: "Lab · Cliente conocido",
    descripcion:
      "Peluquería cuyas llamadas antiguas son de Marta, que ya reservó un Corte con Laura: nombre y último servicio guardados.",
    variablesDeLaLlamada: { nombre_cliente: "Marta", ultimo_servicio: "Corte" },
  },
  {
    clave: "fisioterapia",
    id: "labfisioterapia00000015",
    nombre: "Lab · Fisioterapia",
    descripcion: "Clínica de fisioterapia de Madrid.",
  },
];

/**
 * Qué negocio (por su `clave`) usa cada guion de la batería, por la clave del
 * guion («E5b», «E22a»…). Cada clave de guion de la batería está aquí o en
 * ESCENARIOS_NO_DISPONIBLES (un test lo comprueba).
 */
export const NEGOCIO_POR_ESCENARIO: Readonly<Record<string, string>> = {
  E1: "peluqueria",
  E2: "peluqueria",
  E3: "peluqueria",
  E4: "peluqueria-ca",
  E5a: "peluqueria",
  E5b: "precios-preguntan",
  E6: "precios-nunca",
  E7a: "peluqueria",
  E7b: "peluqueria",
  E8: "peluqueria-grabacion",
  E9a: "peluqueria",
  E9b: "peluqueria",
  E10: "peluqueria",
  E11: "peluqueria",
  E12a: "peluqueria",
  E12b: "peluqueria",
  E13: "peluqueria",
  E14: "peluqueria-cambios",
  E15: "peluqueria-cambios",
  E16a: "peluqueria",
  E16b: "peluqueria",
  E17: "peluqueria",
  E18a: "privacidad",
  E18b: "privacidad",
  E19a: "transferencia-si-lo-piden",
  E19b: "transferencia-siempre",
  E20: "peluqueria-especialidad",
  E21: "peluqueria-telefono-oculto",
  E22a: "lista-de-espera",
  E23a: "cliente-conocido",
  E23b: "cliente-conocido",
  E24a: "fisioterapia",
  E24b: "fisioterapia",
  E25: "peluqueria",
  E26: "peluqueria",
};

/**
 * Guiones que no se pueden preparar con un negocio de laboratorio sin tocar
 * algo compartido, y por qué. El laboratorio los salta.
 */
export const ESCENARIOS_NO_DISPONIBLES: Readonly<Record<string, string>> = {
  E22b: "La lista de espera la decide listaDeEsperaDisponible() (modules/whatsapp/service.ts), que mira si la plantilla de WhatsApp hueco_libre está APPROVED en la tabla global whatsapp_templates, no un ajuste del negocio; y check_availability dice «no prometas avisos» o «ofrécele el aviso» según esa fila. En dev no hay ninguna fila (la lista de espera está desactivada para todos los negocios), así que E22a vale tal cual y E22b exigiría insertar una plantilla aprobada falsa que cambiaría el comportamiento de todos los negocios de dev. Se podrá correr cuando alguien apruebe hueco_libre en dev a propósito.",
};

// ---------------------------------------------------------------------------
// Teléfonos de ficción
// ---------------------------------------------------------------------------

/** Cuántos teléfonos de cliente de ficción hay: +1 555 0100 … +1 555 0199. */
export const CANTIDAD_DE_TELEFONOS_DE_FICCION = 100;

/** El teléfono de ficción número `indice` (0–99): +15550100 … +15550199. Dan
 * la vuelta si el índice pasa de 99. */
export function telefonoDeFiccion(indice: number): string {
  const posicion =
    ((Math.trunc(indice) % CANTIDAD_DE_TELEFONOS_DE_FICCION) +
      CANTIDAD_DE_TELEFONOS_DE_FICCION) %
    CANTIDAD_DE_TELEFONOS_DE_FICCION;
  return `+1555${String(100 + posicion).padStart(4, "0")}`;
}

/** Los teléfonos de cliente sembrados (los `fromNumber` de las llamadas y
 * chats de laboratorio). */
export const TELEFONOS_DE_CLIENTE_DE_LABORATORIO: readonly string[] =
  Array.from({ length: CANTIDAD_DE_TELEFONOS_DE_FICCION }, (_, indice) =>
    telefonoDeFiccion(indice)
  );

/** ¿Es un teléfono de ficción de cliente (+1 555 0100–0199)? */
export function esTelefonoDeFiccion(telefono: string | null | undefined) {
  return (
    typeof telefono === "string" &&
    (TELEFONOS_DE_CLIENTE_DE_LABORATORIO as readonly string[]).includes(
      telefono
    )
  );
}

/**
 * Los teléfonos que dictan los clientes de los guiones (E18a, E21): dos de
 * los de ficción (con baja), para que una reserva o un recado con ellos no
 * pueda escribir a nadie. El laboratorio se niega a correr un guion que
 * dicte cualquier otro.
 */
export const TELEFONOS_DICTADOS_DE_LABORATORIO = [
  "+15550198",
  "+15550199",
] as const;

/**
 * El `Business.phone` de cada negocio (único, obligatorio): +1 212 555 0101…
 * Del bloque de ficción de Norteamérica (NXX-555-0100 a 0199) y con once
 * cifras, para que la comprobación «sinTelefono» del laboratorio lo detecte
 * si la recepcionista lo llegara a decir (solo mira números de 9 cifras o
 * más).
 */
export function telefonoDelNegocioDeLaboratorio(posicion: number): string {
  return `+1212555${String(100 + posicion + 1).padStart(4, "0")}`;
}

/** La base de datos de desarrollo (la del Docker de `~/.alhabla-dev`). */
export const BASE_DE_DATOS_DE_DEV = "botbook";

/**
 * Exige que una URL ya local (urlDeBdDeDev) sea la BD de dev y no otro
 * Postgres que escuche en localhost: el de Homebrew en el 5432, un Cloud SQL
 * Auth Proxy de producción en un puerto libre, la de los tests… Base
 * «botbook» y el puerto publicado por el Docker de dev
 * (`ALHABLA_DEV_DB_PORT`, 5433 por defecto). Lanza si no.
 */
export function exigirBaseDeDatosDeDev(
  urlLocal: string,
  puerto: string = process.env.ALHABLA_DEV_DB_PORT ?? "5433"
): void {
  const url = new URL(urlLocal);
  const base = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (base !== BASE_DE_DATOS_DE_DEV) {
    throw new Error(
      `[Laboratorio] La base de datos «${base}» no es la de desarrollo («${BASE_DE_DATOS_DE_DEV}»); no se toca`
    );
  }
  const puertoDeLaUrl = url.port || "5432";
  if (puertoDeLaUrl !== puerto) {
    throw new Error(
      `[Laboratorio] La BD de ${url.hostname}:${puertoDeLaUrl} no es la del Docker de desarrollo (puerto ${puerto}; cámbialo con ALHABLA_DEV_DB_PORT); no se toca`
    );
  }
}

/** Marca de las bajas (STOP) que pone la siembra en whatsapp_opt_outs
 * (`inboundMessageId`): `--borrar` solo quita las que la llevan. */
export const MARCA_DE_LAS_BAJAS_DE_LABORATORIO = "lab-siembra";

/**
 * Los dos negocios de transferencia necesitan un origen (el «número de
 * Alhabla» desde el que sale la pata) y un móvil de dueño con forma de línea
 * española válida, porque sin ellos la tool `transfer` no se registra
 * (lib/transferenciaAlDueno.ts). Ninguno de los dos recibe nada: el dueño no
 * tiene alta de WhatsApp y sus números están dados de baja (STOP) por la
 * siembra, y el assistant de prueba cambia el destino por uno inerte.
 */
export const TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO = {
  "transferencia-si-lo-piden": {
    origen: "+34900000001",
    movilDelDueno: "+34600000001",
  },
  "transferencia-siempre": {
    origen: "+34900000002",
    movilDelDueno: "+34600000002",
  },
} as const;

/** Búsqueda por clave; falla si no existe. */
export function negocioDeLaboratorio(clave: string): NegocioDeLaboratorio {
  const negocio = NEGOCIOS_DE_LABORATORIO.find((n) => n.clave === clave);
  if (!negocio) {
    throw new Error(`[Laboratorio] No hay negocio de laboratorio «${clave}»`);
  }
  return negocio;
}

/** Id del negocio de un guion, o null si el guion no está disponible. */
export function idDelNegocioDelGuion(claveDelGuion: string): string | null {
  const clave = NEGOCIO_POR_ESCENARIO[claveDelGuion];
  return clave ? negocioDeLaboratorio(clave).id : null;
}
