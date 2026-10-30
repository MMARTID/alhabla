import { PanelShell } from "@/components/panel-shell";
import { PuertaDeSesion } from "@/components/puerta-de-sesion";

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PuertaDeSesion>
      <PanelShell>{children}</PanelShell>
    </PuertaDeSesion>
  );
}
