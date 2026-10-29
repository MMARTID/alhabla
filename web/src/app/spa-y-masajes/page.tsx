import { SiteLanding } from "@/components/site-landing";
import { datosEstructuradosDeSector, metadatosDeSector } from "@/lib/sectores";
import { spaYMasajes as sector } from "@/lib/sectores/spa-y-masajes";

export const metadata = metadatosDeSector(sector);

export default function SpaYMasajesPage() {
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
