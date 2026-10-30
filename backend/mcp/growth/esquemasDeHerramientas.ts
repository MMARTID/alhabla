import { z, ZodFirstPartyTypeKind as Tipo } from "zod";
import {
  AnalisisDeCompetidorBodyBase,
  BorradorBody,
  CalificacionBody,
  CodigoDescarte,
  DISPARADORES_DE_EJECUCION,
  DatosDeOportunidad,
  ESTADOS_DE_CIERRE_DE_EJECUCION,
  ESTADOS_DE_COMPETIDOR,
  ESTADOS_DE_OPORTUNIDAD,
  EvaluarBorradorBody,
  InvestigacionBaseBody,
  MAXIMO_DE_COMPETIDORES_MENCIONADOS,
  MAXIMO_DE_DATOS_POR_ANALISIS,
  OBJETIVOS,
  OportunidadBaseBody,
  PropuestaDeCompetidorBody,
  ResumenDeEjecucion,
  RevisionLlmBody,
  TIPOS_DE_AFIRMACION,
  TIPOS_DE_FUENTE,
} from "../../src/modules/growth/esquemas.js";

/**
 * Lo que el modelo puede pasar a cada herramienta. Se construye desde los
 * esquemas del backend (`esquemas.ts`) para que el MCP y la API no se
 * desfasen; solo cambia lo que el MCP decide por su cuenta (el `ejecucionId`)
 * y las fechas, que aquí son texto ISO (el JSON Schema de `z.coerce.date()` no
 * lo expresa bien).
 *
 * Ningún parámetro se llama `estado*`, `aprob*`, `gestion*` ni `decision*` en
 * las herramientas que escriben: el cambio de estado va fijo dentro de cada
 * herramienta (calificada, investigada, descartada). Lo prueba un test.
 */

const IDENTIFICADOR = /^[A-Za-z0-9_-]{1,100}$/;

const id = z
  .string()
  .regex(IDENTIFICADOR, "Identificador no válido.")
  .describe(
    "Identificador de la oportunidad: el «id» que devuelven listar_oportunidades o crear_oportunidad"
  );

const competidorId = z
  .string()
  .regex(IDENTIFICADOR, "Identificador no válido.")
  .describe(
    "Identificador del competidor: el «id» que devuelve listar_competidores"
  );

/**
 * Una instancia nueva cada vez. (El SDK pasa los esquemas a JSON Schema con
 * `zodToJsonSchema` sin opciones: un esquema compartido entre dos campos sale la
 * segunda vez como `$ref`. Lo que no se declara aquí con una instancia propia se
 * renueva al final, en `ENTRADAS`, con `sinReferencias`.)
 */
const fechaIso = () =>
  z
    .string()
    .datetime({ offset: true })
    .describe("Fecha y hora ISO 8601 con zona, p. ej. 2026-12-01T00:00:00Z");

const puntuacion = (queMide: string) =>
  CalificacionBody.shape.puntTrafico
    .unwrap()
    .describe(`${queMide}: entero de 0 a 100`);

const oportunidadNueva = OportunidadBaseBody.omit({
  fuenteId: true,
  nichoId: true,
  ejecucionId: true,
  expiraEn: true,
}).shape;

const moduloDeEjecucion = z
  .object({
    resultado: z.enum(["ok", "parcial", "error", "omitido"]),
    inicio: fechaIso().optional(),
    fin: fechaIso().optional(),
    error: z.string().trim().max(500).optional(),
    notas: z.string().trim().max(500).optional(),
  })
  .strict();

/** Cambia la descripción de un campo opcional de un esquema ajeno sin tocar el original. */
function describir<T extends z.ZodTypeAny>(
  opcional: z.ZodOptional<T>,
  texto: string
) {
  return opcional.unwrap().describe(texto).optional();
}

/**
 * `datos` de una oportunidad (al crearla y al calificarla): lo mismo que acepta
 * el backend, con la descripción de `competidoresMencionados`, cuyos dominios
 * el backend comprueba contra los competidores confirmados en las dos
 * llamadas.
 */
