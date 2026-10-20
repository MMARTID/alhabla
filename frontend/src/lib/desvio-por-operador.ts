/**
 * Códigos y avisos del desvío de llamadas por compañía, tal y como los
 * publica la ayuda oficial de cada una (revisada el 2026-10-20). La base son
 * los códigos MMI del estándar GSM (3GPP TS 22.030), como `**61*número#`,
 * pero no todas las compañías los publican igual y en el fijo cambian mucho:
 * Vodafone va sin `#` final, Orange tiene dos juegos según la cobertura y
 * Jazztel no pone asterisco entre el código y el número.
 *
 * La web pública tiene una guía por compañía con las fuentes
 * (`web/src/app/desvio-de-llamadas/`); esto es lo que cabe en el panel.
 */

export type TipoDeDesvio = "no-contesta" | "comunicando" | "apagado" | "todas";

export type LineaDeDesvio = "movil" | "fijo";

export type CodigoDeDesvio = {
  id: string;
  tipo: TipoDeDesvio;
  titulo: string;
  descripcion: string;
  activar: (numero: string) => string;
  desactivar: string;
  recomendado: boolean;
};

export type OperadorId =
  | "movistar"
  | "vodafone"
  | "orange"
  | "yoigo"
  | "masmovil"
  | "o2"
  | "jazztel"
  | "digi"
  | "pepephone"
  | "lowi"
  | "simyo"
  | "euskaltel"
  | "r"
  | "telecable"
  | "finetwork"
  | "avatel";

export const OPERADORES: ReadonlyArray<{ id: OperadorId; nombre: string }> = [
  { id: "movistar", nombre: "Movistar" },
  { id: "vodafone", nombre: "Vodafone" },
  { id: "orange", nombre: "Orange o Amena" },
  { id: "yoigo", nombre: "Yoigo" },
  { id: "masmovil", nombre: "MásMóvil" },
  { id: "o2", nombre: "O2" },
  { id: "jazztel", nombre: "Jazztel" },
  { id: "digi", nombre: "Digi" },
  { id: "pepephone", nombre: "Pepephone" },
  { id: "lowi", nombre: "Lowi" },
  { id: "simyo", nombre: "Simyo" },
  { id: "euskaltel", nombre: "Euskaltel" },
  { id: "r", nombre: "R (Galicia)" },
  { id: "telecable", nombre: "Telecable" },
  { id: "finetwork", nombre: "Finetwork" },
  { id: "avatel", nombre: "Avatel" },
];

export function esOperador(valor: string): valor is OperadorId {
  return OPERADORES.some((operador) => operador.id === valor);
}

/**
 * Guía pública del desvío en alhabla.ai (se monta con `webUrl`). Cuando las
 * páginas de cada compañía (`/desvio-de-llamadas/<compañía>`) estén
 * publicadas, se puede enlazar a la de cada una.
 */
export const RUTA_GUIA_DE_DESVIO = "/desvio-de-llamadas";

/** Un juego de códigos; el primero es el recomendado. */
export type GrupoDeCodigos = {
  /** Solo cuando la compañía tiene más de un juego (el fijo de Orange). */
  titulo?: string;
  codigos: CodigoDeDesvio[];
};

export type GuiaDeDesvio = {
  /** Cómo se marcan (o dónde se ponen, si la compañía no usa códigos). */
  comoMarcar: string;
  /** Vacío si la compañía no publica códigos para esa línea. */
  grupos: GrupoDeCodigos[];
  /** Lo propio de la compañía: coste, alta, destinos, tipos que faltan. */
  avisos: string[];
};

type Formato = {
  activar: (servicio: string, numero: string) => string;
  desactivar: (servicio: string) => string;
  /** Si la compañía no usa los del estándar (61, 67, 62, 21). */
  servicios?: Partial<Record<TipoDeDesvio, string>>;
};

const SERVICIO_GSM: Record<TipoDeDesvio, string> = {
  "no-contesta": "61",
  comunicando: "67",
  apagado: "62",
  todas: "21",
};

/** El del estándar en un móvil: `**61*número#`, se quita con `##61#`. */
const GSM_MOVIL: Formato = {
  activar: (servicio, numero) => `**${servicio}*${numero}#`,
  desactivar: (servicio) => `##${servicio}#`,
};

