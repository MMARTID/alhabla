import type { Metadata } from "next";
import { VistaDeConocimiento } from "@/components/conocimiento/vista-de-conocimiento";

export const metadata: Metadata = { title: "Conocimiento" };

export default function Pagina() {
  return <VistaDeConocimiento />;
}
