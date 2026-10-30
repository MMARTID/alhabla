# Fase 0 — Cierre

La Fase 0 era una validación sin código para decidir dónde poner el esfuerzo. El 2026-10-30
el fundador decidió omitir Reddit, así que se cierra con lo que se hizo y lo que queda.

## Qué se hizo y qué no

| Tarea | Estado |
|---|---|
| Muestreo manual de hilos de Reddit | **Cancelada** (Reddit fuera del sistema) |
| Cuenta y enlace de perfil en Reddit | **Cancelados** |
| Medir el `rel` de los enlaces de Reddit | **Hecho** (abajo) |
| Cuenta de servicio de Search Console | **Hecho**, sin clave (abajo) |
| Muestreo inicial de backlinks | **Hecho** (`fase-0-muestreo-backlinks.md`) |
| Línea base de uso de Claude Max | **Pendiente** (abajo) |
| Revisar a mano las seis comparativas de «recepcionista de IA» | **Pendiente, opcional** |

## El atributo `rel`

Cada enlace de una página es una etiqueta `<a href="...">`. Su atributo `rel` le dice al
buscador cómo tratarlo:

| Valor | Significado | SEO |
|---|---|---|
| (sin `rel`) | Enlace normal | Pasa autoridad |
| `nofollow` | «No te fíes de este enlace» | Normalmente no pasa autoridad; Google lo trata como pista |
| `ugc` | Contenido creado por usuarios | Igual que `nofollow`, más específico |
| `sponsored` | Enlace de pago o publicitario | Igual |
| `noopener`, `noreferrer` | Seguridad del navegador | No importa para SEO |

Medido por el fundador en Reddit el 2026-10-30:

| Enlace | `rel` |
|---|---|
| Publicación | `noopener nofollow sponsored` |
| Comentario | `noopener nofollow ugc` |
| Enlace social del perfil | sin `rel` |

Cómo se comprueba en cualquier web: clic derecho sobre el enlace → **Inspeccionar** y leer el
`rel` de la etiqueta `<a>` resaltada. Un `<img>` o un `<span>` dentro del enlace no cuentan; solo
el `<a>`.

## Search Console

- API `searchconsole.googleapis.com` habilitada en el proyecto `project-84381467-a606-4b71-a6e`.
- Cuenta de servicio `growth-lectura-gsc@project-84381467-a606-4b71-a6e.iam.gserviceaccount.com`, sin roles de proyecto.
- Acceso **Restringido** (solo lectura) a la propiedad de **dominio** `sc-domain:alhabla.ai`.
- **No hay clave JSON**: la política de organización `iam.disableServiceAccountKeyCreation` impide crearla y no se salta.
- `admin@alhabla.ai` tiene `roles/iam.serviceAccountTokenCreator` solo sobre esa cuenta, para suplantarla.

Cuando llegue la Fase 4, el inicio de sesión es interactivo y lo haces tú en tu terminal:

```bash
gcloud auth application-default login --impersonate-service-account=growth-lectura-gsc@project-84381467-a606-4b71-a6e.iam.gserviceaccount.com
```

Después se hace una llamada de prueba de solo lectura antes de construir nada encima. Los
cambios de permisos de Google pueden tardar unos minutos en aplicarse.

## Línea base de uso de Claude Max (pendiente)

Los runs saldrán de tus límites de 5 horas y semanales, compartidos con tu uso normal. Para
saber el margen: al cerrar una semana sin ningún run de Growth, apunta en
`claude.ai/settings/usage` el **% semanal consumido**. Presupuesto provisional del sistema:
**no más del 10 % del límite semanal**, a ajustar con runs reales. No actives los créditos de
uso para esto, o ponles un tope.

## Si algún día se retoma Reddit

La referencia está en `PLAN-GROWTH.md` § 1: la API exige aprobación escrita para uso comercial
y el acceso automatizado está prohibido. Para decidir con datos, una sola sesión de unos 45
minutos bastaría: en el buscador de Reddit, pestaña de publicaciones, **Ordenar: Nuevo** y
**Fecha: Último mes**, con las palabras clave del sector, contando los hilos de calidad y
dividiendo entre 4. La puerta era 3 o más hilos de calidad a la semana. Todo a mano, sin
extensiones ni herramientas.
