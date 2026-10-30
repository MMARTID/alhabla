import type { Metadata } from "next";
import { VistaDeRevision } from "@/components/revision/vista-de-revision";

export const metadata: Metadata = { title: "Revisión" };

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ borrador?: string | string[] }>;
}) {
  const { id } = await params;
  const { borrador } = await searchParams;
  // `?borrador=<id>` abre la Revisión ya en esa versión (enlace desde Borradores).
  return (
    <VistaDeRevision
      id={id}
      borradorId={typeof borrador === "string" ? borrador : undefined}
    />
  );
}