const datosConCompetidores = DatosDeOportunidad.extend({
  competidoresMencionados: describir(
    DatosDeOportunidad.shape.competidoresMencionados,
    `Dominios de los competidores CONFIRMADOS que esta página menciona, lista o compara (p. ej. heydiga.ai en un «mejores recepcionistas de IA»), hasta ${MAXIMO_DE_COMPETIDORES_MENCIONADOS}. Solo valen los que salen en leer_contexto (competidores) o en listar_competidores sin estado «propuesto»: un dominio desconocido o aún propuesto se rechaza con 400 competidor_desconocido`
  ),
})
  .optional()
  .describe(
    "Datos opcionales de la página: tipoDestino, enlaceEsperado, dificultad, nota (hasta 500 caracteres; es texto de la página y sale bajo «terceros») y competidoresMencionados"
  );

const DESCRIPCION_DEL_ENLACE =
  "Enlace a alhabla.ai que va en el mensaje. El UTM de medición va AQUÍ, dentro de la URL, con al menos utm_source (p. ej. https://alhabla.ai/peluquerias?utm_source=medio-x&utm_medium=email): la regla blanda enlace_con_utm lo busca en esta URL y avisa si no está";

const DESCRIPCION_DEL_UTM =
  "Solo informativo: se guarda como anotación del borrador, pero NO se añade al enlace ni cuenta para la regla enlace_con_utm. Pon el UTM dentro de enlaceUrl";

