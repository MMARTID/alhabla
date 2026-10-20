"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { registerAccount } from "@/lib/api";
import { appUrl } from "@/lib/app-url";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { FacebookAuthButton } from "@/components/facebook-auth-button";
import { BrandMark } from "@/components/brand-mark";
import { ParticleField } from "@/components/particle-field";
import { ParticleMouseLayer } from "@/components/particle-mouse-layer";
import { medirEvento, medirEventoYSeguir } from "@/components/google-analytics";
import { normalizeBusinessType } from "@/lib/business-type";
import { buildAppEntryUrl, describeRegisterError } from "@/lib/register";
import { isPlanId } from "@/lib/billing-navigation";

const TERMINOS_PENDIENTES =
  "Debes aceptar los Términos y Condiciones y la Política de privacidad.";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEuropeanUnion, setIsEuropeanUnion] = useState<boolean | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const casillaTerminos = useRef<HTMLInputElement>(null);
  const registroEmpezado = useRef(false);

  // Abrir /register ya lo cuenta el `page_view`; esto separa a quien empieza
  // a rellenar (o pulsa Google o Facebook) de quien mira y se va. Puntero y
  // foco: Safari no enfoca un botón al pulsarlo con el ratón.
  const medirInicioDelRegistro = () => {
    if (registroEmpezado.current) return;
    registroEmpezado.current = true;
    medirEvento("empezar_registro", isPlanId(plan) ? { plan } : {});
  };

  // El aviso queda debajo del formulario, fuera de la vista al pulsar
  // Google o Facebook: llevar el foco a la casilla lo trae a pantalla con ella.
  const avisarDesdeBotonSocial = (mensaje: string) => {
    setError(mensaje);
    if (mensaje === TERMINOS_PENDIENTES) casillaTerminos.current?.focus();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNiche(params.get("niche"));
    setPlan(params.get("plan"));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isEuropeanUnion === null) {
      setError("Indica si tus clientes son de la Unión Europea.");
      return;
    }
    if (!acceptedTerms) {
      setError(TERMINOS_PENDIENTES);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await registerAccount({
        email,
        password,
        isEuropeanUnion,
        acceptedTerms,
        businessType: niche ? normalizeBusinessType(niche) : undefined,
      });
      if (!data.pase) {
        // Backend anterior o Redis caído: la cuenta existe, pero no hay pase
        // con el que entrar en la app sin escribir la contraseña otra vez.
        medirEvento("sign_up", { method: "email" });
        setError("Tu cuenta está creada. Entra en la app con tu email y contraseña.");
        setLoading(false);
        return;
      }
      const entrada = buildAppEntryUrl({ pase: data.pase, plan, niche });
      // El alta con Google o Facebook la mide la app, que es donde acaba
      // (callback con `alta=1`).
      medirEventoYSeguir("sign_up", { method: "email" }, () =>
        window.location.assign(entrada)
      );
    } catch (error) {
      setError(describeRegisterError(error));
      setLoading(false);
    }
  };

  return (
    <div className="tema-sistema relative isolate flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ParticleField />
      <ParticleMouseLayer />
      <div
        className="panel w-full max-w-lg p-8"
        onPointerDownCapture={medirInicioDelRegistro}
        onFocusCapture={medirInicioDelRegistro}
      >
        <div className="space-y-4 text-center">
          <BrandMark className="mx-auto h-14 w-14" />
          <h2 className="text-3xl font-black tracking-tight text-tinta">Crear cuenta</h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted">
            Regístrate para configurar tu asistente y comenzar a mejorar la experiencia de tus clientes.
          </p>
        </div>

        <div className="mt-8">
          <div className="space-y-3">
            {/* Sin bloqueo: los dos se pueden pulsar siempre, pero sin la
                casilla de Términos marcada avisan aquí en vez de ir a Google
                o Facebook (el backend rechazaría el alta con terms_required). */}
            <GoogleAuthButton
              onError={avisarDesdeBotonSocial}
              acceptedTerms={acceptedTerms}
              intent="register"
              avisoAntesDeEmpezar={acceptedTerms ? undefined : TERMINOS_PENDIENTES}
            />
            <FacebookAuthButton
              onError={avisarDesdeBotonSocial}
              acceptedTerms={acceptedTerms}
              intent="register"
              avisoAntesDeEmpezar={acceptedTerms ? undefined : TERMINOS_PENDIENTES}
            />
          </div>
          <div className="my-6 flex items-center gap-4" aria-hidden="true">
            <div className="h-px flex-1 bg-linea" />
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-apagado-2">o con email</span>
            <div className="h-px flex-1 bg-linea" />
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="register-email" className="text-sm font-medium text-tinta-2">Email</label>
              <input
                id="register-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field mt-2 w-full"
                placeholder="tucorreo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="register-password" className="text-sm font-medium text-tinta-2">Contraseña</label>
              <input
                id="register-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="field mt-2 w-full"
                placeholder="Mínimo 8 caracteres, con una letra y un número"
                aria-describedby="register-password-ayuda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* La misma regla que aplica el backend en /auth/register, al
                  cambiarla desde Ajustes y al restablecerla por correo: que se
                  lea antes de enviar y no en forma de error. */}
              <p id="register-password-ayuda" className="mt-2 text-xs leading-5 text-muted">
                Al menos 8 caracteres, con una letra y un número.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-tinta-2">¿Tus clientes son de la Unión Europea?</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {([
                  { label: "Sí", value: true },
                  { label: "No", value: false },
                ] as const).map((option) => (
                  <label key={option.label} className="group relative block cursor-pointer">
                    <input
                      type="radio"
                      name="isEuropeanUnion"
                      required
                      className="peer sr-only"
                      checked={isEuropeanUnion === option.value}
                      onChange={() => setIsEuropeanUnion(option.value)}
                    />
                    <span className="flex h-11 items-center justify-center gap-2 rounded-full border border-linea bg-superficie text-sm font-semibold text-tinta-2 transition peer-checked:border-morado peer-checked:bg-lavado peer-checked:text-morado-tinta peer-focus-visible:ring-4 peer-focus-visible:ring-morado/30 peer-focus-visible:ring-offset-2 group-hover:border-morado">
                      {isEuropeanUnion === option.value ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-start gap-3 py-1.5 text-sm text-tinta-2">
              <input
                ref={casillaTerminos}
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea-fuerte text-morado focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-morado/30"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                He leído y acepto los{" "}
                <Link href="/legal/aviso-legal" target="_blank" className="rounded font-semibold text-morado-tinta underline underline-offset-2 transition hover:text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/legal/privacidad" target="_blank" className="rounded font-semibold text-morado-tinta underline underline-offset-2 transition hover:text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
                  Política de privacidad
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Alto reservado: sin esto, un error real (email ya registrado)
              desplaza el botón justo cuando el usuario reintenta. */}
          <p className="min-h-5 text-sm text-error" role="alert">{error}</p>

          <button type="submit" disabled={loading || !acceptedTerms} className="btn-primary w-full justify-center">
            {loading ? "Creando cuenta..." : "Registrarse"}
          </button>

          <div className="text-center text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <a href={appUrl("/login")} className="rounded font-semibold text-morado-tinta transition hover:text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
              Inicia sesión
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
