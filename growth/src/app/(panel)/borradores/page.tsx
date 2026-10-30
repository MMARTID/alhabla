import type { Metadata } from "next";
import { VistaDeBorradores } from "@/components/borradores/vista-de-borradores";

export const metadata: Metadata = { title: "Borradores" };

export default function Pagina() {
  return <VistaDeBorradores />;
}
