import type { Metadata } from "next";
import { VistaDeAjustes } from "@/components/ajustes/vista-de-ajustes";

export const metadata: Metadata = { title: "Ajustes" };

export default function Pagina() {
  return <VistaDeAjustes />;
}
