import type { Metadata } from "next";
import { VistaDeEjecuciones } from "@/components/ejecuciones/vista-de-ejecuciones";

export const metadata: Metadata = { title: "Ejecuciones" };

export default function Pagina() {
  return <VistaDeEjecuciones />;
}
