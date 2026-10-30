# Alhabla Growth — registro de decisiones

Decisiones del fundador sobre `PLAN-GROWTH.md`. Una entrada por fecha; lo posterior
sustituye a lo anterior sin borrarlo.

## 2026-10-30 (1) — Diseño aprobado

El fundador aprobó el diseño con un «Apruebo» tras ver el resumen y las recomendaciones.
Se registraron como decididas las cinco recomendadas.

| # | Decisión | Elegida | Estado |
|---|---|---|---|
| 1 | Dónde corre la Scheduled Task | Local (Desktop), con «Mantener el equipo despierto». Nube como migración posible | Vigente |
| 2 | Búsqueda indirecta de Reddit (`site:reddit.com` en un buscador) | Apagada | **Sustituida** por (2): Reddit queda fuera |
| 3 | Cuenta de Reddit | La del fundador, con divulgación cuando se mencione Alhabla | **Sustituida** por (2) |
| 4 | Acceso al dashboard | Google con lista blanca de su correo; `growth.alhabla.ai` sin proxy de Cloudflare (a confirmar en Fase 1) | Vigente |
| 5 | Fase 0 como puerta | Poco volumen de calidad en español mueve el peso a backlinks y SEO/GEO | **Resuelta** por (2), sin medir |

Reglas fijas del diseño (no cambian sin una entrada nueva aquí):

- Todo se ejecuta a mano por el fundador. Sin publicación automática, sin correos ni mensajes automáticos.
- El backend no llama a ningún LLM: el razonamiento es de la suscripción Max, sin consumo de API.
- Ninguna fase empieza sin el visto bueno del fundador.

## 2026-10-30 (2) — Reddit fuera del sistema

A petición del fundador («omitamos lo de Reddit»):

- Se cancelan el muestreo de hilos, la cuenta de Reddit para Growth y el enlace del perfil.
- El peso del sistema pasa a backlinks (objetivo C) y SEO/GEO. Los objetivos A y B quedan reducidos.
- Es una decisión **sin datos**: no se midió cuántos hilos de calidad hay en español. Es reversible; se retomaría solo con autorización de la plataforma y evidencia (Fase 6 del plan).
- `PLAN-GROWTH.md` se reescribe como v2 sin Reddit, con run semanal y borradores de enlaces y menciones editoriales.

## 2026-10-30 (3) — Search Console sin clave

- La API de Search Console está habilitada y la cuenta de servicio `growth-lectura-gsc` tiene acceso **Restringido** a `sc-domain:alhabla.ai`, sin roles de proyecto.
- La política de la organización `iam.disableServiceAccountKeyCreation` impide crear claves. No se salta.
- Se usa suplantación: `admin@alhabla.ai` tiene `roles/iam.serviceAccountTokenCreator` **solo sobre esa cuenta de servicio**, concedido a petición del fundador.
- La suplantación no está probada de extremo a extremo; se prueba al inicio de la Fase 4.
