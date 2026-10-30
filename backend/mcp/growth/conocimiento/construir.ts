import { SincronizarBody } from "../../../src/modules/growth/esquemas.js";
import type { TipoDeAfirmacion } from "../../../src/modules/growth/esquemas.js";
import { afirmacionesConTerminosProhibidos } from "../../../src/modules/growth/conocimiento/terminos.js";
import type { ArticuloDeBlog } from "./frontmatter.js";
import {
  COMPETIDORES_ADICIONALES,
  FEATURES_EXCLUIDAS,
  FRASES_DECLARADAS,
  GRUPO_CAPACIDADES,
  GRUPO_TERMINOLOGIA,
  MAPA_DE_FEATURES_DE_PLANES,
  MAPA_DE_PRODUCT,
  NOMBRE_DE_PLAN,
  SECCION_CAPACIDADES,
  SINTAGMA_DE_FEATURE,
  type EntradaDelMapa,
} from "./mapa.js";
import {
  huellaDe,
  slugDeAncla,
  terminosNuncaDe,
  type ProductMdParseado,
} from "./productMd.js";
import type { DatosDeWeb } from "./cargarWeb.js";
import {
  terminosSinCubrir,
  type ReglasProhibidas,
} from "./reglasProhibidas.js";

/**
 * De los datos del repo (ya leídos) a las afirmaciones que se mandan al
 * servidor. PURA: sin disco, sin red, sin git. Todo lo que lee del repo entra
 * por `EntradaDeConocimiento`, así los tests la prueban con datos inyectados y
 * `--comprobar` la corre en CI sin base de datos.
 *
 * Reúne TODOS los problemas antes de fallar (un `ErroresDeExtraccion` con la
 * lista entera): quien toca PRODUCT.md o plans.ts los ve de una vez.
 */

// ── Tipos ────────────────────────────────────────────────────────────────

/** Lo que se manda al servidor por cada afirmación. */
export type AfirmacionAEnviar = {
  clave: string;
  tipo: TipoDeAfirmacion;
  texto: string;
  valor?: Record<string, unknown>;
  /** `ruta#ancla` real del repo. */
  fuente: string;
  nichoSlug?: string;
};

export type PaginaAEnviar = {
  ruta: string;
  nombre: string;
  seccion: string;
  nichoSlug?: string;
  actualizado?: string;
};

export type EntradaDeConocimiento = {
  web: DatosDeWeb;
  productMd: ProductMdParseado;
  articulos: readonly ArticuloDeBlog[];
  reglas: ReglasProhibidas;
  /** `PLAN_FEATURES` de backend/src/lib/planFeatures.ts. */
  planFeatures: Record<
    string,
    { maxProfessionals: number | null; features: readonly string[] }
  >;
  /** `BILLING_PLANS` de backend/src/modules/billing/catalog.ts. */
  billing: Record<
    string,
    { includedMinutes: number; extraMinuteCents: number }
  >;
  /**
   * Nombre del `export const` de cada sector (slug → nombre), leído del
   * propio fichero: es el ancla real de la afirmación.
   */
  exportsDeSectores: Record<string, string>;
};

export type ResultadoDeConstruccion = {
  afirmaciones: AfirmacionAEnviar[];
  /**
   * Los tipos de los que `afirmaciones` es la lista COMPLETA: se mandan
   * siempre como `tipos` para que el servidor cierre lo que el repo ya no
   * dice, y para que detecte que un tipo entero se ha quedado vacío.
   */
  tipos: TipoDeAfirmacion[];
  competidores: { nombre: string; dominio: string }[];
  nichos: { slug: string; nombre: string }[];
  paginas: PaginaAEnviar[];
  /** Avisos que no impiden sincronizar (una limitación que ya no está, candidatas…). */
  avisos: string[];
  /** Ficheros del repo de los que sale algo, desde la raíz. */
  fuentes: string[];
};

export class ErroresDeExtraccion extends Error {
  constructor(public readonly problemas: readonly string[]) {
    super(
      `[Conocimiento] La extracción tiene ${problemas.length} problema${problemas.length === 1 ? "" : "s"}:\n${problemas.map((p) => `  - ${p}`).join("\n")}`
    );
    this.name = "ErroresDeExtraccion";
  }
}

// ── Utilidades ───────────────────────────────────────────────────────────

export const URL_DEL_SITIO = "https://alhabla.ai";

const FICHERO_PRODUCT = "PRODUCT.md";
const FICHERO_PLANS = "web/src/lib/plans.ts";
const FICHERO_PAGINAS = "web/src/lib/paginas.ts";
const FICHERO_COMPARATIVAS = "web/src/lib/comparativas.ts";
const FICHERO_PLAN_FEATURES = "backend/src/lib/planFeatures.ts";
const FICHERO_CATALOGO = "backend/src/modules/billing/catalog.ts";
const FICHERO_SECTORES = "web/src/lib/sectores/index.ts";
const FICHERO_REGLAS = "growth/agentes/reglas/afirmaciones-prohibidas.md";

