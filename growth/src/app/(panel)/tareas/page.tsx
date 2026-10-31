import type { Metadata } from "next";
import { VistaDeTareas } from "@/components/tareas/vista-de-tareas";

export const metadata: Metadata = { title: "Tareas" };

export default function Pagina() {
  return <VistaDeTareas />;
}
