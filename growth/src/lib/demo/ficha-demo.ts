import type { CampoDeFicha, RespuestaDeFicha } from "../types";
import { mencionaPalabra, terminosProhibidosDe } from "./reglas-demo";

/**
 * La «Ficha de Alhabla» de la demostración: la misma composición que
 * `backend/src/modules/growth/fichaDeAlhabla.ts`, determinista y sin modelo.
 * Cada campo sale SOLO de afirmaciones vigentes de la base de conocimiento,
 * con plantillas fijas; si falta alguna, el campo no se inventa: `texto: null`
 * (la descripción larga se compone con las funciones que existan) y la lista
 * `faltan`. `tests/lib/paridad-de-ficha.test.ts` lee el backend y falla si las
 * claves, los textos fijos, las etiquetas o los límites se separan.
 */

export const NOMBRE_DEL_PRODUCTO = "Alhabla";
export const WEB_DEL_PRODUCTO = "https://alhabla.ai/";
export const ARRANQUE_DE_LA_DESCRIPCION_LARGA =
  "Alhabla es una recepcionista de IA que atiende las llamadas de tu negocio.";
export const CATEGORIAS_DE_LA_FICHA =
  "Software de recepción telefónica con IA · Agenda y reservas de citas · Atención al cliente";

export const LIMITE_DE_DESCRIPCION_CORTA = 160;
export const LIMITE_DE_DESCRIPCION_LARGA = 1000;

/** Las funciones que componen la descripción larga, en este orden. */
export const CLAVES_DE_LA_DESCRIPCION_LARGA = [
  "funcion.atiende_a_cualquier_hora",
  "funcion.calendarios",
  "funcion.confirmacion_por_whatsapp",
  "funcion.idiomas",
  "funcion.numero_de_espana",
  "funcion.registro_de_llamadas",
  "funcion.horario_servicios_y_equipo",
  "funcion.asistente_por_whatsapp",
] as const;

export const CLAVES_DE_PRECIOS = [
  "precio.desde",
  "precio.plan.inicio",
  "precio.plan.pro",
  "precio.plan.scale",
  "precio.iva",
] as const;

type Afirmacion = { clave: string; texto: string; valor: unknown };

/** Del snapshot de conocimiento, lo que usa la ficha. */
type Sincronizacion = {
  commitSha: string;
  sincronizadoEn: string;
  antiguedadHoras: number;
  obsoleto: boolean;
};

function sinPuntoFinal(texto: string): string {
  return texto.trim().replace(/[.\s]+$/u, "");
}

/** `Alhabla: Recepcionista…` → `Recepcionista…`: el nombre ya va en su campo. */
function descripcionDePagina(texto: string): string {
  const prefijo = `${NOMBRE_DEL_PRODUCTO}: `;
  const limpio = texto.trim();
  return limpio.startsWith(prefijo)
    ? limpio.slice(prefijo.length).trim()
    : limpio;
}

