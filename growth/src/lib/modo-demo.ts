/**
 * ¿Está activo el modo demostración? Solo en desarrollo y con
 * `NEXT_PUBLIC_GROWTH_DEMO=1` (`npm run dev:demo`).
 *
 * Este helper sirve para lo que NO importa código de la demostración (la
 * franja de aviso, esconder «Cerrar sesión», leer `?vacio=1`). Los dos
 * puntos que sí lo importan (`crearCliente` en src/lib/cliente-http.ts y
 * src/components/puerta-de-sesion.tsx) escriben la condición a mano, para que
 * el compilador elimine el bloque entero, importación incluida, en producción.
 */
export function esModoDemo(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_GROWTH_DEMO === "1"
  );
}

/** Correo de la sesión simulada de la demostración. */
export const CORREO_DE_DEMOSTRACION = "demo@alhabla.ai";
