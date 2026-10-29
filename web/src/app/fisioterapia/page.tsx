import { SiteLanding } from "@/components/site-landing";
import { datosEstructuradosDeSector, metadatosDeSector } from "@/lib/sectores";
import { fisioterapia as sector } from "@/lib/sectores/fisioterapia";

export const metadata = metadatosDeSector(sector);

export default function FisioterapiaPage() {
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
