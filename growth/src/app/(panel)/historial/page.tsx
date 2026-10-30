import type { Metadata } from "next";
import { VistaDeHistorial } from "@/components/historial/vista-de-historial";

export const metadata: Metadata = { title: "Historial" };

export default function Pagina() {
  return <VistaDeHistorial />;
}
