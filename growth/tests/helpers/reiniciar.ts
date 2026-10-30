import { reiniciarGisParaPruebas } from "@/lib/gis";
import { reiniciarSesionParaPruebas } from "@/lib/sesion";

/** Deja la sesión, GIS y el navegador falso como recién abiertos. */
export function reiniciarTodo() {
  reiniciarSesionParaPruebas();
  reiniciarGisParaPruebas();
  try {
    window.sessionStorage.clear();
  } catch {
    // sessionStorage de un test que lo rompió a propósito.
  }
  delete window.google;
  document.head
    .querySelectorAll('script[src*="accounts.google.com"]')
    .forEach((s) => s.remove());
}
