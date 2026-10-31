import type { Metadata } from "next";
import { VistaDelComparador } from "@/components/competencia/vista-del-comparador";

export const metadata: Metadata = { title: "Comparador de precios" };

export default function Pagina() {
  return <VistaDelComparador />;
}
