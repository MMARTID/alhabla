# Eventos de analítica (GA4)

Embudo de captación de la web (`alhabla.ai`) y de la app (`app.alhabla.ai`), medido en Google
Analytics 4 (`G-Z3RT28K0ZJ`, compartido por las dos; `content_group` es `web` o `app`). Añadido el
2026-10-16 tras el estudio comercial: 214 visitas en 30 días, 24 en /planes, 7 en /register y
ninguna alta, sin forma de saber dónde se caían.

## Reglas

- **Solo con consentimiento.** Todos los eventos pasan por `medirEvento` / `medirEventoYSeguir`
  (`components/google-analytics.tsx`, copia compartida app/web), que no envían nada si la cookie
  `alhabla_analitica` no dice `aceptada` o si la etiqueta aún no está configurada.
- **Sin datos personales.** Los parámetros dicen de qué botón u opción se trata (`ubicacion`,
  `plan`, `sedes`, `method`), nunca nombre, email, teléfono ni texto escrito por la persona.
  `page_location` va siempre sin query string (puede llevar el pase de entrada o el `session_id`).
- **Antes de salir de la página**, `medirEventoYSeguir`: espera a que gtag confirme el envío
  (`event_callback`) como mucho 1,5 s y sigue. Lo usan los eventos que van justo antes de un
  `location.assign`/`replace` (a la app, que es otro dominio, o a `/bienvenida`).
- **Botones de un Server Component**: `data-evento="…"` y, si hace falta, `data-ubicacion="…"`.
  `MedicionDeClics` (`web/src/components/medicion-de-clics.tsx`, montado en el layout de la web)
  escucha los clics en `document` y los mide. Solo sirve para navegaciones dentro de la web o a
  otra pestaña; si el clic saca de la web, `medirEventoYSeguir`.
- Donde GA4 tiene un evento recomendado con el mismo sentido se usa su nombre (`sign_up`,
  `generate_lead`, `begin_checkout`), que sus informes ya entienden; el resto, en español.

## Eventos

| Evento | Dónde sale | Cuándo | Parámetros |
|--------|-----------|--------|------------|
| `clic_probar` | web | Clic en un botón que lleva a probar (a /planes): «Empezar ahora», «Probar Alhabla 7 días», «Empezar 7 días gratis», «Probar 7 días», «Ver planes» del blog y de la demo, «Recuperar mis … €» de la calculadora | `ubicacion`: `cabecera`, `cabecera_movil`, `menu_movil`, `portada`, `portada_cierre`, `sector`, `sector_cierre`, `ciudad`, `en_marcha`, `calculadora`, `demo`, `blog`, `blog_articulo`, `blog_cta` |
| `ver_planes` | web | Con el `page_view` de /planes (prop `eventosDeRuta` de `GoogleAnalytics` en `web/src/app/layout.tsx`) | — |
| `elegir_plan` | web | Clic en «Elegir …» de una tarjeta de /planes, antes de ir a la app | `plan`: `inicio`, `pro`, `scale` |
| `generate_lead` | web | Formulario de /contacto enviado y aceptado por el backend | `formulario`: `contacto`; `sedes`: `1`, `2-4`, `5+`, `franquicia` |
| `clic_whatsapp` | web | Clic en «Escríbenos por WhatsApp» (solo se pinta si hay `WHATSAPP_DEL_EQUIPO` en `web/src/lib/contacto.ts`) | `ubicacion`: `contacto`, `planes` |
| `empezar_registro` | web | Primera interacción con /register (tocar o enfocar un campo o un botón de Google/Facebook); una vez por visita a la página | `plan`, si llegó en la URL |
| `sign_up` | web y app | Cuenta creada. Con email, en la web al responder `POST /auth/register`. Con Google o Facebook, en el callback de la app cuando el backend añade `?alta=1` (solo al crear la cuenta, no al entrar en una que ya existía) | `method`: `email`, `google`, `facebook` |
| `begin_checkout` | app | /checkout, cuando el backend devuelve la sesión de Stripe (un 401 o un 409 no cuentan) | `plan` |
| `checkout_completado` | app | /checkout/resultado con `session_id`, cuando la suscripción queda `TRIALING` o `ACTIVE`; una vez por sesión de Stripe | `plan`; `estado`: `prueba` o `activa` |

El embudo completo: `page_view` → `clic_probar` → `ver_planes` → `elegir_plan` →
`empezar_registro` → `sign_up` → `begin_checkout` → `checkout_completado`, con `generate_lead` y
`clic_whatsapp` como salida hacia una persona.

## En GA4

- Marcar como **eventos clave**: `generate_lead`, `sign_up`, `checkout_completado` (y, si se quiere
  seguir el paso intermedio, `begin_checkout`).
- Los parámetros propios (`ubicacion`, `plan`, `sedes`, `estado`, `formulario`) hay que darlos de
  alta como **dimensiones personalizadas de ámbito evento** para verlos en los informes.
- Para comprobarlos: **Administrar → DebugView** con la extensión Google Analytics Debugger, o la
  consola del navegador: `dataLayer` lleva cada `["event", nombre, parámetros]` que se ha enviado.