export function componerFichaDeAlhabla(
  vigentes: readonly Afirmacion[],
  snapshot: Sincronizacion | null
): RespuestaDeFicha {
  const porClave = new Map(vigentes.map((a) => [a.clave, a]));
  /** El texto de una afirmación vigente; en blanco cuenta como si faltara. */
  const texto = (clave: string): string | null =>
    porClave.get(clave)?.texto.trim() || null;
  const faltan = (claves: readonly string[]) =>
    claves.filter((c) => texto(c) === null);
  const textos = (claves: readonly string[]) =>
    claves.flatMap((c) => texto(c) ?? []);

  const campos: CampoDeFicha[] = [
    {
      clave: "nombre",
      etiqueta: "Nombre del producto",
      texto: NOMBRE_DEL_PRODUCTO,
      afirmaciones: [],
      faltan: [],
    },
    {
      clave: "web",
      etiqueta: "Sitio web",
      texto: WEB_DEL_PRODUCTO,
      afirmaciones: [],
      faltan: [],
    },
  ];

  const inicio = texto("pagina.inicio");
  campos.push({
    clave: "descripcion_corta",
    etiqueta: "Descripción corta",
    texto: inicio ? descripcionDePagina(inicio) : null,
    limite: LIMITE_DE_DESCRIPCION_CORTA,
    afirmaciones: inicio ? ["pagina.inicio"] : [],
    faltan: inicio ? [] : ["pagina.inicio"],
  });

  const usadasEnLaLarga = CLAVES_DE_LA_DESCRIPCION_LARGA.filter((c) =>
    texto(c)
  );
  campos.push({
    clave: "descripcion_larga",
    etiqueta: "Descripción larga",
    texto:
      usadasEnLaLarga.length === 0
        ? null
        : `${[ARRANQUE_DE_LA_DESCRIPCION_LARGA, ...textos(usadasEnLaLarga)]
            .map(sinPuntoFinal)
            .join(". ")}.`,
    limite: LIMITE_DE_DESCRIPCION_LARGA,
    afirmaciones: usadasEnLaLarga,
    faltan: faltan(CLAVES_DE_LA_DESCRIPCION_LARGA),
  });

  const faltanPrecios = faltan(CLAVES_DE_PRECIOS);
  campos.push({
    clave: "precios",
    etiqueta: "Precios",
    texto:
      faltanPrecios.length === 0
        ? // Una línea por plan: se pega mejor así en un formulario.
          textos(CLAVES_DE_PRECIOS).join("\n")
        : null,
    afirmaciones: CLAVES_DE_PRECIOS.filter((c) => texto(c)),
    faltan: faltanPrecios,
  });

  const prueba = texto("precio.prueba");
  campos.push({
    clave: "prueba",
    etiqueta: "Prueba y permanencia",
    texto: prueba,
    afirmaciones: prueba ? ["precio.prueba"] : [],
    faltan: prueba ? [] : ["precio.prueba"],
  });

  const idiomas = texto("funcion.idiomas");
  campos.push({
    clave: "idiomas",
    etiqueta: "Idiomas",
    texto: idiomas,
    afirmaciones: idiomas ? ["funcion.idiomas"] : [],
    faltan: idiomas ? [] : ["funcion.idiomas"],
  });

  campos.push({
    clave: "categorias",
    etiqueta: "Categorías",
    texto: CATEGORIAS_DE_LA_FICHA,
    afirmaciones: [],
    faltan: [],
  });

  // La misma comprobación que usan los borradores (`sin_terminos_prohibidos`),
  // con las afirmaciones `prohibida.*` vigentes.
  const prohibidos = vigentes
    .filter((a) => a.clave.startsWith("prohibida."))
    .flatMap(terminosProhibidosDe);
  const avisos: string[] = [];
  for (const campo of campos) {
    if (campo.texto === null) continue;
    const texto = campo.texto;
    const encontrados = [
      ...new Set(
        prohibidos
          .filter((t) => mencionaPalabra(texto, t.termino, t))
          .map((t) => t.termino)
      ),
    ];
    if (encontrados.length > 0) {
      avisos.push(
        `El campo «${campo.etiqueta}» contiene términos que no se pueden decir: ${encontrados.join(", ")}.`
      );
    }
  }
  if (prohibidos.length === 0) {
    avisos.push(
      "No hay términos prohibidos vigentes en la base de conocimiento: no se ha podido comprobar el texto."
    );
  }
  if (!snapshot) {
    avisos.push(
      "La base de conocimiento aún no se ha sincronizado: la ficha puede estar incompleta."
    );
  } else if (snapshot.obsoleto) {
    avisos.push(
      `La base de conocimiento no se sincroniza desde hace ${Math.floor(snapshot.antiguedadHoras / 24)} días: comprueba los precios y las funciones antes de pegarlos.`
    );
  }

  return {
    campos,
    commit: snapshot?.commitSha ?? null,
    sincronizadaEn: snapshot?.sincronizadoEn ?? null,
    avisos,
  };
}
