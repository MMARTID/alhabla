/**
 * Versión vigente del contrato de encargado del tratamiento (DPA, art. 28
 * RGPD) que cada negocio acepta al registrarse. Es la misma que publica la web
 * en `web/src/lib/dpa.ts` (página `/legal/dpa`): si cambia el texto, se sube
 * en los dos sitios a la vez. El registro por correo manda la versión que el
 * usuario vio y se rechaza si no coincide, para que un desfase entre las dos
 * webs salte en vez de guardar una aceptación de un texto que no leyó.
 */
export const DPA_VERSION = "1.0";
