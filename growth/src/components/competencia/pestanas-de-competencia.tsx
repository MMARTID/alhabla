import Link from "next/link";

const PESTANAS = [
  { href: "/competencia", etiqueta: "Competidores" },
  { href: "/competencia/comparador", etiqueta: "Comparador" },
] as const;

/**
 * Las dos pestañas de la Competencia: la lista de competidores y el
 * comparador de precios. Son rutas distintas (enlaces, no un `tablist`): la
 * pestaña activa lleva `aria-current="page"`.
 */
export function PestanasDeCompetencia({
  activa,
}: {
  activa: (typeof PESTANAS)[number]["href"];
}) {
  return (
    <nav aria-label="Secciones de Competencia" className="mb-5 flex gap-2">
      {PESTANAS.map((pestana) => {
        const esActiva = pestana.href === activa;
        return (
          <Link
            key={pestana.href}
            href={pestana.href}
            aria-current={esActiva ? "page" : undefined}
            className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
              esActiva
                ? "border-lavado-borde bg-lavado text-morado-tinta"
                : "border-linea bg-superficie text-apagado hover:bg-relleno hover:text-tinta"
            }`}
          >
            {pestana.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