/** 1500 → «1.500». */
export function miles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 0.3 → «0,30». */
export function euros(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** Sin decimales si es entero («139»). */
function cuota(n: number): string {
  return Number.isInteger(n) ? String(n) : euros(n);
}

function listaDePlanes(planes: readonly string[]): string {
  const nombres = planes.map((p) => NOMBRE_DE_PLAN[p] ?? p);
  if (nombres.length === 1) return `el plan ${nombres[0]}`;
  return `los planes ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function fechaEnTexto(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function camelCase(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** El registrable de un host (`docs.vapi.ai` → `vapi.ai`): los dos últimos nombres. */
export function dominioRaiz(url: string): string {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  return host.split(".").slice(-2).join(".");
}

function slugDePlataforma(f: { ruta: string | null; nombre: string }): string {
  if (f.ruta) return f.ruta.replace(/^.*alhabla-vs-/, "");
  return slugDeAncla(f.nombre);
}

function clavePagina(ruta: string): string {
  if (ruta === "/") return "pagina.inicio";
  return `pagina.${ruta.replace(/^\//, "").replace(/\//g, ".")}`;
}

function anclaDePagina(ruta: string): string {
  return clavePagina(ruta).slice("pagina.".length);
}

function iso(fecha: string): string {
  return `${fecha}T00:00:00Z`;
}

// ── PRODUCT.md ───────────────────────────────────────────────────────────

type Elemento = {
  seccion: string;
  grupo: string | null;
  linea: number;
  texto: string;
};

/** Las secciones de PRODUCT.md que el mapa gobierna. */
const SECCIONES_DEL_MAPA = [...new Set(MAPA_DE_PRODUCT.map((e) => e.seccion))];

function elementosDeProduct(parseado: ProductMdParseado): Elemento[] {
  return [...parseado.bullets, ...parseado.parrafos]
    .filter((e) => SECCIONES_DEL_MAPA.includes(e.seccion))
    .sort((a, b) => a.linea - b.linea);
}

function describir(e: Elemento): string {
  return `«${e.grupo ?? e.seccion}» (línea ${e.linea}): «${e.texto.slice(0, 70)}…»`;
}

function anclaDeProduct(e: { seccion: string; grupo: string | null }): string {
  return `${FICHERO_PRODUCT}#${slugDeAncla(e.grupo ?? e.seccion)}`;
}

function describirCambioDeBullet(e: Elemento): string {
  return `ahora dice «${e.texto.slice(0, 160)}${e.texto.length > 160 ? "…" : ""}».`;
}

/** La frase (hasta el punto) del bullet que contiene lo encontrado. */
function oracionQueContiene(
  texto: string,
  encontrada: RegExpExecArray
): string {
  return (
    texto.split(/(?<=\.)\s+/).find((o) => o.includes(encontrada[0])) ??
    encontrada[0]
  );
}

function desdeProduct(
  parseado: ProductMdParseado,
  problemas: string[],
  avisos: string[]
): AfirmacionAEnviar[] {
  const resultado: AfirmacionAEnviar[] = [];
  const elementos = elementosDeProduct(parseado);
  const usadas = new Map<EntradaDelMapa, Elemento[]>();

  for (const elemento of elementos) {
    const candidatas = MAPA_DE_PRODUCT.filter(
      (e) =>
        e.seccion === elemento.seccion &&
        e.grupo === elemento.grupo &&
        e.empiezaPor.test(elemento.texto)
    );
    if (candidatas.length === 0) {
      problemas.push(
        `PRODUCT.md tiene algo sin entrada en mcp/growth/conocimiento/mapa.ts: ${describir(elemento)}. Añade una entrada (con su clave y texto revisado) o ignórala con un motivo.`
      );
      continue;
    }
    if (candidatas.length > 1) {
      problemas.push(
        `PRODUCT.md: ${describir(elemento)} casa con ${candidatas.length} entradas del mapa; deja una.`
      );
      continue;
    }
    usadas.set(candidatas[0], [...(usadas.get(candidatas[0]) ?? []), elemento]);
    const entrada = candidatas[0];
    if ("ignorar" in entrada) continue;
    const { destino } = entrada;
    const huellaActual = huellaDe(elemento.texto);
    if (huellaActual !== destino.huella) {
      problemas.push(
        `El bullet de ${destino.clave} cambió desde que se revisó su texto (PRODUCT.md, línea ${elemento.linea}; huella ${destino.huella} → ${huellaActual}): ${describirCambioDeBullet(elemento)} Revisa el texto en mcp/growth/conocimiento/mapa.ts y actualiza la huella (\`npm run growth:conocimiento -- --actualizar-huellas\`).`
      );
    }
    resultado.push({
      clave: destino.clave,
      tipo: destino.tipo,
      texto: destino.texto,
      valor: { huellaOrigen: huellaDe(elemento.texto), ...destino.valor },
      fuente: anclaDeProduct(elemento),
    });
  }

  for (const entrada of MAPA_DE_PRODUCT) {
    const encontrados = usadas.get(entrada)?.length ?? 0;
    if (encontrados === 0) {
      problemas.push(
        `La entrada del mapa ${String(entrada.empiezaPor)} (${entrada.grupo ?? entrada.seccion}) ya no encuentra su texto en PRODUCT.md. Si se retiró a propósito, quita la entrada: la afirmación se cerrará.`
      );
    } else if (encontrados > 1) {
      problemas.push(
        `La entrada del mapa ${String(entrada.empiezaPor)} casa con ${encontrados} textos de PRODUCT.md.`
      );
    }
  }

  // Frases que son una limitación dentro de un bullet. Que una desaparezca es
  // un ERROR, no un aviso: la sincronización cerraría la limitación, y quien
  // redacta dejaría de saber que no puede prometerla. Si el límite ya no
  // existe, se quita la entrada de FRASES_DECLARADAS (mapa.ts) a propósito.
  for (const declarada of FRASES_DECLARADAS) {
    const bullet = parseado.bullets.find(
      (b) =>
        b.seccion === SECCION_CAPACIDADES &&
        b.grupo === declarada.grupo &&
        declarada.dentroDe.test(b.texto)
    );
    const encontrada = bullet ? declarada.frase.exec(bullet.texto) : null;
    if (!bullet || !encontrada) {
      problemas.push(
        `La limitación ${declarada.destino.clave} ya no aparece en PRODUCT.md (${bullet ? `el bullet «${bullet.grupo}» (línea ${bullet.linea}) ya no contiene la frase ${String(declarada.frase)}` : `no hay ningún bullet que case con ${String(declarada.dentroDe)}`}). Si el límite ya no existe, quita la entrada de FRASES_DECLARADAS en mcp/growth/conocimiento/mapa.ts (la sincronización la cerrará); si solo cambió la redacción, actualiza la frase.`
      );
      continue;
    }
    const huellaActual = huellaDe(oracionQueContiene(bullet.texto, encontrada));
    if (huellaActual !== declarada.destino.huella) {
      problemas.push(
        `La frase de la limitación ${declarada.destino.clave} cambió desde que se revisó su texto (PRODUCT.md, línea ${bullet.linea}; huella ${declarada.destino.huella} → ${huellaActual}): revisa el texto en mcp/growth/conocimiento/mapa.ts y actualiza la huella (\`npm run growth:conocimiento -- --actualizar-huellas\`).`
      );
    }
    resultado.push({
      clave: declarada.destino.clave,
      tipo: "limite",
      texto: declarada.destino.texto,
      valor: { huellaOrigen: huellaDe(encontrada[0]) },
      fuente: anclaDeProduct(bullet),
    });
  }

  // Ayuda para descubrir: frases de los bullets que SÍ se emiten y parecen una
  // limitación que ninguna entrada declara. No generan filas ni fallan. (Los
  // bullets ignorados ya llevan su motivo.)
  const CANDIDATA =
    /\b(no (puede|está|existe|hay)|aún no|todavía no|requiere|rechaza|exige)\b/i;
  for (const bullet of parseado.bullets.filter(
    (b) => b.seccion === SECCION_CAPACIDADES && b.grupo === GRUPO_CAPACIDADES
  )) {
    const entrada = MAPA_DE_PRODUCT.find(
      (e) =>
        e.seccion === bullet.seccion &&
        e.grupo === bullet.grupo &&
        e.empiezaPor.test(bullet.texto)
    );
    if (!entrada || "ignorar" in entrada) continue;
    for (const frase of bullet.texto.split(/(?<=\.)\s+/)) {
      if (!CANDIDATA.test(frase)) continue;
      if (FRASES_DECLARADAS.some((d) => d.frase.test(frase))) continue;
      avisos.push(
        `Posible limitación sin clave en PRODUCT.md (línea ${bullet.linea}): «${frase.slice(0, 110)}»`
      );
    }
  }
  return resultado;
}

// ── plans.ts, planFeatures.ts, catálogo ──────────────────────────────────

function precios(web: DatosDeWeb, problemas: string[]): AfirmacionAEnviar[] {
  const resultado: AfirmacionAEnviar[] = [];
  for (const plan of web.plans) {
    resultado.push({
      clave: `precio.plan.${plan.id}`,
      tipo: "precio",
      texto: `Plan ${plan.name}: ${cuota(plan.price)} € + IVA al mes, ${miles(plan.minutes)} minutos incluidos y ${euros(plan.extraPerMinute)} € + IVA por minuto adicional.`,
      valor: {
        plan: plan.id,
        cuotaEur: plan.price,
        minutosIncluidos: plan.minutes,
        minutoExtraEur: plan.extraPerMinute,
        ivaIncluido: false,
      },
      fuente: `${FICHERO_PLANS}#plans.${plan.id}`,
    });
  }
  resultado.push({
    clave: "precio.iva",
    tipo: "precio",
    texto: `Los precios se publican sin IVA; se añade el ${web.ivaPorcentaje} %.`,
    valor: { ivaPorcentaje: web.ivaPorcentaje },
    fuente: `${FICHERO_PLANS}#IVA_PORCENTAJE`,
  });
  resultado.push({
    clave: "precio.prueba",
    tipo: "precio",
    texto: web.tranquilizadorDePrueba,
    valor: { diasDePrueba: web.diasDePrueba, permanencia: false },
    fuente: `${FICHERO_PLANS}#TRIAL_REASSURANCE`,
  });

  const masBarato = Math.min(...web.plans.map((p) => p.price));
  if (!web.precioDesde.includes(`${masBarato} €`)) {
    problemas.push(
      `plans.ts: PRECIO_DESDE («${web.precioDesde}») no menciona el plan más barato (${masBarato} €).`
    );
  }
  resultado.push({
    clave: "precio.desde",
    tipo: "precio",
    texto: `Los planes de Alhabla empiezan en ${cuota(masBarato)} € + IVA al mes.`,
    valor: { cuotaEur: masBarato },
    fuente: `${FICHERO_PLANS}#PRECIO_DESDE`,
  });
  return resultado;
}

function planes(
  entrada: EntradaDeConocimiento,
  problemas: string[]
): AfirmacionAEnviar[] {
  const { web, planFeatures } = entrada;
  const resultado: AfirmacionAEnviar[] = [];
  const idsDeLaWeb = web.plans.map((p) => p.id);

  for (const id of Object.keys(planFeatures)) {
    if (!idsDeLaWeb.includes(id)) {
      problemas.push(`planFeatures.ts tiene el plan «${id}» y plans.ts no.`);
    }
  }

  // Funciones con texto: una por feature de cada plan de plans.ts.
  const entradasUsadas = new Set<(typeof MAPA_DE_FEATURES_DE_PLANES)[number]>();
  const featuresVistas = new Set<string>();
  web.plans.forEach((plan, indice) => {
    const limites = planFeatures[plan.id];
    if (!limites) {
      problemas.push(
        `plans.ts tiene el plan «${plan.id}» y planFeatures.ts no.`
      );
      return;
    }
    for (const texto of plan.features) {
      const candidatas = MAPA_DE_FEATURES_DE_PLANES.filter(
        (e) => e.plan === plan.id && e.empiezaPor.test(texto)
      );
      if (candidatas.length !== 1) {
        problemas.push(
          `plans.ts, plan ${plan.id}: el texto «${texto}» ${candidatas.length === 0 ? "no tiene entrada" : "casa con varias entradas"} en MAPA_DE_FEATURES_DE_PLANES (mcp/growth/conocimiento/mapa.ts).`
        );
        continue;
      }
      const entradaDelMapa = candidatas[0];
      entradasUsadas.add(entradaDelMapa);
      if ("ignorar" in entradaDelMapa) continue;

      if ("feature" in entradaDelMapa) {
        const feature = entradaDelMapa.feature;
        featuresVistas.add(feature);
        const planesQueLaTienen = Object.entries(planFeatures)
          .filter(([, p]) => p.features.includes(feature))
          .map(([id]) => id);
        if (planesQueLaTienen.length === 0) {
          problemas.push(
            `plans.ts anuncia «${texto}» en el plan ${plan.id}, pero ningún plan de planFeatures.ts tiene la función «${feature}».`
          );
          continue;
        }
        const primero = planesQueLaTienen[0];
        if (primero !== plan.id) {
          problemas.push(
            `La función «${feature}» sale en plans.ts en el plan ${plan.id} y en planFeatures.ts empieza en ${primero}: la web y el gating no coinciden.`
          );
        }
        resultado.push({
          clave: entradaDelMapa.clave,
          tipo: "funcion",
          texto: `${texto}. Disponible en ${listaDePlanes(planesQueLaTienen)}.`,
          valor: { feature, planes: planesQueLaTienen },
          fuente: `${FICHERO_PLAN_FEATURES}#PLAN_FEATURES`,
        });
      } else {
        // «Todo lo de…»: lo del plan vale también para los de arriba.
        const planesQueLaTienen = idsDeLaWeb.slice(indice);
        resultado.push({
          clave: entradaDelMapa.clave,
          tipo: "funcion",
          texto,
          valor: { planes: planesQueLaTienen },
          fuente: `${FICHERO_PLANS}#plans.${plan.id}.features`,
        });
      }
    }
  });

  for (const e of MAPA_DE_FEATURES_DE_PLANES) {
    if (!entradasUsadas.has(e)) {
      problemas.push(
        `MAPA_DE_FEATURES_DE_PLANES: la entrada ${String(e.empiezaPor)} (plan ${e.plan}) ya no encuentra su texto en plans.ts.`
      );
    }
  }

  // Cada función de planFeatures.ts se afirma o se excluye con motivo.
  const todasLasFeatures = new Set(
    Object.values(planFeatures).flatMap((p) => p.features)
  );
  for (const feature of todasLasFeatures) {
    if (feature in FEATURES_EXCLUIDAS) continue;
    if (!featuresVistas.has(feature)) {
      problemas.push(
        `planFeatures.ts tiene la función «${feature}» y ni plans.ts la anuncia ni FEATURES_EXCLUIDAS la excluye: no se afirma nunca algo sin texto.`
      );
    } else if (!(feature in SINTAGMA_DE_FEATURE)) {
      problemas.push(
        `Falta el sintagma de «${feature}» en SINTAGMA_DE_FEATURE (mapa.ts).`
      );
    }
  }

  // Límites por plan.
  for (const plan of web.plans) {
    const limites = planFeatures[plan.id];
    if (!limites) continue;
    const nombre = NOMBRE_DE_PLAN[plan.id] ?? plan.name;
    const profesionales = plan.features.find((f) =>
      /^(Hasta \d+ profesionales|Profesionales sin límite)/.test(f)
    );
    const esperado =
      limites.maxProfessionals === null
        ? "Profesionales sin límite"
        : `Hasta ${limites.maxProfessionals} profesionales`;
    if (!profesionales?.startsWith(esperado)) {
      problemas.push(
        `Profesionales del plan ${plan.id}: planFeatures.ts dice ${limites.maxProfessionals ?? "sin límite"} y plans.ts dice «${profesionales ?? "(nada)"}».`
      );
    }
    resultado.push({
      clave: `limite.plan.${plan.id}.profesionales`,
      tipo: "limite",
      texto:
        limites.maxProfessionals === null
          ? `El plan ${nombre} no limita el número de profesionales.`
          : `El plan ${nombre} incluye hasta ${limites.maxProfessionals} profesionales en la agenda.`,
      valor: { plan: plan.id, maxProfesionales: limites.maxProfessionals },
      fuente: `${FICHERO_PLAN_FEATURES}#PLAN_FEATURES`,
    });

    for (const feature of Object.keys(SINTAGMA_DE_FEATURE)) {
      if (
        !todasLasFeatures.has(feature) ||
        limites.features.includes(feature)
      ) {
        continue;
      }
      const queLaIncluyen = Object.entries(planFeatures)
        .filter(([, p]) => p.features.includes(feature))
        .map(([id]) => id);
      resultado.push({
        clave: `limite.plan.${plan.id}.sin_${feature}`,
        tipo: "limite",
        texto: `El plan ${nombre} no incluye ${SINTAGMA_DE_FEATURE[feature]}. ${queLaIncluyen.length === 1 ? "Lo tiene" : "Lo tienen"} ${listaDePlanes(queLaIncluyen)}.`,
        valor: { plan: plan.id, feature, planesQueLaIncluyen: queLaIncluyen },
        fuente: `${FICHERO_PLAN_FEATURES}#PLAN_FEATURES`,
      });
    }
  }
  return resultado;
}

function contrastes(entrada: EntradaDeConocimiento, problemas: string[]): void {
  const { web, billing, productMd } = entrada;

  // plans.ts ↔ catálogo de facturación.
  for (const plan of web.plans) {
    const facturacion = billing[plan.id];
    if (!facturacion) {
      problemas.push(`${FICHERO_CATALOGO} no tiene el plan «${plan.id}».`);
      continue;
    }
    if (facturacion.includedMinutes !== plan.minutes) {
      problemas.push(
        `Minutos del plan ${plan.id}: ${FICHERO_CATALOGO} dice ${facturacion.includedMinutes} y plans.ts ${plan.minutes}.`
      );
    }
    if (
      facturacion.extraMinuteCents !== Math.round(plan.extraPerMinute * 100)
    ) {
      problemas.push(
        `Minuto extra del plan ${plan.id}: ${FICHERO_CATALOGO} dice ${facturacion.extraMinuteCents} céntimos y plans.ts ${plan.extraPerMinute} €.`
      );
    }
  }

  // plans.ts ↔ la línea «Comercial» de PRODUCT.md.
  const comercial = productMd.bullets.find(
    (b) =>
      b.seccion === "Operating Context" && b.texto.startsWith("**Comercial:**")
  );
  if (!comercial) {
    problemas.push(
      "PRODUCT.md ya no tiene el bullet «Comercial» de Operating Context: no se puede contrastar el precio con plans.ts."
    );
    return;
  }
  for (const plan of web.plans) {
    const esperado = `\`${plan.id}\` ${cuota(plan.price)} € + IVA/mes (${miles(plan.minutes)} min, ${euros(plan.extraPerMinute)} €/min extra`;
    if (!comercial.texto.includes(esperado)) {
      problemas.push(
        `Precio del plan ${plan.id}: PRODUCT.md (Operating Context › Comercial) no dice «${esperado}» y plans.ts sí.`
      );
    }
  }
  const fundadores = web.plans.map((p) => cuota(p.founderPrice)).join("/");
  if (!comercial.texto.includes(`${fundadores} € + IVA`)) {
    problemas.push(
      `Precio de fundador: PRODUCT.md no dice «${fundadores} € + IVA» y plans.ts sí.`
    );
  }
}

// ── Sectores, comparativas, páginas, prohibidas ──────────────────────────

function sectores(
  entrada: EntradaDeConocimiento,
  problemas: string[]
): {
  afirmaciones: AfirmacionAEnviar[];
  nichos: { slug: string; nombre: string }[];
} {
  const afirmaciones: AfirmacionAEnviar[] = [];
  const nichos: { slug: string; nombre: string }[] = [];
  for (const s of entrada.web.sectores) {
    const exportado = entrada.exportsDeSectores[s.slug];
    if (!exportado) {
      problemas.push(
        `No se encontró el «export const» del sector ${s.slug} en web/src/lib/sectores/${s.slug}.ts (esperado: ${camelCase(s.slug)}).`
      );
      continue;
    }
    const fuente = `web/src/lib/sectores/${s.slug}.ts#${exportado}`;
    afirmaciones.push({
      clave: `sector.${s.slug}`,
      tipo: "sector",
      texto: s.descripcion,
      valor: {
        slug: s.slug,
        nombre: s.nombre,
        titulo: s.titulo,
        paraQuien: s.paraQuien,
        clientes: s.clientes,
        ruta: `/${s.slug}`,
        negocioDeEjemplo: s.negocio,
        // El negocio de las escenas de la web es inventado: no es un cliente.
        negocioDeEjemploEsFicticio: true,
        hero: s.heroFrase,
        conDatosDeSalud: s.salud !== null,
      },
      fuente,
      nichoSlug: s.slug,
    });
    if (s.salud) {
      afirmaciones.push({
        clave: `limite.sector.${s.slug}.datos_de_salud`,
        tipo: "limite",
        texto: s.salud,
        fuente,
        nichoSlug: s.slug,
      });
    }
    nichos.push({ slug: s.slug, nombre: s.nombre });
  }
  return { afirmaciones, nichos };
}

const CAMPOS_DE_COMPARATIVA = [
  ["perfil", "paraQuien", "a quién se dirige"],
  ["precio", "precio", "precio"],
  ["numero", "numero", "números de teléfono"],
] as const;

function comparativas(
  web: DatosDeWeb,
  problemas: string[]
): {
  afirmaciones: AfirmacionAEnviar[];
  competidores: { nombre: string; dominio: string }[];
} {
  const { comparativas: c } = web;
  const afirmaciones: AfirmacionAEnviar[] = [];
  const competidores: { nombre: string; dominio: string }[] = [];

  if (!FECHA_ISO.test(c.consultadas)) {
    problemas.push(
      `comparativas.ts: CONSULTADAS («${c.consultadas}») no es una fecha AAAA-MM-DD.`
    );
    return { afirmaciones, competidores };
  }

  for (const fila of c.resumen) {
    const slug = slugDePlataforma(fila);
    const fuentes = c.fuentes.filter((f) =>
      f.nombre.startsWith(`${fila.nombre}:`)
    );
    if (fuentes.length === 0) {
      problemas.push(
        `comparativas.ts: ${fila.nombre} sale en RESUMEN_PLATAFORMAS y no tiene ninguna fuente en FUENTES_DEL_RESUMEN («${fila.nombre}: …»).`
      );
      continue;
    }
    const dominios = [...new Set(fuentes.map((f) => dominioRaiz(f.url)))];
    if (dominios.length !== 1) {
      problemas.push(
        `comparativas.ts: las fuentes de ${fila.nombre} apuntan a más de un dominio (${dominios.join(", ")}); el competidor sería ambiguo.`
      );
      continue;
    }
    const competidorDominio = dominios[0];
    competidores.push({ nombre: fila.nombre, dominio: competidorDominio });

    for (const [campo, propiedad, etiqueta] of CAMPOS_DE_COMPARATIVA) {
      const dato = fila[propiedad];
      afirmaciones.push({
        clave: `comparativa.${slug}.${campo}`,
        tipo: "comparativa",
        texto: `${fila.nombre}, ${etiqueta}: ${dato.replace(/\.$/, "")} (según su web, consultada el ${fechaEnTexto(c.consultadas)}).`,
        valor: {
          plataforma: fila.nombre,
          campo,
          dato,
          consultadaEn: c.consultadas,
          competidorDominio,
          paginaPropia: fila.ruta,
          fuentes,
        },
        fuente: `${FICHERO_COMPARATIVAS}#RESUMEN_PLATAFORMAS.${slug}`,
      });
    }
  }

  afirmaciones.push({
    clave: "limite.comparativas.art10",
    tipo: "limite",
    texto:
      "Las comparativas con otras plataformas se limitan a características esenciales, objetivas y verificables, con la fecha de consulta y la URL de cada dato (artículo 10 de la Ley 3/1991 de Competencia Desleal). Lo que una plataforma no publica se escribe «No consta en su web», nunca «no lo tiene».",
    valor: { fuente: c.fuenteLey },
    fuente: `${FICHERO_COMPARATIVAS}#FUENTE_LEY`,
  });
  return { afirmaciones, competidores };
}

function paginas(
  entrada: EntradaDeConocimiento,
  problemas: string[]
): { afirmaciones: AfirmacionAEnviar[]; paginas: PaginaAEnviar[] } {
  const slugsDeSector = new Set(entrada.web.sectores.map((s) => s.slug));
  const afirmaciones: AfirmacionAEnviar[] = [];
  const registro: PaginaAEnviar[] = [];

  for (const p of entrada.web.paginas) {
    const nichoSlug =
      p.seccion === "sectores" ? p.ruta.replace(/^\//, "") : undefined;
    if (nichoSlug && !slugsDeSector.has(nichoSlug)) {
      problemas.push(
        `paginas.ts: la página de sector ${p.ruta} no es un sector de web/src/lib/sectores.`
      );
    }
    if (p.actualizado && !FECHA_ISO.test(p.actualizado)) {
      problemas.push(
        `paginas.ts: «actualizado» de ${p.ruta} no es AAAA-MM-DD («${p.actualizado}»).`
      );
    }
    afirmaciones.push({
      clave: clavePagina(p.ruta),
      tipo: "pagina",
      texto: `${p.nombre}: ${p.resumen}`,
      valor: {
        ruta: p.ruta,
        url: `${URL_DEL_SITIO}${p.ruta}`,
        nombre: p.nombre,
        resumen: p.resumen,
        seccion: p.seccion,
        actualizado: p.actualizado ?? null,
      },
      fuente: `${FICHERO_PAGINAS}#${anclaDePagina(p.ruta)}`,
      ...(nichoSlug ? { nichoSlug } : {}),
    });
    registro.push({
      ruta: p.ruta,
      nombre: p.nombre,
      seccion: p.seccion,
      ...(nichoSlug ? { nichoSlug } : {}),
      ...(p.actualizado ? { actualizado: iso(p.actualizado) } : {}),
    });
  }

  for (const a of entrada.articulos) {
    if (a.borrador) continue;
    if (a.sector !== "" && !slugsDeSector.has(a.sector)) {
      problemas.push(
        `El artículo ${a.slug} tiene sector «${a.sector}», que no es un sector de web/src/lib/sectores.`
      );
    }
    const ruta = `/blog/${a.slug}`;
    const actualizado = a.actualizado ?? a.fecha;
    afirmaciones.push({
      clave: `pagina.blog.${a.slug}`,
      tipo: "pagina",
      texto: a.resumen === "" ? a.titulo : `${a.titulo}: ${a.resumen}`,
      valor: {
        ruta,
        url: `${URL_DEL_SITIO}${ruta}`,
        titulo: a.titulo,
        resumen: a.resumen,
        seccion: "blog",
        fecha: a.fecha,
        actualizado,
        autor: a.autor,
        sector: a.sector === "" ? null : a.sector,
        idioma: a.idioma ?? "es",
      },
      fuente: `web/content/blog/${a.slug}.mdx`,
      ...(a.sector !== "" ? { nichoSlug: a.sector } : {}),
    });
    registro.push({
      ruta,
      nombre: a.titulo.slice(0, 200),
      seccion: "blog",
      ...(a.sector !== "" ? { nichoSlug: a.sector } : {}),
      actualizado: iso(actualizado),
    });
  }
  return { afirmaciones, paginas: registro };
}

function prohibidas(
  entrada: EntradaDeConocimiento,
  problemas: string[]
): AfirmacionAEnviar[] {
  const parrafo = entrada.productMd.parrafos.find(
    (p) => p.seccion === SECCION_CAPACIDADES && p.grupo === GRUPO_TERMINOLOGIA
  );
  if (!parrafo) {
    problemas.push(
      "PRODUCT.md ya no tiene el párrafo «Terminología del producto»: no se puede comprobar que afirmaciones-prohibidas.md cubre la lista del repo."
    );
  } else {
    try {
      const { terminos, proveedores } = terminosNuncaDe(parrafo.texto);
      for (const termino of terminosSinCubrir(entrada.reglas, [
        ...terminos,
        ...proveedores,
      ])) {
        problemas.push(
          `PRODUCT.md prohíbe «${termino}» y ${FICHERO_REGLAS} no lo tiene ni en «Reglas aplicadas» ni en «Descartados»: añádelo a uno de los dos.`
        );
      }
    } catch (error) {
      problemas.push(error instanceof Error ? error.message : String(error));
    }
  }

  return entrada.reglas.reglas.map((r) => ({
    clave: `prohibida.${r.clave}`,
    tipo: "prohibida" as const,
    texto: `No se dice: ${r.terminos.join("; ")}. ${r.motivo}`,
    valor: {
      terminos: r.terminos,
      palabrasEnteras: r.palabrasEnteras,
      motivo: r.motivo,
      origen: r.fuente,
    },
    fuente: `${FICHERO_REGLAS}#${r.clave}`,
  }));
}

// ── Orquestación ─────────────────────────────────────────────────────────

/**
 * Los tipos de los que el extractor entrega la lista completa. Se mandan
 * siempre como `tipos`: lo que esté vigente de uno de ellos y no venga en
 * `afirmaciones` se cierra, y un tipo que llegue vacío es una avería que el
 * servidor rechaza (no un repo que lo haya borrado).
 */
export const TIPOS_QUE_CUBRE_EL_EXTRACTOR: readonly TipoDeAfirmacion[] = [
  "precio",
  "funcion",
  "limite",
  "sector",
  "comparativa",
  "pagina",
  "prohibida",
];

const FUENTE_DE_TIPO: Record<TipoDeAfirmacion, string> = {
  precio: FICHERO_PLANS,
  funcion: `${FICHERO_PLANS}, ${FICHERO_PLAN_FEATURES} y ${FICHERO_PRODUCT}`,
  limite: `${FICHERO_PRODUCT}, ${FICHERO_PLAN_FEATURES} y ${FICHERO_SECTORES}`,
  sector: FICHERO_SECTORES,
  comparativa: FICHERO_COMPARATIVAS,
  pagina: `${FICHERO_PAGINAS} y web/content/blog`,
  prohibida: FICHERO_REGLAS,
};

/** Un SHA que nunca existe: solo sirve para validar la forma del lote. */
const SHA_DE_PRUEBA = "0".repeat(40);

export function construirAfirmaciones(
  entrada: EntradaDeConocimiento
): ResultadoDeConstruccion {
  const problemas: string[] = [];
  const avisos: string[] = [];

  const enSectores = sectores(entrada, problemas);
  const enComparativas = comparativas(entrada.web, problemas);
  const enPaginas = paginas(entrada, problemas);
  contrastes(entrada, problemas);

  const afirmaciones: AfirmacionAEnviar[] = [
    ...precios(entrada.web, problemas),
    ...planes(entrada, problemas),
    ...desdeProduct(entrada.productMd, problemas, avisos),
    ...enSectores.afirmaciones,
    ...enComparativas.afirmaciones,
    ...enPaginas.afirmaciones,
    ...prohibidas(entrada, problemas),
  ].sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));

  // Claves únicas (el servidor también lo comprueba, pero aquí se explica mejor).
  const vistas = new Set<string>();
  for (const a of afirmaciones) {
    if (vistas.has(a.clave)) {
      problemas.push(`La clave ${a.clave} sale dos veces.`);
    }
    vistas.add(a.clave);
  }

  // Ningún texto afirma lo que la lista dice que no se dice.
  const infracciones = afirmacionesConTerminosProhibidos(
    afirmaciones,
    entrada.reglas.reglas.flatMap((r) =>
      r.terminos.map((termino) => ({
        termino,
        palabraEntera: r.palabrasEnteras,
      }))
    )
  );
  for (const infraccion of infracciones) {
    problemas.push(
      `El texto de ${infraccion.clave} usa un término prohibido (${infraccion.terminos.join(", ")}). Corrige el texto del mapa o quita el término de afirmaciones-prohibidas.md.`
    );
  }

  // Un tipo sin una sola afirmación es una avería del extractor (o un repo al
  // que le falta algo): como el servidor cerraría todo lo vigente de ese tipo,
  // se dice aquí, donde lo ve quien lo causó.
  for (const tipo of TIPOS_QUE_CUBRE_EL_EXTRACTOR) {
    if (!afirmaciones.some((a) => a.tipo === tipo)) {
      problemas.push(
        `El extractor no ha producido ninguna afirmación de tipo ${tipo}: la sincronización cerraría todas las vigentes de ese tipo. Revisa la fuente (${FUENTE_DE_TIPO[tipo]}).`
      );
    }
  }

  // Los de comparativas.ts, más los que el mapa declara a mano (HeyDiga,
  // fonio: sin comparativa propia, pero la regla dura 3 los conoce).
  const competidores = [...enComparativas.competidores];
  for (const extra of COMPETIDORES_ADICIONALES) {
    if (!competidores.some((c) => c.dominio === extra.dominio)) {
      competidores.push({ nombre: extra.nombre, dominio: extra.dominio });
    }
  }
  const nichos = enSectores.nichos;

  // Lo mismo que validará el servidor: nunca se manda algo que rechazaría.
  const forma = SincronizarBody.safeParse({
    commitSha: SHA_DE_PRUEBA,
    tipos: TIPOS_QUE_CUBRE_EL_EXTRACTOR,
    afirmaciones,
    competidores,
    nichos,
    paginas: enPaginas.paginas,
  });
  if (!forma.success) {
    for (const issue of forma.error.issues.slice(0, 15)) {
      const donde = issue.path.join(".");
      const afirmacion =
        issue.path[0] === "afirmaciones" && typeof issue.path[1] === "number"
          ? ` (${afirmaciones[issue.path[1] as number]?.clave})`
          : "";
      problemas.push(
        `Lo extraído no pasa el esquema del servidor en ${donde}${afirmacion}: ${issue.message}`
      );
    }
  }

  if (problemas.length > 0) throw new ErroresDeExtraccion(problemas);

  const fuentes = [
    ...new Set(afirmaciones.map((a) => a.fuente.split("#")[0])),
  ].sort();
  return {
    afirmaciones: afirmaciones as AfirmacionAEnviar[],
    tipos: [...TIPOS_QUE_CUBRE_EL_EXTRACTOR],
    competidores,
    nichos,
    paginas: enPaginas.paginas,
    avisos,
    fuentes: [
      ...new Set([
        ...fuentes,
        FICHERO_CATALOGO,
        FICHERO_PLAN_FEATURES,
        FICHERO_SECTORES,
      ]),
    ].sort(),
  };
}
