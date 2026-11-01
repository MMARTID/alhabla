"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LogOut, Sprout } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SelectorDeTema } from "@/components/selector-de-tema";
import { useCerrarSesion } from "@/lib/cerrar-sesion";
import { useYo } from "@/lib/consultas";
import {
  DESTINOS,
  DESTINOS_DE_LA_BARRA,
  DESTINOS_DE_MAS,
  estaActivo,
  type Destino,
} from "@/lib/navegacion";
import { esModoDemo } from "@/lib/modo-demo";
import { useSesion } from "@/lib/sesion";

/** El correo de la sesión: el del token, o el que confirma `GET /yo`. */
function useCorreo(): string | null {
  const sesion = useSesion();
  const deLaSesion =
    sesion.estado === "activa" || sesion.estado === "caducada"
      ? sesion.email
      : null;
  // La misma clave que usa PuertaDeSesion: sale de la caché, sin otra petición.
  const yo = useYo(deLaSesion, esModoDemo() || deLaSesion !== null);
  return yo.data?.email ?? deLaSesion;
}

function EnlaceLateral({
  destino,
  pathname,
}: {
  destino: Destino;
  pathname: string;
}) {
  const Icono = destino.icono;
  const activo = estaActivo(pathname, destino);
  return (
    <Link
      href={destino.href}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-full border px-3.5 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
        activo
          ? "border-lavado-borde bg-lavado text-morado-tinta"
          : "border-transparent text-tinta-3 hover:bg-relleno hover:text-tinta"
      }`}
    >
      <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
      {destino.etiqueta}
    </Link>
  );
}

function CerrarSesion({ className = "" }: { className?: string }) {
  const cerrar = useCerrarSesion();
  // La demostración no tiene sesión que cerrar.
  if (esModoDemo()) return null;
  return (
    <button
      type="button"
      onClick={cerrar}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-full border border-transparent px-3.5 text-sm font-semibold text-tinta-3 transition duration-150 hover:bg-relleno hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${className}`}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      Cerrar sesión
    </button>
  );
}

/** Barra lateral del escritorio (desde `lg`). */
function BarraLateral({
  pathname,
  correo,
}: {
  pathname: string;
  correo: string | null;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-linea bg-superficie px-3 py-5 lg:flex">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavado text-morado">
          <Sprout className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-tinta">
            Alhabla Growth
          </p>
          <p className="text-xs text-muted">Panel interno</p>
        </div>
      </div>
      <nav aria-label="Principal" className="space-y-1">
        {DESTINOS.map((destino) => (
          <EnlaceLateral
            key={destino.href}
            destino={destino}
            pathname={pathname}
          />
        ))}
      </nav>
      <div className="mt-auto space-y-3 border-t border-linea pt-4">
        {correo ? (
          <p className="truncate px-2 text-xs text-muted" title={correo}>
            {correo}
          </p>
        ) : null}
        <SelectorDeTema compacto />
        <CerrarSesion />
      </div>
    </aside>
  );
}

/**
 * La barra inferior del móvil (bajo `lg`): cuatro pestañas y «Más», que
 * agrupa Competencia, Tareas, Ejecuciones, Ajustes, la apariencia y cerrar sesión.
 */
function BarraDePestanas({
  pathname,
  correo,
}: {
  pathname: string;
  correo: string | null;
}) {
  // El menú «Más» está abierto solo en la ruta donde se abrió: al navegar se
  // cierra sin necesidad de un efecto.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbiertoEn(null);
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  const masActivo = DESTINOS_DE_MAS.some((destino) =>
    estaActivo(pathname, destino)
  );

  return (
    <>
      {abierto ? (
        <>
          <button
            type="button"
            aria-label="Cerrar el menú"
            className="fixed inset-0 z-40 cursor-default bg-transparent lg:hidden"
            onClick={() => setAbiertoEn(null)}
          />
          <div
            id="menu-mas"
            className="panel fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-[65] w-72 max-w-[calc(100vw-1.5rem)] bg-elevada p-3 shadow-lg lg:hidden"
          >
            <div className="space-y-1">
              {DESTINOS_DE_MAS.map((destino) => (
                <EnlaceLateral
                  key={destino.href}
                  destino={destino}
                  pathname={pathname}
                />
              ))}
            </div>
            <div className="mt-3 space-y-3 border-t border-linea pt-3">
              {correo ? (
                <p className="truncate px-1 text-xs text-muted" title={correo}>
                  {correo}
                </p>
              ) : null}
              <SelectorDeTema compacto />
              <CerrarSesion />
            </div>
          </div>
        </>
      ) : null}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-linea bg-superficie/95 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-[14px] lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-0.5">
          {DESTINOS_DE_LA_BARRA.map((destino) => {
            const activo = estaActivo(pathname, destino);
            const Icono = destino.icono;
            return (
              <Link
                key={destino.href}
                href={destino.href}
                aria-current={activo ? "page" : undefined}
                className={`flex min-h-[49px] min-w-0 flex-col items-center gap-[3px] rounded-2xl pt-1 text-[10px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
                  activo ? "text-morado-tinta" : "text-apagado"
                }`}
              >
                <Pastilla activa={activo}>
                  <Icono className="h-[22px] w-[22px]" aria-hidden="true" />
                </Pastilla>
                <span className="max-w-full truncate">{destino.etiqueta}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls="menu-mas"
            onClick={() => setAbiertoEn(abierto ? null : pathname)}
            className={`flex min-h-[49px] min-w-0 flex-col items-center gap-[3px] rounded-2xl pt-1 text-[10px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
              masActivo || abierto ? "text-morado-tinta" : "text-apagado"
            }`}
          >
            <Pastilla activa={masActivo || abierto}>
              <Ellipsis className="h-[22px] w-[22px]" aria-hidden="true" />
            </Pastilla>
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Pastilla({
  activa,
  children,
}: {
  activa: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`relative flex h-[30px] w-14 items-center justify-center rounded-full transition-colors duration-200 ${
        activa ? "bg-lavado ring-1 ring-inset ring-lavado-borde" : ""
      }`}
    >
      {children}
    </span>
  );
}

/**
 * El marco del panel: navegación lateral en el escritorio, barra inferior en
 * el móvil y un contenedor de ancho máximo. Las vistas solo pintan su
 * contenido (empezando por un `EncabezadoDePagina`).
 */
export function PanelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const correo = useCorreo();
  return (
    <div className="min-h-screen bg-lienzo">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-[10px] focus:bg-tinta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sobre-tinta"
      >
        Saltar al contenido
      </a>
      <BarraLateral pathname={pathname} correo={correo} />
      <div className="lg:pl-60">
        <main
          id="contenido"
          className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8"
        >
          {children}
        </main>
      </div>
      <BarraDePestanas pathname={pathname} correo={correo} />
    </div>
  );
}
