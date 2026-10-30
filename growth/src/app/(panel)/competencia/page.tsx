import type { Metadata } from "next";
import { VistaDeCompetencia } from "@/components/competencia/vista-de-competencia";

export const metadata: Metadata = { title: "Competencia" };

export default function Pagina() {
  return <VistaDeCompetencia />;
}
