import { SiteLanding } from "@/components/site-landing";
import { datosEstructuradosDeSector, metadatosDeSector } from "@/lib/sectores";
import { centroDeEstetica as sector } from "@/lib/sectores/centro-de-estetica";

export const metadata = metadatosDeSector(sector);

export default function CentroDeEsteticaPage() {
  return (
    <>
      <SiteLanding sector={sector} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(datosEstructuradosDeSector(sector)),
        }}
      />
    </>
  );
}
