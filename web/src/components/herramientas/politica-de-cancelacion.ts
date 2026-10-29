/**
 * Los textos de /herramientas/politica-de-cancelacion, sin React: los usan
 * el generador (cliente), la tabla de ejemplos de la página (servidor) y los
 * tests. Va aparte porque lo que exporta un fichero "use client" no se
 * puede leer desde un componente de servidor.
 *
 * Dos decisiones legales van ya dentro del texto (las explica la página):
 * - la señal es una parte del precio y se devuelve si se anula a tiempo: el
 *   TRLGDCU tiene por abusiva la «indemnización desproporcionadamente alta»
 *   al consumidor que no cumple (art. 85.6);
 * - si quien anula es el negocio, la cláusula recíproca viene marcada: es
 *   abusivo retener lo pagado por el consumidor que renuncia «sin contemplar
 *   la indemnización por una cantidad equivalente si renuncia el
 *   empresario» (art. 87.2).
 */

export type Ausencias = "aviso" | "senal" | "dejar";
export type TipoSenal = "no" | "fija" | "porcentaje";
export type Ambito = "todas" | "largos" | "nuevos";

export type Politica = {
  negocio: string;
  telefono: string;
  antelacion: number;
  senal: TipoSenal;
  cantidad: string;
  ambito: Ambito;
  minutosLargos: string;
  reciproca: boolean;
  ausencias: Ausencias;
  maxAusencias: string;
  retraso: string;
  porWhatsapp: boolean;
  porTelefono: boolean;
  enElLocal: boolean;
};

export const POLITICA_POR_DEFECTO: Politica = {
  negocio: "",
  telefono: "",
  antelacion: 24,
  senal: "no",
  cantidad: "10",
  ambito: "todas",
  minutosLargos: "90",
  reciproca: true,
  ausencias: "aviso",
  maxAusencias: "2",
  retraso: "10",
  porWhatsapp: true,
  porTelefono: true,
  enElLocal: false,
};

/** Los ejemplos por sector de la página: el generador puede partir de uno. */
export const EJEMPLOS_DE_POLITICA: readonly { id: string; nombre: string; valores: Partial<Politica>; porQue: string }[] = [
  {
    id: "peluqueria",
    nombre: "Peluquería",
    valores: { antelacion: 24, senal: "porcentaje", cantidad: "20", ambito: "largos", minutosLargos: "90", ausencias: "senal" },
    porQue: "Un color o unas mechas ocupan media tarde: la señal solo en los servicios largos, que son los que duelen.",
  },
  {
    id: "barberia",
    nombre: "Barbería",
    valores: { antelacion: 4, senal: "no", ausencias: "dejar", maxAusencias: "3", retraso: "10" },
    porQue: "Citas cortas que se recolocan rápido: plazo corto, sin señal, y un límite para quien falla una y otra vez.",
  },
  {
    id: "unas",
    nombre: "Salón de uñas",
    valores: { antelacion: 24, senal: "no", ausencias: "senal", cantidad: "10", retraso: "15" },
    porQue: "Clientela que repite cada pocas semanas: confianza por defecto y señal solo para quien ya ha faltado.",
  },
  {
    id: "estetica",
    nombre: "Centro de estética",
    valores: { antelacion: 24, senal: "fija", cantidad: "15", ambito: "nuevos", ausencias: "senal" },
    porQue: "La primera visita es la que más falla y la que más cabina ocupa: señal en la primera cita.",
  },
  {
    id: "fisioterapia",
    nombre: "Fisioterapia",
    valores: { antelacion: 24, senal: "no", ausencias: "aviso", retraso: "0" },
    porQue: "Pacientes con tratamientos en curso: avisar y hablarlo funciona mejor que penalizar.",
  },
  {
    id: "pestanas",
    nombre: "Pestañas y cejas",
    valores: { antelacion: 48, senal: "fija", cantidad: "15", ambito: "nuevos", ausencias: "senal", retraso: "15" },
    porQue: "Un juego completo es mucho rato de una sola profesional: más plazo, y señal para quien no conoces.",
  },
  {
    id: "spa",
    nombre: "Spa y masajes",
    valores: { antelacion: 48, senal: "porcentaje", cantidad: "30", ambito: "todas", ausencias: "senal", retraso: "15" },
    porQue: "Cabinas y circuitos con hora cerrada y muchas reservas de regalo: señal en todas y 48 horas de plazo.",
  },
  {
    id: "canina",
    nombre: "Peluquería canina",
    valores: { antelacion: 24, senal: "no", ausencias: "dejar", maxAusencias: "2", retraso: "15" },
    porQue: "Un perro grande puede ocupar la mañana: sin señal, pero con un límite claro de veces sin venir.",
  },
];

export const ANTELACIONES = [4, 12, 24, 48, 72] as const;

