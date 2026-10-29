import type { ReactNode } from "react";

/**
 * Un bloque de «Las preguntas de la dueña»: la pregunta como titular, la
 * respuesta en dos líneas y, al lado, la pieza de producto que lo demuestra.
 * `prueba` alterna de lado de un bloque al siguiente para dar ritmo; en el
 * móvil va siempre debajo de la respuesta; desde `lg`, la pregunta se queda
 * fija mientras se lee la prueba. `pie` va debajo, a todo el ancho.
 */
export function Pregunta({
  id,
  pregunta,
  respuesta,
  prueba,
  lado,
  primera = false,
  children,
  pie,
}: {
  id?: string;
  pregunta: string;
  respuesta: string;
  prueba: ReactNode;
  /** Dónde va la prueba desde `lg`. */
  lado: "izquierda" | "derecha";
  /** La que va pegada al hero: menos aire arriba, para que asome en la
   * primera pantalla. */
  primera?: boolean;
  /** Lo que va bajo la respuesta (la regla de confianza, un enlace). */
  children?: ReactNode;
  /** Lo que cierra el bloque a todo el ancho (el reparto del oficio). */
  pie?: ReactNode;
}) {
  const tituloId = id ? `${id}-titulo` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={tituloId}
      className={`scroll-m-20 pb-14 sm:pb-20 lg:pb-24 ${
        primera ? "pt-2 sm:pt-4" : "pt-14 sm:pt-20 lg:pt-24"
      }`}
    >
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div
          className={
            lado === "izquierda"
              ? "lg:sticky lg:top-28 lg:col-span-5 lg:col-start-8 lg:row-start-1"
              : "lg:sticky lg:top-28 lg:col-span-5"
          }
        >
          <h2
            id={tituloId}
            className="text-balance text-3xl font-black leading-[1.1] tracking-[-0.02em] text-tinta sm:text-4xl"
          >
            {pregunta}
          </h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-apagado">
            {respuesta}
          </p>
          {children}
        </div>
        <div
          className={
            lado === "izquierda"
              ? "lg:col-span-7 lg:col-start-1 lg:row-start-1"
              : "lg:col-span-7"
          }
        >
          {prueba}
        </div>
        {pie ? (
          <div className="lg:col-span-12 lg:row-start-2">{pie}</div>
        ) : null}
      </div>
    </section>
  );
}
