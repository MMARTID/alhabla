import type { SectorSlug } from "@/lib/sectores/tipos";

/**
 * Enlaces internos entre los artículos del blog y desde las landings de
 * sector (2026-11-01). Search Console dejaba 15 de los 18 artículos sin
 * rastrear («Descubierta: actualmente sin indexar»): los tres que sí estaban
 * indexados recibían 16–20 enlaces internos y los otros 15, entre 1 y 5,
 * porque «Sigue leyendo» daba a todos los artículos los mismos tres (los más
 * recientes) y las landings de sector ya no enlazaban ninguno desde el 29-10.
 *
 * Son listas escritas a mano, con el tema por delante de la fecha: lo que
 * sigue leyendo quien acaba un artículo, y las tres guías que le sirven a un
 * oficio. tests/lib/blog-enlaces.test.ts vigila que los slugs existan, que no
 * haya repetidos ni enlaces a sí mismo y que cada artículo de la lista reciba
 * al menos `MINIMO_DE_ENLACES_ENTRANTES` enlaces de otros artículos. Un
 * artículo nuevo que no esté aquí no rompe nada ni hace falta tocar esto para
 * publicarlo: `articulosRelacionados` rellena con su sector y con los más
 * recientes (lib/blog.ts). Para que además lo enlacen sus vecinos, se añade
 * aquí a mano.
 */

/** Enlaces que debe recibir cada artículo desde otros artículos. */
export const MINIMO_DE_ENLACES_ENTRANTES = 3;

/** Cuántos artículos enseña «Sigue leyendo». */
export const ENLACES_DE_SIGUE_LEYENDO = 4;

/** «Sigue leyendo» de cada artículo: cuatro, por tema y de más a menos cercano. */
export const SIGUE_LEYENDO: Readonly<Record<string, readonly string[]>> = {
  "mensajes-automaticos-whatsapp-business": [
    "whatsapp-business-para-citas",
    "recordatorios-de-citas-por-whatsapp",
    "whatsapp-business-o-whatsapp-normal",
    "quitar-contestador-movil",
  ],
  "quitar-contestador-movil": [
    "desvio-de-llamadas-si-no-contesta",
    "desviar-llamadas-sin-cambiar-de-numero",
    "contestador-automatico-vs-recepcionista-virtual",
    "mensajes-automaticos-whatsapp-business",
  ],
  "cuanto-cuesta-una-recepcionista-en-espana": [
    "cuanto-cuesta-una-recepcionista-de-ia",
    "que-hace-una-recepcionista-virtual",
    "reservas-fuera-de-horario",
    "baja-de-un-trabajador-reorganizar-agenda",
  ],
  "agenda-para-spa": [
    "cabinas-y-profesionales-centro-de-estetica",
    "recordatorios-de-citas-por-whatsapp",
    "baja-de-un-trabajador-reorganizar-agenda",
    "citas-recurrentes-salon-de-unas",
  ],
  "baja-de-un-trabajador-reorganizar-agenda": [
    "cabinas-y-profesionales-centro-de-estetica",
    "cambiar-cita-por-whatsapp-peluqueria",
    "cuanto-cuesta-una-recepcionista-en-espana",
    "agenda-para-spa",
  ],
  "cabinas-y-profesionales-centro-de-estetica": [
    "agenda-para-spa",
    "baja-de-un-trabajador-reorganizar-agenda",
    "citas-recurrentes-salon-de-unas",
    "lista-de-espera-huecos-libres",
  ],
  "cambiar-cita-por-whatsapp-peluqueria": [
    "recordatorios-de-citas-por-whatsapp",
    "whatsapp-business-para-citas",
    "lista-de-espera-huecos-libres",
    "baja-de-un-trabajador-reorganizar-agenda",
  ],
  "citas-recurrentes-salon-de-unas": [
    "recordatorios-de-citas-por-whatsapp",
    "cabinas-y-profesionales-centro-de-estetica",
    "agenda-para-spa",
    "lista-de-espera-huecos-libres",
  ],
  "contestador-automatico-vs-recepcionista-virtual": [
    "que-hace-una-recepcionista-virtual",
    "cuanto-cuesta-una-recepcionista-de-ia",
    "quitar-contestador-movil",
    "cuantas-llamadas-pierde-una-peluqueria",
  ],
  "cuantas-llamadas-pierde-una-barberia": [
    "cuantas-llamadas-pierde-una-peluqueria",
    "reservas-fuera-de-horario",
    "desvio-de-llamadas-si-no-contesta",
    "desviar-llamadas-sin-cambiar-de-numero",
  ],
  "cuantas-llamadas-pierde-una-peluqueria": [
    "cuantas-llamadas-pierde-una-barberia",
    "reservas-fuera-de-horario",
    "desvio-de-llamadas-si-no-contesta",
    "contestador-automatico-vs-recepcionista-virtual",
  ],
  "cuanto-cuesta-una-recepcionista-de-ia": [
    "cuanto-cuesta-una-recepcionista-en-espana",
    "contestador-automatico-vs-recepcionista-virtual",
    "ia-que-contesta-llamadas",
    "desvio-de-llamadas-si-no-contesta",
  ],
  "desviar-llamadas-sin-cambiar-de-numero": [
    "desvio-de-llamadas-si-no-contesta",
    "ia-que-contesta-llamadas",
    "cuantas-llamadas-pierde-una-peluqueria",
    "que-hace-una-recepcionista-virtual",
  ],
  "desvio-de-llamadas-si-no-contesta": [
    "desviar-llamadas-sin-cambiar-de-numero",
    "quitar-contestador-movil",
    "cuanto-cuesta-una-recepcionista-de-ia",
    "cuantas-llamadas-pierde-una-barberia",
  ],
  "ia-que-contesta-llamadas": [
    "que-hace-una-recepcionista-virtual",
    "chatbot-ia-whatsapp-business",
    "contestador-automatico-vs-recepcionista-virtual",
    "recepcionista-virtual-para-fisioterapia",
  ],
  "lista-de-espera-huecos-libres": [
    "cambiar-cita-por-whatsapp-peluqueria",
    "recordatorios-de-citas-por-whatsapp",
    "baja-de-un-trabajador-reorganizar-agenda",
    "recepcionista-virtual-para-fisioterapia",
  ],
  "que-hace-una-recepcionista-virtual": [
    "cuanto-cuesta-una-recepcionista-de-ia",
    "contestador-automatico-vs-recepcionista-virtual",
    "recepcionista-virtual-para-fisioterapia",
    "chatbot-ia-whatsapp-business",
  ],
  "recepcionista-virtual-para-fisioterapia": [
    "que-hace-una-recepcionista-virtual",
    "recordatorios-de-citas-por-whatsapp",
    "reservas-fuera-de-horario",
    "lista-de-espera-huecos-libres",
  ],
  "recordatorios-de-citas-por-whatsapp": [
    "whatsapp-business-para-citas",
    "cambiar-cita-por-whatsapp-peluqueria",
    "citas-recurrentes-salon-de-unas",
    "whatsapp-business-google-calendar",
  ],
  "reservas-fuera-de-horario": [
    "ia-que-contesta-llamadas",
    "whatsapp-business-para-citas",
    "cuantas-llamadas-pierde-una-barberia",
    "cuanto-cuesta-una-recepcionista-en-espana",
  ],
  "whatsapp-business-para-citas": [
    "recordatorios-de-citas-por-whatsapp",
    "whatsapp-business-google-calendar",
    "whatsapp-business-o-whatsapp-normal",
    "mensajes-automaticos-whatsapp-business",
  ],
  "whatsapp-business-o-whatsapp-normal": [
    "mensajes-automaticos-whatsapp-business",
    "whatsapp-business-para-citas",
    "chatbot-ia-whatsapp-business",
    "whatsapp-business-google-calendar",
  ],
  "chatbot-ia-whatsapp-business": [
    "whatsapp-business-o-whatsapp-normal",
    "ia-que-contesta-llamadas",
    "whatsapp-business-google-calendar",
    "que-hace-una-recepcionista-virtual",
  ],
  "whatsapp-business-google-calendar": [
    "whatsapp-business-para-citas",
    "recordatorios-de-citas-por-whatsapp",
    "chatbot-ia-whatsapp-business",
    "whatsapp-business-o-whatsapp-normal",
  ],
};