/**
 * Con un solo asterisco: el de casi todos los fijos y el que publican para
 * el móvil Yoigo, MásMóvil y Avatel.
 */
const ASTERISCO_SIMPLE: Formato = {
  activar: (servicio, numero) => `*${servicio}*${numero}#`,
  desactivar: (servicio) => `#${servicio}#`,
};

/** Fijo de Vodafone: sin `#` final, y se quita con `##61#`. */
const VODAFONE_FIJO: Formato = {
  activar: (servicio, numero) => `*${servicio}*${numero}`,
  desactivar: (servicio) => `##${servicio}#`,
};

/** Fijo de Orange con cobertura directa: `*23número`, se quita con `*231*`. */
const ORANGE_FIJO_DIRECTA: Formato = {
  activar: (servicio, numero) => `*${servicio}${numero}`,
  desactivar: (servicio) => `*${servicio}1*`,
  servicios: { "no-contesta": "23", comunicando: "22", todas: "21" },
};

/** Fijo de Jazztel: sin asterisco ante el número, y se quita sin `#` final. */
const JAZZTEL_FIJO: Formato = {
  activar: (servicio, numero) => `*${servicio}${numero}#`,
  desactivar: (servicio) => `#${servicio}`,
};

const TEXTOS: Record<
  LineaDeDesvio,
  Record<TipoDeDesvio, { titulo: string; descripcion: string }>
> = {
  movil: {
    "no-contesta": {
      titulo: "Cuando no contestas",
      descripcion:
        "Suena en tu teléfono; si no lo coges, atiende tu recepcionista. Es el recomendado.",
    },
    comunicando: {
      titulo: "Cuando estás comunicando",
      descripcion:
        "Para no perder al cliente que llama mientras hablas con otro.",
    },
    apagado: {
      titulo: "Cuando estás sin cobertura o apagado",
      descripcion:
        "Cubre las horas en las que tienes el teléfono apagado o sin línea.",
    },
    todas: {
      titulo: "Todas las llamadas",
      descripcion:
        "Tu teléfono no suena: todas van directas a la recepcionista.",
    },
  },
  fijo: {
    "no-contesta": {
      titulo: "Cuando no contestas",
      descripcion:
        "Suena en el local; si nadie lo coge, atiende tu recepcionista. Es el recomendado.",
    },
    comunicando: {
      titulo: "Cuando estás comunicando",
      descripcion:
        "Para no perder al cliente que llama mientras el fijo está ocupado.",
    },
    apagado: {
      titulo: "Cuando la línea no está disponible",
      descripcion: "Cubre los cortes de la línea del local.",
    },
    todas: {
      titulo: "Todas las llamadas",
      descripcion: "El fijo no suena: todas van directas a la recepcionista.",
    },
  },
};

/**
 * Un teléfono de sobremesa no suele tener tecla «+», y las compañías dan sus
 * ejemplos del fijo con las 9 cifras: un número español va sin el +34. En el
 * móvil se deja el internacional, que el estándar prefiere para los desvíos.
 */
function numeroParaMarcar(linea: LineaDeDesvio, numero: string): string {
  return linea === "fijo" && /^\+34\d{9}$/.test(numero)
    ? numero.slice(3)
    : numero;
}

function codigo(
  linea: LineaDeDesvio,
  tipo: TipoDeDesvio,
  formato: Formato,
  prefijo = ""
): CodigoDeDesvio {
  const servicio = formato.servicios?.[tipo] ?? SERVICIO_GSM[tipo];
  return {
    id: `${prefijo}${linea === "fijo" ? "fijo-" : ""}${tipo}`,
    tipo,
    ...TEXTOS[linea][tipo],
    activar: (numero: string) =>
      formato.activar(servicio, numeroParaMarcar(linea, numero)),
    desactivar: formato.desactivar(servicio),
    recomendado: tipo === "no-contesta",
  };
}

function codigos(
  linea: LineaDeDesvio,
  tipos: TipoDeDesvio[],
  formato: Formato,
  prefijo = ""
): CodigoDeDesvio[] {
  return tipos.map((tipo) => codigo(linea, tipo, formato, prefijo));
}

