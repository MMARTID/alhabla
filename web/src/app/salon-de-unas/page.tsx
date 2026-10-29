import { SiteLanding } from "@/components/site-landing";
import { datosEstructuradosDeSector, metadatosDeSector } from "@/lib/sectores";
import { salonDeUnas as sector } from "@/lib/sectores/salon-de-unas";

export const metadata = metadatosDeSector(sector);

export default function SalonDeUnasPage() {
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
