"use client";

import { MessageCircle, Smartphone } from "lucide-react";
import { useId, useState } from "react";
import { BotonCopiar, useHayJavascript } from "@/components/herramientas/boton-copiar";
import { MOMENTOS, PLANTILLAS, type PlantillasDeSector } from "@/components/herramientas/plantillas-de-cita";
import { contarSms, rellenarCampos } from "@/components/herramientas/sms";

/**
 * Las plantillas de recordatorio, por sector y por momento.
 *
 * Todo el texto sale en el HTML del servidor (los ocho sectores, en
 * `<details>`): sin JavaScript se leen y se seleccionan a mano, y Google ve
 * también las de uñas o las de fisioterapia aunque no estén abiertas. Con
 * JavaScript se añaden los botones de copiar y los dos campos que no cambian
 * de un cliente a otro (negocio y teléfono), que se quedan en el navegador.
 */
export function ExploradorDePlantillas() {
  const hayJs = useHayJavascript();
  const idNegocio = useId();
  const idTelefono = useId();
  const [negocio, setNegocio] = useState("");
  const [telefono, setTelefono] = useState("");
  const propios = { negocio, teléfono: telefono };

  const abrirSector = (id: string) => {
    const detalles = document.getElementById(`plantillas-${id}`);
    if (detalles instanceof HTMLDetailsElement) detalles.open = true;
  };

  return (
    <div>
      {hayJs ? (
        <div className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <label htmlFor={idNegocio} className="text-sm font-semibold text-tinta">
              Nombre de tu negocio <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id={idNegocio}
              className="field mt-2 w-full"
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              placeholder="Peluquería Nerea"
              autoComplete="organization"
            />
          </div>
          <div>
            <label htmlFor={idTelefono} className="text-sm font-semibold text-tinta">
              Teléfono para los SMS <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id={idTelefono}
              className="field mt-2 w-full"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="912 345 678"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <p className="text-xs leading-5 text-muted sm:col-span-2">
            Se sustituyen en todas las plantillas al copiarlas. No se envían a ningún sitio: se quedan en esta
            pestaña y desaparecen al cerrarla.
          </p>
        </div>
      ) : null}

      <nav aria-label="Sectores" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {PLANTILLAS.map(({ id, nombre }) => (
            <li key={id}>
              <a
                href={`#plantillas-${id}`}
                onClick={() => abrirSector(id)}
                className="inline-flex h-9 items-center rounded-full border border-linea bg-superficie px-4 text-sm font-medium text-tinta transition hover:border-tinta"
              >
                {nombre}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 space-y-3">
        {PLANTILLAS.map((sector, i) => (
          <Sector key={sector.id} sector={sector} abierto={i === 0} propios={propios} />
        ))}
      </div>
    </div>
  );
}

function Sector({
  sector,
  abierto,
  propios,
}: {
  sector: PlantillasDeSector;
  abierto: boolean;
  propios: Record<string, string>;
}) {
  return (
    <details id={`plantillas-${sector.id}`} open={abierto} className="group scroll-m-24 rounded-3xl border border-linea bg-superficie">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-lg font-bold text-tinta marker:content-none sm:p-6">
        <h3>Plantillas para {sector.nombre.toLowerCase()}</h3>
        <span className="text-xl leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="border-t border-linea px-5 pb-6 pt-5 sm:px-6">
        <p className="max-w-3xl text-sm leading-6 text-apagado">{sector.consejo}</p>
        <ol className="mt-6 space-y-6">
          {MOMENTOS.map(({ id, nombre }) => {
            const { whatsapp, sms } = sector.mensajes[id];
            const textoWhatsapp = rellenarCampos(whatsapp, propios);
            const textoSms = rellenarCampos(sms, propios);
            // La cuenta, con datos de muestra donde el usuario no ha puesto
            // los suyos: es la longitud que tendrá de verdad al enviarlo.
            const cuenta = contarSms(rellenarCampos(textoSms, sector.ejemplo));
            return (
              <li key={id}>
                <h4 className="text-base font-bold text-tinta">{nombre}</h4>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl bg-lavado p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-morado-tinta">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        WhatsApp
                      </p>
                      <BotonCopiar texto={textoWhatsapp} etiqueta={`${nombre.toLowerCase()} por WhatsApp, ${sector.nombre}`} />
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-tinta">{textoWhatsapp}</p>
                  </div>
                  <div className="rounded-2xl border border-linea p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-apagado">
                        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                        SMS
                      </p>
                      <BotonCopiar texto={textoSms} etiqueta={`${nombre.toLowerCase()} por SMS, ${sector.nombre}`} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-tinta">{textoSms}</p>
                    <p className={`mt-2 text-xs ${cuenta.gsm7 && cuenta.mensajes === 1 ? "text-muted" : "text-aviso"}`}>
                      {cuenta.caracteres} caracteres con datos de ejemplo ·{" "}
                      {cuenta.mensajes === 1 ? "1 SMS" : `${cuenta.mensajes} SMS`}
                      {cuenta.gsm7
                        ? ""
                        : ` · «${cuenta.fueraDeGsm7.join(" ")}» obliga a enviarlo en mensajes de 70 caracteres`}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