const TIPOS_MOVIL: TipoDeDesvio[] = [
  "no-contesta",
  "comunicando",
  "apagado",
  "todas",
];
/** En un local solo tienen sentido estos tres. */
const TIPOS_FIJO: TipoDeDesvio[] = ["no-contesta", "comunicando", "todas"];

/**
 * Los del estándar en un móvil. El primero es el que corresponde a la
 * promesa del producto — «solo las llamadas que no contestas» — así que va
 * primero y es el recomendado.
 */
export const CODIGOS_MOVIL: CodigoDeDesvio[] = codigos(
  "movil",
  TIPOS_MOVIL,
  GSM_MOVIL
);

/**
 * Los más habituales en un fijo (un asterisco, `#` final): Movistar, Yoigo,
 * MásMóvil, O2, Digi, Euskaltel, R, Telecable y Orange con cobertura
 * indirecta. Se marcan desde el propio aparato tras el tono.
 */
export const CODIGOS_FIJO: CodigoDeDesvio[] = codigos(
  "fijo",
  TIPOS_FIJO,
  ASTERISCO_SIMPLE
);

/**
 * Anula de una vez todos los desvíos de un móvil (3GPP TS 22.030), también
 * los que mandan las llamadas al buzón de voz. Para quitar solo el desvío a
 * la recepcionista basta con `##61#` (y `##67#`, `##62#` o `##21#` si se
 * pusieron).
 */
export const CODIGO_ANULAR_DESVIOS_MOVIL = "##002#";

const MARCAR_MOVIL =
  "Marca el código en tu teléfono como si fuera una llamada normal.";
const MARCAR_FIJO =
  "Descuelga el teléfono del local y marca el código tras el tono, como si fuera una llamada.";

export const AVISO_BUZON_MOVIL =
  "Este desvío sustituye al buzón de voz: las llamadas que no cojas irán a tu recepcionista en vez de al contestador.";

/**
 * Apple: el desvío de Ajustes es el de todas las llamadas, y con «Silenciar»
 * los números desconocidos van al Buzón de voz en vivo sin sonar. Cómo
 * convive eso con el desvío de la red no está documentado: se recomienda lo
 * prudente.
 */
export const AVISO_IPHONE =
  "En iPhone, el desvío de Ajustes › Apps › Teléfono es el de todas las llamadas, no el de «cuando no contestas». En ese mismo menú, deja «Filtra las llamadas de números desconocidos» en «Nunca» y desactiva el Buzón de voz en vivo, o un cliente nuevo puede acabar en el buzón sin que el teléfono suene.";

const AVISO_CONTESTADOR_FIJO =
  "Si tu fijo tiene contestador, desactívalo o se quedará él las llamadas.";

