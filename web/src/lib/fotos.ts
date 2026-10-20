import type { ImagenDeCabecera } from "@/components/pagina-guia";

/**
 * Fotos de cabecera de las páginas de valor (lib/paginas.ts), todas de
 * Unsplash con licencia libre (comprobado el 2026-10-20: botón de descarga
 * gratuita, sin Unsplash+). Se piden ya recortadas a 1600×700 para que
 * `next/image` tenga las medidas reales. Sin logos de terceros a la vista:
 * la licencia de Unsplash no cubre marcas.
 */
function unsplash(id: string, alt: string, autor: string, usuario: string): ImagenDeCabecera {
  return {
    src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=700&q=80`,
    alt,
    ancho: 1600,
    alto: 700,
    credito: { autor, url: `https://unsplash.com/@${usuario}`, banco: "Unsplash" },
  };
}

export const FOTOS = {
  // Integraciones
  calendarioEnPantalla: unsplash("photo-1649433391719-2e784576d044", "Pantalla de ordenador con un calendario semanal abierto", "Ed Hardie", "edhardie"),
  calendarioEnOrdenador: unsplash("photo-1616530834117-9167fb0d8ebc", "Persona revisando un calendario en la pantalla del ordenador", "Gaining Visuals", "gainingvisuals"),
  portatilEnMesa: unsplash("photo-1593642634315-48f5414c3ad9", "Persona trabajando con un portátil sobre una mesa de madera", "Dell", "dell"),
  calendarioEnMovil: unsplash("photo-1632200011588-7c252c8c8fbf", "Teléfono móvil con el calendario abierto en la pantalla", "Behnam Norouzi", "behy_studio"),
  movilEnLaMano: unsplash("photo-1599950753894-d84cbcce4e95", "Mano sosteniendo un móvil con el calendario en la pantalla", "Priscilla Du Preez", "priscilladupreez"),
  // Desvío de llamadas
  hablandoPorTelefono: unsplash("photo-1503324010925-71cfe52dad2a", "Mujer hablando por el teléfono móvil", "Taylor Grote", "taylor_grote"),
  telefonoFijo: unsplash("photo-1523966211575-eb4a01e7dd51", "Teléfono fijo con cable sobre una mesa", "Alexander Andrews", "alex_andrews"),
  movilEnUso: unsplash("photo-1526045612212-70caf35c14df", "Persona usando un teléfono móvil, con la pantalla en primer plano", "freestocks", "freestocks"),
  movilJuntoAPortatil: unsplash("photo-1759156771079-6fef5b8d66c9", "Portátil, móvil y cuaderno sobre un escritorio de madera", "Jakub Żerdzicki", "jakubzerdzicki"),
  telefonoEnElSalon: unsplash("photo-1621255457330-7ef4e88ec27f", "Hombre hablando por teléfono frente a su portátil", "David Hahn", "hahn_david_com"),
  // Comparativas
  mostradorDeRecepcion: unsplash("photo-1470290378698-263fa7ca60ab", "Mostrador de recepción de madera junto a una pared blanca", "Kirill", "kirillz"),
  auricularesDeAtencion: unsplash("photo-1553775282-20af80779df7", "Auriculares de atención telefónica junto a un portátil", "Petr Macháček", "machec"),
  telefonoDeOficina: unsplash("photo-1587560699334-bea93391dcef", "Teléfono de oficina sobre una mesa de madera oscura", "Julian Hochgesang", "julianhochgesang"),
  oficinaConPortatilYTelefono: unsplash("photo-1663767117072-a97deef95956", "Mujer en su escritorio con el portátil y el teléfono", "Swello", "getswello"),
  // Herramientas
  calculadoraYPapel: unsplash("photo-1648201637025-1c77b9be3013", "Calculadora y bolígrafo sobre una hoja de papel", "Aaron Lefler", "alefler"),
  mensajeEnElMovil: unsplash("photo-1554672408-17407e0322ce", "Persona leyendo un mensaje en su teléfono móvil", "charlesdeluvio", "charlesdeluvio"),
  peluqueraConElMovil: unsplash("photo-1761373564177-8505a38c91f2", "Profesional de un salón mirando el teléfono móvil", "Planete Elevene", "planeteelevene"),
  sillaVacia: unsplash("photo-1761052180945-9fcefc9a07d5", "Una silla vacía en una sala bien iluminada", "Yingjie Wang", "maicjie"),
  // Guías
  documentosYCarpetas: unsplash("photo-1583521214690-73421a1829a9", "Pilas de documentos en papel y carpetas de archivo", "Wesley Tingey", "wesleyphotography"),
  bilbaoRia: unsplash("photo-1636556590144-7e3189066277", "Edificios junto a la ría de Bilbao", "David Vives", "davidvives"),
  santiagoCatedral: unsplash("photo-1662041516002-4f179df3b831", "Torres de la catedral de Santiago de Compostela entre los árboles", "Fernando Lazaro Diaz", "fernandolazarodiaz"),
  // Sectores sin datos de salud
  extensionesDePestanas: unsplash("photo-1589710751893-f9a6770ad71b", "Profesional aplicando extensiones de pestañas con pinzas en un salón", "Hayley Kim Studios", "hayleykimstudios"),
  pinzasYPestanas: unsplash("photo-1770999086860-143f54adf01b", "Pinzas apoyadas sobre una bandeja de pestañas", "Jessica Donnelly", "jessicadonnelly"),
  camillaConPiedras: unsplash("photo-1600334089648-b0d9d3028eb2", "Persona tumbada en una camilla de masaje con piedras calientes en la espalda", "engin akyurt", "enginakyurt"),
  masajeDeEspalda: unsplash("photo-1741522509438-a120c0bb5e88", "Masaje de relajación en la espalda", "Massage a Domicile", "massage_a_domicile"),
  perroEnLaPeluqueria: unsplash("photo-1719464454959-9cf304ef4774", "Perro pequeño blanco al que están cortando el pelo con tijeras", "Buddy AN", "stbuddyp"),
  cepillandoAUnPerro: unsplash("photo-1528846104175-4fd300ee59da", "Hombre cepillando el pelo de un perro", "Александр Гросс", "boney"),
  perroConToalla: unsplash("photo-1611173622933-91942d394b04", "Pomerania envuelto en una toalla rosa después del baño", "Hayffield L", "hayffield"),
} as const satisfies Record<string, ImagenDeCabecera>;

export type NombreDeFoto = keyof typeof FOTOS;