const ENTRADAS_ORIGINALES = {
  estado_growth: {},

  leer_contexto: {},

  leer_conocimiento: {
    tipo: z
      .enum(TIPOS_DE_AFIRMACION)
      .optional()
      .describe("Solo las afirmaciones de este tipo"),
    prefijoDeClave: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_.-]+$/, "Solo minúsculas, números, punto, guion y _")
      .optional()
      .describe(
        "Prefijo de la clave, p. ej. «precio.» o «comparativa.heydiga»"
      ),
    buscar: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("Texto que debe aparecer en la clave o en el texto"),
    limite: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Cuántas pedir (por defecto 50). Si no caben en una respuesta se devuelven menos y «siguiente» dice por dónde seguir"
      ),
    desde: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9_.-]+$/, "Solo minúsculas, números, punto, guion y _")
      .optional()
      .describe(
        "Para seguir donde se quedó la lectura anterior: el valor de «siguiente» de esa respuesta, con los mismos filtros"
      ),
    incluirValor: z
      .boolean()
      .optional()
      .describe(
        "true: añade a cada afirmación su «valor» estructurado (planes, términos de las prohibidas, fuentes de las comparativas…). Por defecto no se envía: el texto basta para citarla y el valor multiplica el tamaño"
      ),
  },

  listar_oportunidades: {
    estados: z
      .array(z.enum(ESTADOS_DE_OPORTUNIDAD))
      .min(1)
      .max(ESTADOS_DE_OPORTUNIDAD.length)
      .optional()
      .describe(
        "Solo las que estén en alguno de estos estados (filtro; no cambia nada)"
      ),
    fuente: z
      .enum(TIPOS_DE_FUENTE)
      .optional()
      .describe("web, directorio o manual (las URL que añadió el fundador)"),
    dominio: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(253)
      .optional()
      .describe("Solo las de este dominio"),
    pagina: z.number().int().min(1).max(1000).optional(),
    limite: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Por página (por defecto 25)"),
  },

  ver_oportunidad: { id },

  abrir_ejecucion: {
    disparador: z
      .enum(DISPARADORES_DE_EJECUCION)
      .describe(
        "programada si la lanza la tarea semanal; manual si la lanza el fundador"
      ),
  },

  cerrar_ejecucion: {
    resultado: z
      .enum(ESTADOS_DE_CIERRE_DE_EJECUCION)
      .describe(
        "ok, parcial (algún módulo falló) o error (no se pudo hacer el run)"
      ),
    resumen: ResumenDeEjecucion.optional().describe(
      "Recuentos informativos del run; el panel muestra además los que calcula el servidor"
    ),
    modulos: z
      .record(z.string().min(1).max(60), moduloDeEjecucion)
      .optional()
      .describe(
        "Cómo fue cada módulo (discovery, qualification…), con su duración y su error"
      ),
    error: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional()
      .describe("Obligatorio si el resultado es error"),
  },

  sincronizar_conocimiento: {
    soloComprobar: z
      .boolean()
      .optional()
      .describe(
        "true: calcula y enseña qué cambiaría sin escribir nada. No se puede pasar contenido: se lee del repositorio"
      ),
  },

  crear_oportunidad: {
    ...oportunidadNueva,
    url: oportunidadNueva.url.describe(
      "URL de la página (http o https) donde puede conseguirse el enlace o la mención"
    ),
    titulo: oportunidadNueva.titulo.describe(
      "Título de la página, hasta 300 caracteres"
    ),
    extracto: oportunidadNueva.extracto.describe(
      "Lo relevante de la página, hasta 2000 caracteres (se guardan 500)"
    ),
    fuenteTipo: oportunidadNueva.fuenteTipo.describe(
      "web (por defecto) o directorio. Las URL manuales las añade el fundador"
    ),
    nichoSlug: oportunidadNueva.nichoSlug.describe(
      "Slug del sector, p. ej. peluquerias; los que existen salen en leer_contexto"
    ),
    idioma: oportunidadNueva.idioma.describe("Idioma de la página, p. ej. es"),
    puntTrafico: oportunidadNueva.puntTrafico.describe(
      "Opcional aquí (se fija al calificar): tráfico de marca, de 0 a 100"
    ),
    puntLeads: oportunidadNueva.puntLeads.describe(
      "Opcional aquí (se fija al calificar): clientes potenciales, de 0 a 100"
    ),
    puntBacklinks: oportunidadNueva.puntBacklinks.describe(
      "Opcional aquí (se fija al calificar): valor del enlace, de 0 a 100"
    ),
    datos: datosConCompetidores,
    expiraEn: fechaIso().optional(),
  },

  calificar_oportunidad: {
    id,
    objetivoPrincipal: z
      .enum(OBJETIVOS)
      .describe(
        "TRAFICO_MARCA, LEADS o BACKLINKS: el objetivo al que mejor sirve"
      ),
    puntTrafico: puntuacion("Cuánto tráfico de marca puede aportar"),
    puntLeads: puntuacion("Cuántos clientes potenciales puede aportar"),
    puntBacklinks: puntuacion(
      "Valor del enlace entrante (autoridad y relevancia)"
    ),
    nichoSlug: CalificacionBody.shape.nichoSlug,
    idioma: CalificacionBody.shape.idioma.describe(
      "Idioma de la página, p. ej. es"
    ),
    titulo: CalificacionBody.shape.titulo,
    extracto: CalificacionBody.shape.extracto,
    datos: datosConCompetidores,
    expiraEn: fechaIso().optional(),
  },

  descartar_oportunidad: {
    id,
    codigo: CodigoDescarte.exclude(["manual"]).describe(
      "Por qué se descarta (el código agrupa los descartes en el panel)"
    ),
    motivo: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("Una frase: qué pasa con esta página"),
  },

  guardar_investigacion: {
    id,
    ...InvestigacionBaseBody.shape,
    marcarInvestigada: z
      .boolean()
      .optional()
      .describe(
        "Por defecto true: además de guardar, pasa la oportunidad a «investigada»"
      ),
  },

  evaluar_borrador: {
    ...EvaluarBorradorBody.shape,
    enlaceUrl: describir(
      EvaluarBorradorBody.shape.enlaceUrl,
      DESCRIPCION_DEL_ENLACE
    ),
    utm: describir(EvaluarBorradorBody.shape.utm, DESCRIPCION_DEL_UTM),
    oportunidadId: id,
  },

  crear_borrador: {
    oportunidadId: id,
    ...BorradorBody.shape,
    enlaceUrl: describir(BorradorBody.shape.enlaceUrl, DESCRIPCION_DEL_ENLACE),
    utm: describir(BorradorBody.shape.utm, DESCRIPCION_DEL_UTM),
  },

  registrar_cumplimiento: {
    borradorId: id.describe("El «borradorId» que devolvió crear_borrador"),
    comprobaciones: RevisionLlmBody.shape.comprobaciones,
  },

  listar_competidores: {
    estados: z
      .array(z.enum(ESTADOS_DE_COMPETIDOR))
      .min(1)
      .max(ESTADOS_DE_COMPETIDOR.length)
      .optional()
      .describe(
        "Solo los que estén en alguno de estos estados (filtro; no cambia nada): propuesto, por_analizar, analizado o revisado"
      ),
    soloPendientes: z
      .boolean()
      .optional()
      .describe(
        "true: solo los que hay que analizar ahora (por_analizar, o con el último análisis caducado)"
      ),
  },

  // Sin `ejecucionId`: lo enlaza el MCP solo, como en crear_oportunidad.
  guardar_analisis_de_competidor: {
    competidorId,
    resumen: AnalisisDeCompetidorBodyBase.shape.resumen.describe(
      "Resumen de lo que hace el competidor y cómo se posiciona, hasta 2000 caracteres, solo con lo que publica su web. Sin correos ni teléfonos"
    ),
    datos: AnalisisDeCompetidorBodyBase.shape.datos.describe(
      `De 1 a ${MAXIMO_DE_DATOS_POR_ANALISIS} hechos PÚBLICOS, cada uno con la página de la que sale (urlFuente) y el momento en que la leíste (consultadoEn: entre ahora y hace 30 días). tipo: producto, servicio, precio, plan, integracion, sector, idioma, canal, limite, diferencia u otro. Los de tipo precio llevan valor (importe, moneda, periodo); si no publican el precio, usa tipo «otro». Un hecho sin URL y fecha no se guarda`
    ),
  },

  proponer_competidor: {
    url: PropuestaDeCompetidorBody.shape.url.describe(
      "URL (http o https) de la web del competidor: su portada o su página de producto"
    ),
    nombre: PropuestaDeCompetidorBody.shape.nombre.describe(
      "Nombre comercial del competidor, hasta 120 caracteres"
    ),
    motivo: PropuestaDeCompetidorBody.shape.motivo.describe(
      "Una o dos frases: por qué parece un competidor de Alhabla (recepcionista de IA que atiende llamadas y reserva citas de pequeños negocios), hasta 500 caracteres"
    ),
    fuenteUrl: describir(
      PropuestaDeCompetidorBody.shape.fuenteUrl,
      "Página donde lo has visto mencionado, p. ej. la lista «alternativas a …» (http o https)"
    ),
  },
} as const;

