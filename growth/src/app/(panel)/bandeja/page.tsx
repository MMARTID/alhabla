import type { Metadata } from "next";
import { Suspense } from "react";
import { BandejaConUrl } from "@/components/bandeja/bandeja-con-url";

export const metadata: Metadata = { title: "Bandeja" };

export default function Pagina() {
  // `useSearchParams` pide un límite de Suspense para que la página siga
  // siendo estática; el panel entero espera a la sesión en el cliente.
  return (
    <Suspense fallback={null}>
      <BandejaConUrl />
    </Suspense>
  );
}
