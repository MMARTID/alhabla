import { SiteLanding } from "@/components/site-landing";
import { datosEstructuradosDeSector, metadatosDeSector } from "@/lib/sectores";
import { barberia as sector } from "@/lib/sectores/barberia";

export const metadata = metadatosDeSector(sector);

export default function BarberiaPage() {
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