// ── Sin `$ref` en los esquemas de entrada ────────────────────────────────

type Definicion = Record<string, unknown> & { typeName?: string };
type ConstructorDeEsquema = new (definicion: unknown) => z.ZodTypeAny;

/**
 * Una copia profunda de un esquema de Zod 3 en la que ningún nodo comparte
 * definición con otro: así `zodToJsonSchema` (que reconoce lo repetido por la
 * identidad de la definición) no lo emite como `$ref`. Algunos clientes de MCP
 * no resuelven los `$ref` de un `inputSchema`.
 */
function renovar<T extends z.ZodTypeAny>(esquema: T): T {
  const def = esquema._def as Definicion;
  const Clase = esquema.constructor as ConstructorDeEsquema;
  const hijo = (clave: string) => renovar(def[clave] as z.ZodTypeAny);
  switch (def.typeName) {
    case Tipo.ZodOptional:
    case Tipo.ZodNullable:
    case Tipo.ZodDefault:
    case Tipo.ZodCatch:
    case Tipo.ZodReadonly:
      return new Clase({ ...def, innerType: hijo("innerType") }) as T;
    case Tipo.ZodArray:
    case Tipo.ZodBranded:
      return new Clase({ ...def, type: hijo("type") }) as T;
    case Tipo.ZodSet:
      return new Clase({ ...def, valueType: hijo("valueType") }) as T;
    case Tipo.ZodRecord:
    case Tipo.ZodMap:
      return new Clase({
        ...def,
        keyType: hijo("keyType"),
        valueType: hijo("valueType"),
      }) as T;
    case Tipo.ZodEffects:
      return new Clase({ ...def, schema: hijo("schema") }) as T;
    case Tipo.ZodPipeline:
      return new Clase({ ...def, in: hijo("in"), out: hijo("out") }) as T;
    case Tipo.ZodUnion:
    case Tipo.ZodDiscriminatedUnion:
      return new Clase({
        ...def,
        options: (def.options as z.ZodTypeAny[]).map(renovar),
      }) as T;
    case Tipo.ZodObject: {
      const forma: z.ZodRawShape = (esquema as unknown as z.AnyZodObject).shape;
      const nueva = Object.fromEntries(
        Object.entries(forma).map(([campo, v]) => [campo, renovar(v)])
      );
      return new Clase({ ...def, shape: () => nueva }) as T;
    }
    default:
      return new Clase({ ...def }) as T;
  }
}

function sinReferencias<T extends Record<string, z.ZodRawShape>>(
  herramientas: T
): T {
  return Object.fromEntries(
    Object.entries(herramientas).map(([herramienta, forma]) => [
      herramienta,
      Object.fromEntries(
        Object.entries(forma).map(([campo, esquema]) => [
          campo,
          renovar(esquema),
        ])
      ),
    ])
  ) as T;
}

export const ENTRADAS = sinReferencias(ENTRADAS_ORIGINALES);