function guiaMovilDelOperador(operador: OperadorId | null): GuiaDeDesvio {
  const estandar = [{ codigos: CODIGOS_MOVIL }];
  const conCodigos = (avisos: string[] = []): GuiaDeDesvio => ({
    comoMarcar: MARCAR_MOVIL,
    grupos: estandar,
    avisos,
  });

  switch (operador) {
    case null:
      return {
        comoMarcar: `${MARCAR_MOVIL} Son los del estándar de los móviles; elige tu compañía para ver lo que publica la tuya.`,
        grupos: estandar,
        avisos: [],
      };
    case "movistar":
      return conCodigos([
        "Con MultiSIM, Movistar solo deja desviar todas las llamadas: el desvío «cuando no contestas» no funcionará.",
      ]);
    case "vodafone":
      return conCodigos([
        "Vodafone cobra cada llamada desviada como una llamada tuya: 0,182\u00a0€ de establecimiento más el minuto. Su ayuda no aclara si las tarifas con llamadas ilimitadas lo cubren.",
      ]);
    case "yoigo":
    case "masmovil": {
      const nombre = operador === "yoigo" ? "Yoigo" : "MásMóvil";
      return {
        comoMarcar: MARCAR_MOVIL,
        grupos: [
          {
            codigos: [
              ...codigos(
                "movil",
                ["no-contesta", "comunicando", "apagado"],
                GSM_MOVIL
              ),
              codigo("movil", "todas", ASTERISCO_SIMPLE),
            ],
          },
        ],
        avisos: [
          `${nombre} solo publica el código de todas las llamadas (*21*). Los demás son los del estándar de los móviles y deberían funcionar, pero su ayuda no los da: después de marcarlo, compruébalo con «Comprobar desvío».`,
        ],
      };
    }
    case "o2":
      return conCodigos([
        "O2 avisa de que con VoLTE los códigos pueden no funcionar y de que con MultiSIM solo se puede desviar todo: después de marcarlo, compruébalo con «Comprobar desvío».",
      ]);
    case "digi":
      return conCodigos([
        "Digi avisa de que el desvío no funciona en itinerancia ni a la vez que el aviso de llamadas, que viene activado: quítalo en Mi DIGI › Servicios › Servicios de línea.",
      ]);
    case "pepephone":
      return {
        comoMarcar:
          "Pepephone no da códigos para desviar a otro número: el desvío se pone en Mi Pepephone. Elige tu línea, entra en «Ajustes de la línea» y, en el desvío si no atiendes una llamada, elige desviarla a otro número y pon tu número de Alhabla.",
        grupos: [],
        avisos: [],
      };
    case "simyo":
      return {
        comoMarcar: MARCAR_MOVIL,
        grupos: [
          {
            codigos: codigos(
              "movil",
              ["no-contesta", "apagado", "todas"],
              GSM_MOVIL
            ),
          },
        ],
        avisos: [
          "Simyo no publica el desvío «cuando estás comunicando», así que no lo incluimos.",
        ],
      };
    case "finetwork":
      return {
        comoMarcar:
          "Finetwork no publica códigos: el desvío se pone en su app o en el área de cliente de su web, en «Ajustes de llamadas». Elige el desvío cuando no contestas y pon tu número de Alhabla.",
        grupos: [],
        avisos: [],
      };
    case "avatel":
      return {
        comoMarcar: MARCAR_MOVIL,
        grupos: [{ codigos: codigos("movil", TIPOS_MOVIL, ASTERISCO_SIMPLE) }],
        avisos: [],
      };
    case "orange":
    case "jazztel":
    case "lowi":
    case "euskaltel":
    case "r":
    case "telecable":
      return conCodigos();
  }
}

/** Lo de la compañía y, detrás, lo que vale para cualquier móvil. */
function guiaMovil(operador: OperadorId | null): GuiaDeDesvio {
  const guia = guiaMovilDelOperador(operador);
  return { ...guia, avisos: [...guia.avisos, AVISO_BUZON_MOVIL, AVISO_IPHONE] };
}

/** Compañías que no publican cómo desviar el fijo. */
const FIJO_SIN_PUBLICAR: Partial<Record<OperadorId, string>> = {
  pepephone: "Pepephone",
  lowi: "Lowi",
  avatel: "Avatel",
  finetwork: "Finetwork",
};