/**
 * Las tres guías de la landing de cada sector: las de su oficio primero y
 * después las que mejor le sirven. Entre los ocho, todos los artículos
 * salen al menos una vez salvo el de precios, que ya enlazan los demás
 * artículos y no hace falta empujar desde una landing.
 */
export const GUIAS_POR_SECTOR: Readonly<Record<SectorSlug, readonly string[]>> = {
  peluqueria: [
    "cuantas-llamadas-pierde-una-peluqueria",
    "cambiar-cita-por-whatsapp-peluqueria",
    "baja-de-un-trabajador-reorganizar-agenda",
  ],
  barberia: [
    "cuantas-llamadas-pierde-una-barberia",
    "reservas-fuera-de-horario",
    "lista-de-espera-huecos-libres",
  ],
  "centro-de-estetica": [
    "cabinas-y-profesionales-centro-de-estetica",
    "recordatorios-de-citas-por-whatsapp",
    "whatsapp-business-google-calendar",
  ],
  "salon-de-unas": [
    "citas-recurrentes-salon-de-unas",
    "whatsapp-business-para-citas",
    "chatbot-ia-whatsapp-business",
  ],
  fisioterapia: [
    "recepcionista-virtual-para-fisioterapia",
    "ia-que-contesta-llamadas",
    "cuanto-cuesta-una-recepcionista-en-espana",
  ],
  "pestanas-y-cejas": [
    "citas-recurrentes-salon-de-unas",
    "que-hace-una-recepcionista-virtual",
    "mensajes-automaticos-whatsapp-business",
  ],
  "spa-y-masajes": [
    "agenda-para-spa",
    "desvio-de-llamadas-si-no-contesta",
    "contestador-automatico-vs-recepcionista-virtual",
  ],
  "peluqueria-canina": [
    "quitar-contestador-movil",
    "desviar-llamadas-sin-cambiar-de-numero",
    "whatsapp-business-o-whatsapp-normal",
  ],
};
