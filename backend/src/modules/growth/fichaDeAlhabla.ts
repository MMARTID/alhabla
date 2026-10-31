import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  terminosProhibidosEnTexto,
  type TerminoProhibido,
} from "./cumplimiento.js";
import {
  leerSnapshotDeConocimiento,
  terminosProhibidosDe,
  type SnapshotDeConocimiento,
} from "./contextoDeCumplimiento.js";

/**
 * La Ficha de Alhabla (`GET /growth/admin/ficha-de-alhabla`): el texto listo
 * para pegar en un directorio, compuesto en el servidor con plantillas fijas
 * y SOLO con afirmaciones vigentes de la base de conocimiento (con sus claves).
 * Sin ningún modelo de lenguaje: lo que el panel enseña sale de aquí o no
 * existe, y si falta una afirmación el campo sale vacío (`texto: null`) con las
 * claves que faltan, no con un texto inventado.
 *
 * Cada texto pasa por la misma comprobación de términos prohibidos que los
 * borradores (`sin_terminos_prohibidos`, con las `prohibida.*` vigentes). Si
 * salta, el campo se devuelve igualmente y se avisa: es el fundador quien
 * decide qué pega.
 */

// ── Forma de respuesta (contrato del panel útil) ─────────────────────────

export type CampoDeFicha = {
  clave: string;
  etiqueta: string;
  /** `null` si faltan afirmaciones vigentes. */
  texto: string | null;
  /** Caracteres orientativos de los directorios (descripción corta y larga). */
  limite?: number;
  /** Claves de afirmaciones de las que sale el texto. */
  afirmaciones: string[];
  /** Claves que se esperaban y no están vigentes. */
  faltan: string[];
};

export type RespuestaDeFicha = {
  campos: CampoDeFicha[];
  commit: string | null;
  sincronizadaEn: string | null;
  avisos: string[];
};

// ── Plantillas fijas ─────────────────────────────────────────────────────

export const NOMBRE_DEL_PRODUCTO = "Alhabla";
export const WEB_DEL_PRODUCTO = "https://alhabla.ai/";
/** Lo único que la ficha dice sin una afirmación: ni un dato ni una promesa. */
export const CATEGORIAS_DE_LA_FICHA =
  "Software de recepción telefónica con IA · Agenda y reservas de citas · Atención al cliente";
export const ARRANQUE_DE_LA_DESCRIPCION_LARGA =
  "Alhabla es una recepcionista de IA que atiende las llamadas de tu negocio.";

export const LIMITE_DE_LA_DESCRIPCION_CORTA = 160;
export const LIMITE_DE_LA_DESCRIPCION_LARGA = 1000;

/** `funcion.*` de la descripción larga, en este orden (las que existan). */
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

/** Las cinco de `precios`, en este orden: faltando una, el campo no sale. */
export const CLAVES_DE_PRECIOS = [
  "precio.desde",
  "precio.plan.inicio",
  "precio.plan.pro",
  "precio.plan.scale",
  "precio.iva",
] as const;

export const CLAVE_DE_LA_DESCRIPCION_CORTA = "pagina.inicio";
export const CLAVE_DE_LA_PRUEBA = "precio.prueba";
export const CLAVE_DE_LOS_IDIOMAS = "funcion.idiomas";

/** Todas las claves de las que puede salir la ficha. */
export const CLAVES_DE_LA_FICHA: readonly string[] = [
  CLAVE_DE_LA_DESCRIPCION_CORTA,
  ...CLAVES_DE_LA_DESCRIPCION_LARGA,
  ...CLAVES_DE_PRECIOS,
  CLAVE_DE_LA_PRUEBA,
  CLAVE_DE_LOS_IDIOMAS,
];

/** Lo que la composición necesita de una afirmación vigente. */
export type AfirmacionDeFicha = {
  clave: string;
  tipo: string;
  texto: string;
  valor: Prisma.JsonValue | null;
};

function sinPuntoFinal(texto: string): string {
  return texto.trim().replace(/[.\s]+$/, "");
}

/**
 * `Alhabla: Recepcionista de IA…` → `Recepcionista de IA…`: el texto de una
 * página es «nombre: resumen» y el nombre ya va en su propio campo.
 */
function descripcionDePagina(texto: string): string {
  const prefijo = `${NOMBRE_DEL_PRODUCTO}: `;
  const limpio = texto.trim();
  return limpio.startsWith(prefijo)
    ? limpio.slice(prefijo.length).trim()
    : limpio;
}

// ── Composición (pura) ───────────────────────────────────────────────────

type Entrada = {
  /** Afirmaciones vigentes: las de la ficha y las `prohibida`. */
  afirmaciones: readonly AfirmacionDeFicha[];
  snapshot: SnapshotDeConocimiento | null;
};

/**
 * Compone la ficha. Es pura: la misma entrada da siempre la misma salida, sin
 * tocar la base de datos, el reloj ni la red.
 */