function guiaFijo(operador: OperadorId | null): GuiaDeDesvio {
  const estandar = [{ codigos: CODIGOS_FIJO }];

  switch (operador) {
    case null:
      return {
        comoMarcar: `${MARCAR_FIJO} Es el formato más habitual en los fijos, pero en Vodafone, Orange y Jazztel cambia: elige tu compañía.`,
        grupos: estandar,
        avisos: [
          `${AVISO_CONTESTADOR_FIJO} En Movistar se quita marcando #10#.`,
        ],
      };
    case "movistar":
      return {
        comoMarcar: MARCAR_FIJO,
        grupos: estandar,
        avisos: [
          "En el fijo de Movistar el desvío hay que contratarlo antes de marcar el código, en el 1004 o en una tienda: cuesta 4\u00a0€/mes cada tipo. El Pack de servicios básicos (4\u00a0€/mes) solo trae el de todas las llamadas.",
          "Si tienes el contestador de Movistar, quítalo o se quedará él las llamadas: #10# quita el de cuando no contestas y #9998 el de cuando comunicas.",
        ],
      };
    case "vodafone":
      return {
        comoMarcar:
          "Descuelga el teléfono del local, marca el código y pulsa la tecla de llamada. En el fijo de Vodafone van sin # al final.",
        grupos: [{ codigos: codigos("fijo", TIPOS_FIJO, VODAFONE_FIJO) }],
        avisos: [
          "Vodafone dice que el fijo solo desvía a fijos y móviles de Vodafone y a móviles de otras compañías. Tu número de Alhabla es un fijo de otra compañía, así que puede no funcionar: compruébalo con «Comprobar desvío». Si falla, desvía desde un móvil o usa Alhabla como número principal (en Ajustes › Teléfono).",
          "Cada llamada desviada desde el fijo de Vodafone cuesta 0,182\u00a0€ de establecimiento más 0,242\u00a0€/min, IVA incluido.",
          "Si tienes el contestador de Vodafone, quítalo marcando *110* o se quedará él las llamadas.",
        ],
      };
    case "orange":
      return {
        comoMarcar: `${MARCAR_FIJO} Orange tiene dos juegos de códigos según la cobertura de tu línea: si el teléfono va enchufado a un microfiltro en la roseta de la pared, es indirecta; si no, directa.`,
        grupos: [
          {
            titulo: "Cobertura directa de Orange",
            codigos: codigos(
              "fijo",
              TIPOS_FIJO,
              ORANGE_FIJO_DIRECTA,
              "directa-"
            ),
          },
          {
            titulo: "Cobertura indirecta (con microfiltro en la roseta)",
            codigos: codigos(
              "fijo",
              TIPOS_FIJO,
              ASTERISCO_SIMPLE,
              "indirecta-"
            ),
          },
        ],
        avisos: [
          `${AVISO_CONTESTADOR_FIJO} Si no sabes qué cobertura tienes, prueba un juego y compruébalo con «Comprobar desvío».`,
        ],
      };
    case "jazztel":
      return {
        comoMarcar: `${MARCAR_FIJO} En el fijo de Jazztel el número va pegado al código, sin asterisco en medio.`,
        grupos: [{ codigos: codigos("fijo", TIPOS_FIJO, JAZZTEL_FIJO) }],
        avisos: [
          "Jazztel dice que los códigos cambian si tu línea está en su cobertura directa, pero solo publica estos: después de marcarlo, compruébalo con «Comprobar desvío».",
          "Si tienes el contestador de Jazztel, quítalo o se quedará él las llamadas: #10 quita el de ausencia y #11 el de ocupado.",
        ],
      };
    case "digi":
      return {
        comoMarcar: MARCAR_FIJO,
        grupos: [
          {
            codigos: codigos(
              "fijo",
              ["no-contesta", "todas"],
              ASTERISCO_SIMPLE
            ),
          },
        ],
        avisos: [
          "El fijo de Digi no tiene desvío «cuando estás comunicando»: solo «cuando no contestas» y el de todas las llamadas.",
          AVISO_CONTESTADOR_FIJO,
        ],
      };
    case "simyo":
      return {
        comoMarcar:
          "Simyo no tiene telefonía fija: su fibra va sin línea de voz. Si tus clientes te llaman a una línea de Simyo, es un móvil: cámbialo en Ajustes › Teléfono.",
        grupos: [],
        avisos: [],
      };
    case "pepephone":
    case "lowi":
    case "avatel":
    case "finetwork":
      return {
        comoMarcar: `${MARCAR_FIJO} ${FIJO_SIN_PUBLICAR[operador]} no publica cómo desviar el fijo: estos son los códigos más habituales, así que después de marcarlo compruébalo con «Comprobar desvío».`,
        grupos: estandar,
        avisos: [
          ...(operador === "finetwork"
            ? [
                "Finetwork solo explica cómo desviar «TU FIJO» a un móvil de tu contrato. Si a tu número de Alhabla no funciona, desvía desde un móvil o usa Alhabla como número principal (en Ajustes › Teléfono).",
              ]
            : []),
          AVISO_CONTESTADOR_FIJO,
        ],
      };
    case "yoigo":
    case "masmovil":
    case "o2":
    case "euskaltel":
    case "r":
    case "telecable":
      return {
        comoMarcar: MARCAR_FIJO,
        grupos: estandar,
        avisos: [AVISO_CONTESTADOR_FIJO],
      };
  }
}

/** Códigos y avisos de una compañía (null = otra o no lo sabe). */
export function guiaDeDesvio(
  linea: LineaDeDesvio,
  operador: OperadorId | null
): GuiaDeDesvio {
  return linea === "movil" ? guiaMovil(operador) : guiaFijo(operador);
}
