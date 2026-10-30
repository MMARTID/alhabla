import type { Metadata } from "next";
import { VistaDeCompetidor } from "@/components/competencia/vista-de-competidor";

export const metadata: Metadata = { title: "Competidor" };

export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VistaDeCompetidor id={id} />;
}
