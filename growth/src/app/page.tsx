import { redirect } from "next/navigation";

// La bandeja es la portada del panel. Sin ruta /login: el inicio de sesión es
// la propia puerta que envuelve el panel (components/puerta-de-sesion.tsx).
export default function Inicio() {
  redirect("/bandeja");
}
