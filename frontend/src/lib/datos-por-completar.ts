import type { BookingSettings, ModoDeDarPrecios } from "./types";

/**
 * El nombre que pone el alta a cada profesional («Profesional 1…N», en
 * app/bienvenida/team/page.tsx) mientras el dueño no escribe el de verdad.
 */
export const NOMBRE_PROVISIONAL = /^Profesional \d+$/;

/**
 * Lo que la recepcionista necesita y el alta deja a medias: profesionales
 * con el nombre provisional (sin el real no funciona «con Marta, por
 * favor») y servicios sin precio (si se lo preguntan, no puede darlo). Con
 * «Dar precios: nunca» el precio no se dice, así que no falta.
 */
export function datosPorCompletar(
  ajustes: Pick<BookingSettings, "professionals" | "services">,
  darPrecios?: ModoDeDarPrecios | null
) {
  return {
    profesionalesSinNombre: ajustes.professionals.filter(
      (profesional) => profesional.active && NOMBRE_PROVISIONAL.test(profesional.name.trim())
    ),
    serviciosSinPrecio:
      darPrecios === "nunca"
        ? []
        : ajustes.services.filter((servicio) => servicio.active && servicio.priceCents == null),
  };
}

/** «Profesional 1», «Profesional 2» y «Profesional 3»; con más de tres,
 * «Profesional 1», «Profesional 2» y 3 más. */
export function listaDeNombres(nombres: string[]) {
  const entrecomillados = nombres.map((nombre) => `«${nombre}»`);
  if (entrecomillados.length <= 1) return entrecomillados[0] ?? "";
  if (entrecomillados.length <= 3) {
    return `${entrecomillados.slice(0, -1).join(", ")} y ${entrecomillados[entrecomillados.length - 1]}`;
  }
  return `${entrecomillados.slice(0, 2).join(", ")} y ${entrecomillados.length - 2} más`;
}