function entero(texto: string, porDefecto: number) {
  const n = Math.round(Number(texto.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

function listaConO(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} o ${partes[partes.length - 1]}`;
}

export function generarPolitica(p: Politica) {
  const plazo = `${p.antelacion} horas`;
  const telefono = p.telefono.trim();
  const negocio = p.negocio.trim();
  const cantidad = entero(p.cantidad, 10);
  const conSenal = p.senal !== "no";
  // «una señal de 10 €» / «una señal del 20 % del precio».
  const senalDe = p.senal === "fija" ? `de ${cantidad} €` : `del ${cantidad} % del precio`;
  const ambito =
    p.ambito === "largos"
      ? `en los servicios de más de ${entero(p.minutosLargos, 90)} minutos`
      : p.ambito === "nuevos"
        ? "en la primera cita"
        : "para reservar";
  const retraso = entero(p.retraso, 0);
  const maxAusencias = entero(p.maxAusencias, 2);

  const canales = [
    p.porWhatsapp ? "respondiendo al WhatsApp de confirmación" : null,
    p.porTelefono ? (telefono ? `llamando al ${telefono}` : "llamándonos") : null,
    p.enElLocal ? "en el mostrador" : null,
  ].filter((c): c is string => c !== null);
  const como = listaConO(canales.length ? canales : ["llamándonos"]);
  // El cartel habla en imperativo («responde», «llama»), la web en gerundio.
  const canalesDelCartel = [
    p.porWhatsapp ? "responde al WhatsApp de confirmación" : null,
    p.porTelefono ? (telefono ? `llama al ${telefono}` : "llámanos") : null,
    p.enElLocal ? "díselo en el mostrador" : null,
  ].filter((c): c is string => c !== null);
  const comoEnElCartel = listaConO(canalesDelCartel.length ? canalesDelCartel : ["llámanos"]);

  const frases = {
    plazo: `Puedes cambiar o anular tu cita sin ningún coste hasta ${plazo} antes. Avísanos ${como}.`,
    senal: conSenal
      ? `Pedimos una señal ${senalDe} ${ambito}. Se descuenta del precio del servicio. Si anulas con más de ${plazo} de antelación, te la devolvemos; si anulas más tarde o no vienes, no se devuelve.`
      : null,
    ausencias:
      p.ausencias === "aviso"
        ? "Si faltas a una cita sin avisar, te escribiremos para recordarte esta política. Entendemos que a veces pasa; lo que pedimos es que nos avises."
        : p.ausencias === "senal" && conSenal && p.ambito === "todas"
          ? "Si faltas a una cita sin avisar, la señal no se devuelve."
          : p.ausencias === "senal"
            ? `Si faltas a una cita sin avisar, para reservar la siguiente te pediremos una señal${conSenal ? ` ${senalDe}` : ""}, que se descuenta del servicio.`
          : `Si faltas sin avisar ${maxAusencias === 1 ? "a una cita" : `a ${maxAusencias} citas`}, no podremos darte más citas.`,
    retraso:
      retraso > 0
        ? `Si llegas más de ${retraso} minutos tarde, puede que tengamos que acortar el servicio o darte otra hora, para no retrasar a quien viene después.`
        : null,
    reciproca: conSenal
      ? p.reciproca
        ? "Si somos nosotros quienes anulamos la cita, te devolvemos la señal y te compensamos con la misma cantidad."
        : "Si somos nosotros quienes anulamos la cita, te devolvemos la señal entera."
      : null,
  };

  const cartel = [
    "CANCELACIONES Y CITAS SIN AVISAR",
    "",
    `· Avísanos con al menos ${plazo} de antelación si no puedes venir. Cambiar o anular con ese margen no cuesta nada.`,
    conSenal ? `· Señal ${senalDe} ${ambito}. No se devuelve si anulas tarde o no vienes.` : null,
    `· ${frases.ausencias.split(". ")[0].replace(/\.$/, "")}.`,
    frases.retraso ? `· Más de ${retraso} minutos tarde: puede que tengamos que acortar el servicio.` : null,
    `· Para avisar: ${comoEnElCartel}.`,
    "",
    "Gracias: un hueco avisado es una cita para otra persona.",
  ]
    .filter((linea): linea is string => linea !== null)
    .join("\n");

  const web = [
    `Política de cancelación${negocio ? ` de ${negocio}` : ""}`,
    "",
    "Cambiar o anular una cita",
    frases.plazo,
    ...(frases.senal ? ["", "Señal", frases.senal] : []),
    "",
    "Si no vienes",
    frases.ausencias,
    ...(frases.retraso ? ["", "Si llegas tarde", frases.retraso] : []),
    ...(frases.reciproca ? ["", "Si anulamos nosotros", frases.reciproca] : []),
    "",
    "Esta política se aplica a todas las citas. La tienes también en el local y al final del mensaje de confirmación de cada cita.",
  ].join("\n");

  const comoEnLaConfirmacion = p.porWhatsapp ? "respondiendo a este mensaje" : como;
  const confirmacion = conSenal
    ? `Si no puedes venir, avísanos con ${plazo} de antelación ${comoEnLaConfirmacion}: la señal solo se pierde si anulas más tarde o no vienes.`
    : `Si no puedes venir, avísanos con ${plazo} de antelación ${comoEnLaConfirmacion}, y le damos tu hora a otra persona.`;

  return { cartel, web, confirmacion };
}
