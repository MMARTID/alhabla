import type { Metadata } from "next";
import { VistaDeBandeja } from "@/components/bandeja/vista-de-bandeja";

export const metadata: Metadata = { title: "Bandeja" };

export default function Pagina() {
  return <VistaDeBandeja />;
}
