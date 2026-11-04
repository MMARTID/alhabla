/**
 * El crédito del modelo del portátil 3D, aparte de `portatil-3d.ts` a
 * propósito: aquel fichero importa three.js, y los componentes de la portada
 * que solo enseñan el crédito (`en-tu-negocio.tsx`, `gestor-simulacion.tsx`)
 * metían así ~170 KB de three.js en el JS inicial de la portada y de las
 * landings de sector aunque la escena se cargue con `import()` más tarde
 * (medido el 2026-11-04). Este fichero no puede importar three.
 *
 * El modelo (`public/modelos/macbook.glb`, «macbook pro M3 16 inch 2024» de
 * jackbaeten, CC BY 4.0): el crédito en la página es obligatorio.
 */
export const MODELO = {
  titulo: "macbook pro M3 16 inch 2024",
  origen:
    "https://sketchfab.com/3d-models/macbook-pro-m3-16-inch-2024-8e34fc2b303144f78490007d91ff57c4",
  autor: "https://sketchfab.com/jackbaeten",
  licencia: "https://creativecommons.org/licenses/by/4.0/",
} as const;