export function componerFicha(entrada: Entrada): RespuestaDeFicha {
  const porClave = new Map(entrada.afirmaciones.map((a) => [a.clave, a]));
  const texto = (clave: string): string | null =>
    porClave.get(clave)?.texto.trim() || null;

  /** Campo que necesita TODAS sus claves: si falta una, no hay texto. */
  const completo = (
    clave: string,
    etiqueta: string,
    claves: readonly string[],
    componer: (textos: string[]) => string,
    limite?: number
  ): CampoDeFicha => {
    const faltan = claves.filter((c) => !texto(c));
    return {
      clave,
      etiqueta,
      texto:
        faltan.length === 0
          ? componer(claves.map((c) => texto(c) as string))
          : null,
      ...(limite ? { limite } : {}),
      afirmaciones: claves.filter((c) => texto(c)),
      faltan,
    };
  };

  const idiomas = completo(
    "idiomas",
    "Idiomas",
    [CLAVE_DE_LOS_IDIOMAS],
    ([t]) => t
  );

  // Descripción larga: el arranque fijo y las funciones que existan; `faltan`
  // dice cuáles no, y solo sin ninguna el campo queda vacío.
  const disponibles = CLAVES_DE_LA_DESCRIPCION_LARGA.filter((c) => texto(c));
  const descripcionLarga: CampoDeFicha = {
    clave: "descripcion_larga",
    etiqueta: "Descripción larga",
    texto:
      disponibles.length === 0
        ? null
        : `${[
            ARRANQUE_DE_LA_DESCRIPCION_LARGA,
            ...disponibles.map((c) => texto(c) as string),
          ]
            .map(sinPuntoFinal)
            .join(". ")}.`,
    limite: LIMITE_DE_LA_DESCRIPCION_LARGA,
    afirmaciones: [...disponibles],
    faltan: CLAVES_DE_LA_DESCRIPCION_LARGA.filter((c) => !texto(c)),
  };

  const paginaDeInicio = porClave.get(CLAVE_DE_LA_DESCRIPCION_CORTA);
  const descripcionCorta: CampoDeFicha = {
    clave: "descripcion_corta",
    etiqueta: "Descripción corta",
    texto: paginaDeInicio?.texto.trim()
      ? descripcionDePagina(paginaDeInicio.texto)
      : null,
    limite: LIMITE_DE_LA_DESCRIPCION_CORTA,
    afirmaciones: paginaDeInicio?.texto.trim()
      ? [CLAVE_DE_LA_DESCRIPCION_CORTA]
      : [],
    faltan: paginaDeInicio?.texto.trim() ? [] : [CLAVE_DE_LA_DESCRIPCION_CORTA],
  };

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
    descripcionCorta,
    descripcionLarga,
    // Una línea por plan: se pega mejor así en un formulario.
    completo("precios", "Precios", CLAVES_DE_PRECIOS, (textos) =>
      textos.join("\n")
    ),
    completo(
      "prueba",
      "Prueba y permanencia",
      [CLAVE_DE_LA_PRUEBA],
      ([t]) => t
    ),
    idiomas,
    {
      clave: "categorias",
      etiqueta: "Categorías",
      texto: CATEGORIAS_DE_LA_FICHA,
      afirmaciones: [],
      faltan: [],
    },
  ];

  // Lo que no se puede decir, con las mismas reglas que un borrador.
  const prohibidas: TerminoProhibido[] = entrada.afirmaciones
    .filter((a) => a.tipo === "prohibida")
    .flatMap((a) => terminosProhibidosDe({ texto: a.texto, valor: a.valor }));

  const avisos: string[] = [];
  const resultado: CampoDeFicha[] = campos.map((campo) => {
    const encontrados =
      campo.texto === null
        ? []
        : terminosProhibidosEnTexto(campo.texto, prohibidas);
    if (encontrados.length > 0) {
      avisos.push(
        `El campo «${campo.etiqueta}» contiene términos que no se pueden decir: ${[...new Set(encontrados)].join(", ")}.`
      );
    }
    return campo;
  });

  if (prohibidas.length === 0) {
    avisos.push(
      "No hay términos prohibidos vigentes en la base de conocimiento: no se ha podido comprobar el texto."
    );
  }
  if (!entrada.snapshot) {
    avisos.push(
      "La base de conocimiento aún no se ha sincronizado: la ficha puede estar incompleta."
    );
  } else if (entrada.snapshot.obsoleto) {
    avisos.push(
      `La base de conocimiento no se sincroniza desde hace ${Math.floor(entrada.snapshot.antiguedadHoras / 24)} días: comprueba los precios y las funciones antes de pegarlos.`
    );
  }

  return {
    campos: resultado,
    commit: entrada.snapshot?.commitSha ?? null,
    sincronizadaEn: entrada.snapshot?.sincronizadoEn ?? null,
    avisos,
  };
}

// ── Lectura ──────────────────────────────────────────────────────────────

/** `GET /growth/admin/ficha-de-alhabla`: dos lecturas, nada más. */
export async function fichaDeAlhabla(): Promise<RespuestaDeFicha> {
  const [filas, snapshot] = await Promise.all([
    prisma.growthAfirmacion.findMany({
      where: {
        vigenteHasta: null,
        OR: [{ clave: { in: [...CLAVES_DE_LA_FICHA] } }, { tipo: "prohibida" }],
      },
      // La más nueva primero: si hubiera dos vigentes con la misma clave, gana
      // la más reciente.
      orderBy: { vigenteDesde: "desc" },
      select: { clave: true, tipo: true, texto: true, valor: true },
    }),
    leerSnapshotDeConocimiento(prisma),
  ]);

  const vistas = new Set<string>();
  const afirmaciones = filas.filter((f) => {
    if (f.tipo === "prohibida") return true;
    if (vistas.has(f.clave)) return false;
    vistas.add(f.clave);
    return true;
  });
  return componerFicha({ afirmaciones, snapshot });
}
