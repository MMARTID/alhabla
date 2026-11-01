"use client";

import { ClipboardList, TriangleAlert } from "lucide-react";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { BotonCopiar } from "@/components/revision/boton-copiar";
import { useFichaDeAlhabla } from "@/lib/consultas";
import { commitCorto, formatearDistancia } from "@/lib/formato";
import type { CampoDeFicha, RespuestaDeFicha } from "@/lib/types";
import {
  contarCaracteres,
  excesoSobreElLimite,
  textoDeLaFichaCompleta,
} from "./utilidades";

const CLASES_DE_CLAVE =
  "rounded-md bg-relleno px-1.5 py-0.5 font-mono text-[11px] text-apagado [overflow-wrap:anywhere]";

function Claves({ claves }: { claves: readonly string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {claves.map((clave) => (
        <code key={clave} className={CLASES_DE_CLAVE}>
          {clave}
        </code>
      ))}
    </span>
  );
}

/**
 * Los campos cortos (el nombre, la web, los idiomas…) van de dos en dos en el
 * escritorio; los largos o con algo que contar (límite, claves que faltan,
 * varias líneas) ocupan el ancho entero.
 */
function esCampoLargo(campo: CampoDeFicha): boolean {
  return (
    campo.limite !== undefined ||
    campo.texto === null ||
    campo.texto.length > 70 ||
    campo.texto.includes("\n") ||
    campo.faltan.length > 0
  );
}

/**
 * Un campo de la ficha: la etiqueta, los caracteres frente al límite
 * orientativo, el texto en una caja monoespaciada y su botón «Copiar», que
 * copia exactamente lo que se ve. Debajo, de qué claves sale y lo que falta.
 */
function CampoDeLaFicha({ campo }: { campo: CampoDeFicha }) {
  const { texto } = campo;
  const exceso = excesoSobreElLimite(campo);
  return (
    <li
      className={`border-t border-linea-suave pt-4 ${
        esCampoLargo(campo) ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold text-tinta">{campo.etiqueta}</h3>
        <div className="flex items-center gap-3">
          {texto !== null ? (
            <p
              className={`text-xs ${exceso > 0 ? "font-semibold text-aviso" : "text-muted"}`}
            >
              {contarCaracteres(texto)}
              {campo.limite !== undefined ? ` de ${campo.limite}` : ""}{" "}
              caracteres
            </p>
          ) : null}
          <BotonCopiar
            texto={texto ?? ""}
            etiqueta="Copiar"
            contexto={campo.etiqueta}
            deshabilitado={texto === null}
          />
        </div>
      </div>

      {texto !== null ? (
        <div className="mt-2 whitespace-pre-wrap rounded-[10px] border border-linea bg-relleno p-3 font-mono text-[13px] leading-relaxed text-tinta [overflow-wrap:anywhere]">
          {texto}
        </div>
      ) : (
        <p className="mt-2 rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso">
          Este campo no se puede componer todavía: faltan afirmaciones vigentes
          en la base de conocimiento.
        </p>
      )}

      {exceso > 0 ? (
        <p className="mt-2 text-xs text-aviso">
          Pasa del límite orientativo por {exceso}{" "}
          {exceso === 1 ? "carácter" : "caracteres"}: acórtalo al pegarlo si el
          formulario lo corta.
        </p>
      ) : null}
      {campo.faltan.length > 0 ? (
        <p className="mt-2 text-xs text-aviso">
          <span className="font-semibold">
            Faltan en la base de conocimiento:
          </span>{" "}
          <Claves claves={campo.faltan} />
        </p>
      ) : null}
      {campo.afirmaciones.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Sale de: <Claves claves={campo.afirmaciones} />
        </p>
      ) : null}
    </li>
  );
}

function CuerpoDeLaFicha({ ficha }: { ficha: RespuestaDeFicha }) {
  return (
    <>
      {ficha.avisos.length > 0 ? (
        <div
          role="alert"
          className="mb-4 rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-aviso">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            Revisa estos textos antes de pegarlos
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-tinta-2 [overflow-wrap:anywhere]">
            {ficha.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {ficha.campos.map((campo) => (
          <CampoDeLaFicha key={campo.clave} campo={campo} />
        ))}
      </ul>
    </>
  );
}

/** De dónde sale la ficha: el commit y cuándo se sincronizó el conocimiento. */
function origenDeLaFicha(ficha: RespuestaDeFicha): string {
  if (ficha.commit === null && ficha.sincronizadaEn === null) {
    return "La base de conocimiento no se ha sincronizado nunca: no hay nada que componer.";
  }
  return `Compuesta con las afirmaciones vigentes del commit ${commitCorto(ficha.commit)}${
    ficha.sincronizadaEn
      ? `, sincronizado ${formatearDistancia(ficha.sincronizadaEn)}`
      : ""
  }.`;
}

/**
 * La «Ficha de Alhabla»: el texto listo para pegar en cualquier directorio,
 * compuesto en el servidor SOLO con afirmaciones vigentes de la base de
 * conocimiento (sin modelo). Si falta una, el campo lo dice en vez de
 * inventarla; si un texto lleva un término prohibido, sale un aviso.
 */
export function FichaDeAlhabla() {
  const consulta = useFichaDeAlhabla();
  const ficha = consulta.data;
  return (
    <section
      aria-labelledby="ficha-de-alhabla"
      className="panel mb-8 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="ficha-de-alhabla"
              className="text-lg font-semibold text-tinta"
            >
              Ficha de Alhabla
            </h2>
            <p className="mt-0.5 max-w-xl text-sm text-muted">
              Los textos para rellenar el alta en un directorio. Solo salen de
              afirmaciones vigentes de la base de conocimiento.
            </p>
            {ficha ? (
              <p className="mt-1 text-xs text-muted">
                {origenDeLaFicha(ficha)}
              </p>
            ) : null}
          </div>
        </div>
        {ficha ? (
          <BotonCopiar
            texto={textoDeLaFichaCompleta(ficha.campos)}
            etiqueta="Copiar todo"
            deshabilitado={textoDeLaFichaCompleta(ficha.campos) === ""}
          />
        ) : null}
      </div>
      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudo cargar la ficha de Alhabla"
        filas={3}
        alto="h-20"
      >
        {(datos) => <CuerpoDeLaFicha ficha={datos} />}
      </ConsultaConDatos>
    </section>
  );
}
