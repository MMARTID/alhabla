"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Sprout } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { BotonDeGoogle } from "@/components/boton-de-google";
import { DialogoDeSesionCaducada } from "@/components/dialogo-de-sesion-caducada";
import { analizarError, MENSAJE_SIN_CONFIGURAR } from "@/lib/api-errors";
import { useCerrarSesion } from "@/lib/cerrar-sesion";
import { config } from "@/lib/config";
import { useYo, invalidarTodoGrowth } from "@/lib/consultas";
import { programarRenovacion, recuperarSesionSilenciosa } from "@/lib/gis";
import { useSesion, type EstadoDeSesion } from "@/lib/sesion";

/**
 * Envuelve el panel y decide qué ve la persona según su sesión:
 *
 * - Sin sesión: el botón de Google (no hay ruta /login: así no hay bucles de
 *   redirección ni se pierde la URL a la que iba).
 * - Con sesión: se comprueba con `GET /yo` ANTES de enseñar nada. 401 =>
 *   caducada, 403 => «sin acceso», 503 => «Growth no está configurado.».
 * - Sesión caducada con el panel ya abierto: el panel se queda (inerte) y
 *   encima sale el diálogo para volver a entrar. No se pierde ningún borrador.
 *
 * El inicio de sesión no corre en modo demostración.
 */
export function PuertaDeSesion({ children }: { children: ReactNode }) {
  // SEGUNDO de los dos únicos puntos de bifurcación de la demostración (el
  // primero es `crearCliente`): la condición va escrita tal cual para que se
  // elimine como código muerto en producción. Sin GIS, sin token: el cliente
  // de datos de prueba responde a todo.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_GROWTH_DEMO === "1"
  ) {
    return <>{children}</>;
  }
  return <PuertaReal>{children}</PuertaReal>;
}

function correoDe(sesion: EstadoDeSesion): string | null {
  return sesion.estado === "activa" ||
    sesion.estado === "caducada" ||
    sesion.estado === "sin_acceso"
    ? sesion.email
    : null;
}

function PuertaReal({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const queryClient = useQueryClient();
  const email = correoDe(sesion);
  const estaActiva = sesion.estado === "activa";
  const exp = sesion.estado === "activa" ? sesion.exp : null;

  // La comprobación de acceso. El dato se queda en la caché mientras la sesión
  // está caducada (misma clave: mismo correo), y eso es lo que mantiene el
  // panel a la vista bajo el diálogo.
  const yo = useYo(email, estaActiva);

  // Un intento por carga de página de entrar sin interacción.
  useEffect(() => {
    if (sesion.estado === "sin_sesion" && config.googleClientId) {
      void recuperarSesionSilenciosa(config.googleClientId);
    }
  }, [sesion.estado]);

  // Renovación del token (mejor esfuerzo) y aviso de caducidad.
  useEffect(() => {
    if (exp === null) return;
    return programarRenovacion(config.googleClientId, exp);
  }, [exp]);

  // Al volver a entrar tras una caducidad, se refresca lo que había en pantalla.
  const estadoPrevio = useRef(sesion.estado);
  useEffect(() => {
    if (estadoPrevio.current === "caducada" && sesion.estado === "activa") {
      void invalidarTodoGrowth(queryClient);
    }
    estadoPrevio.current = sesion.estado;
  }, [sesion.estado, queryClient]);

  if (sesion.estado === "cargando")
    return <PantallaDeCarga texto="Cargando…" />;
  if (sesion.estado === "sin_sesion") return <PantallaDeAcceso />;
  if (sesion.estado === "sin_acceso") {
    return <PantallaSinAcceso email={sesion.email} />;
  }

  // Sesión activa o caducada. Con el acceso ya comprobado, el panel.
  if (yo.data) {
    const caducada = sesion.estado === "caducada";
    return (
      // Cambiar de cuenta (otro correo) monta un panel nuevo: no se arrastra
      // nada de la sesión anterior.
      <div key={yo.data.email}>
        <div inert={caducada}>{children}</div>
        {caducada ? <DialogoDeSesionCaducada /> : null}
      </div>
    );
  }
  if (sesion.estado === "caducada") {
    return (
      <PantallaDeAcceso aviso="Tu sesión ha caducado. Vuelve a iniciar sesión." />
    );
  }
  if (yo.isError)
    return (
      <PantallaDeFallo
        error={yo.error}
        alReintentar={() => void yo.refetch()}
      />
    );
  return <PantallaDeCarga texto="Comprobando tu acceso…" />;
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md p-8 text-center">{children}</div>
    </main>
  );
}

function Icono({ tipo }: { tipo: "marca" | "aviso" }) {
  const Componente = tipo === "marca" ? Sprout : ShieldAlert;
  return (
    <span className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
      <Componente className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function PantallaDeCarga({ texto }: { texto: string }) {
  return (
    <Marco>
      <div
        role="status"
        className="flex items-center justify-center gap-3 text-sm text-muted"
      >
        <Loader2
          className="h-5 w-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {texto}
      </div>
    </Marco>
  );
}

function PantallaDeAcceso({ aviso }: { aviso?: string }) {
  return (
    <Marco>
      <Icono tipo="marca" />
      <h1 className="text-xl font-semibold text-tinta">Alhabla Growth</h1>
      <p className="mt-2 text-sm text-muted">
        Acceso solo para administradores. Inicia sesión con tu cuenta de Google.
      </p>
      {aviso ? (
        <p role="status" className="mt-4 text-sm font-semibold text-aviso">
          {aviso}
        </p>
      ) : null}
      <div className="mt-6">
        <BotonDeGoogle />
      </div>
    </Marco>
  );
}

function PantallaSinAcceso({ email }: { email: string | null }) {
  const cerrar = useCerrarSesion();
  return (
    <Marco>
      <Icono tipo="aviso" />
      <h1 className="text-xl font-semibold text-tinta">
        Esta cuenta no tiene acceso a Growth
      </h1>
      <p className="mt-2 text-sm text-muted">
        {email ? (
          <>
            <span className="font-semibold text-tinta">{email}</span> no está en
            la lista de administradores.
          </>
        ) : (
          "Tu cuenta no está en la lista de administradores."
        )}{" "}
        Si debería estarlo, pídele a quien administra Growth que la añada.
      </p>
      <button
        type="button"
        onClick={cerrar}
        className="btn-primary mt-6 w-full"
      >
        Usar otra cuenta
      </button>
    </Marco>
  );
}

function PantallaDeFallo({
  error,
  alReintentar,
}: {
  error: unknown;
  alReintentar: () => void;
}) {
  const cerrar = useCerrarSesion();
  const { mensaje, estado } = analizarError(
    error,
    "No se pudo comprobar tu acceso."
  );
  const sinConfigurar = mensaje === MENSAJE_SIN_CONFIGURAR;
  return (
    <Marco>
      <Icono tipo="aviso" />
      <h1 className="text-xl font-semibold text-tinta">
        {sinConfigurar
          ? "Growth no está configurado"
          : "No se pudo comprobar tu acceso"}
      </h1>
      <p role="alert" className="mt-2 text-sm text-muted">
        {mensaje}
        {sinConfigurar
          ? " Faltan GROWTH_GOOGLE_CLIENT_ID o GROWTH_ADMIN_EMAILS en el backend."
          : estado === null
            ? " Revisa tu conexión."
            : ""}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={alReintentar}
          className="btn-primary w-full"
        >
          Reintentar
        </button>
        <button type="button" onClick={cerrar} className="btn-secondary w-full">
          Cerrar sesión
        </button>
      </div>
    </Marco>
  );
}
