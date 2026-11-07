# Registro de actividades de tratamiento (art. 30 RGPD)

Documento **interno**, no se publica. Versión 1.0, 2026-11-06. Titular: Miguel Martín Delgado (autónomo), Carrer Sot de
Bacs 175, 08470 Sant Celoni. Contacto: privacidad@alhabla.ai. No hay delegado de protección de datos (no es obligatorio).

Se revisa cada vez que cambia un proveedor, un plazo o una función que toque datos personales, y como mínimo cada seis
meses. Cada cambio se anota en el apartado 4. Las fuentes son el código (`backend/src`) y la política publicada
(`web/src/app/legal/privacidad/page.tsx`).

## 1. Alhabla como **responsable**

| # | Actividad | Interesados | Datos | Base legal | Destinatarios | Plazo |
|---|---|---|---|---|---|---|
| R1 | Cuenta y panel del negocio | Titulares y usuarios del negocio | Email, contraseña (hash) o id de Google/Facebook, datos del negocio | Contrato | Google Cloud, Vercel, Zoho Mail | Mientras haya cuenta; borrado al eliminarla |
| R2 | Facturación y suscripción | Titulares | Datos fiscales, identificador de cliente de Stripe (no la tarjeta) | Contrato y obligación legal | Stripe | 6 años (contable y fiscal) |
| R3 | Seguridad, registros técnicos y prevención de abuso | Usuarios de la web y la app | IP, registros de peticiones, errores | Interés legítimo | Google Cloud, Vercel | **Comprobar** el plazo real de los registros (pendiente, §3) |
| R4 | Contacto antes de contratar (formulario, correo, WhatsApp) | Interesados | Nombre, email, teléfono, negocio, mensaje | Medidas precontractuales | Zoho Mail; Meta (WhatsApp) | Mientras dure la conversación; máx. 1 año tras el último mensaje |
| R5 | Demo de voz de la web | Visitantes | Transcripción de la conversación (sin audio) | Consentimiento | Telnyx | **Comprobar** el plazo (la política dice «el tiempo necesario»; pendiente, §3) |
| R6 | Medición de la web | Visitantes | Datos de analítica | Consentimiento (banner) | Google Analytics, Vercel | Los de cada herramienta |
| R7 | Alhabla Growth (contactos con medios y webs para menciones) | Personas de contacto de medios y directorios | Nombre, email profesional, historial de contacto | Interés legítimo | Ninguno externo | **Definir** el plazo (hay un job de purga, `purgarRetencionDeGrowth`) |

## 2. Alhabla como **encargado** del negocio (el negocio es el responsable)

Cubierto por el DPA publicado en `alhabla.ai/legal/dpa`, que cada negocio acepta al registrarse.

| # | Actividad | Interesados | Datos | Subencargados | Plazo |
|---|---|---|---|---|---|
| E1 | Recepcionista de IA: atender llamadas y reservar | Personas que llaman | Teléfono, voz, transcripción, resumen, servicio y cita; grabación **solo con permiso** | Telnyx (y los modelos que ejecuta), Google Cloud, Cloudflare R2 | Audio 30 días; texto 90 días |
| E2 | Conversaciones por WhatsApp con clientes | Clientes del negocio | Teléfono, mensajes, citas | Telnyx, Meta | 90 días |
| E3 | Agenda de Alhabla | Clientes y profesionales | Nombre, teléfono, servicio, fecha, profesional | Google Cloud | Mientras haya cuenta |
| E4 | Tu asistente por WhatsApp (el Gestor) | Dueño, clientes y profesionales | Mensajes del dueño, citas, ausencias | Telnyx, modelo de lenguaje de OpenAI a través de Telnyx, Meta | 90 días |
| E5 | Avisos y recordatorios a clientes | Clientes | Teléfono, cita | Telnyx, Meta, Zoho Mail | Los de la cita |
| E6 | Sincronización con Google, Outlook o iCloud | Clientes y profesionales | Eventos de calendario | El proveedor que **elige el negocio** (no es subencargado nuestro) | Mientras esté conectado |

## 3. Pendientes de comprobar (rellenar antes de dar este registro por bueno)

- Plazo real de conservación de los registros técnicos (R3) y de las transcripciones de la demo (R5).
- Copias de seguridad de la base de datos: dónde están, cuánto duran, cómo se borran.
- Si los datos del negocio borrados siguen en copias de seguridad y durante cuánto tiempo.
- Contrato y DPA firmados con **cada** proveedor: Telnyx, Google Cloud, Cloudflare, Vercel, Zoho, Stripe. Guardar copia y fecha.
- Región de los modelos de lenguaje de la voz: **cerrado el 2026-11-07**, sin garantía de región (la garantía
  `in_transit_data_locality` corta llamadas y no admite Soniox ni Kimi). El DPA y la política lo dicen. Reabrir si
  Telnyx contesta a la consulta del 06-11 o si la garantía se estabiliza.
- Telnyx: DPA público leído el 2026-11-07 (certificada en el Marco de Privacidad de Datos UE-EE. UU.; cláusulas
  contractuales tipo en su apartado 5; responsable independiente de los datos técnicos y de la mejora del servicio,
  apartados 2 y 3). Falta firmarlo desde el portal y guardar copia y fecha.
- Mecanismo de transferencia de OpenAI, Soniox, Zoho y Vercel (certificación en el Marco de Privacidad de Datos o
  cláusulas contractuales tipo): comprobarlo y guardar la prueba. El DPA publicado promete que solo se usan con una.
- Jurisdicción del bucket de Cloudflare R2 (UE o por defecto).
- Evaluación de impacto de la transferencia (TIA), una por proveedor fuera del EEE.
- Si Alhabla Growth guarda datos personales de contactos y con qué plazo.

## 4. Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-11-06 | Primera versión. |
| 2026-11-07 | DPA, política y registro alineados con lo que hace Telnyx de verdad: sin garantía de UE para los modelos de lenguaje; redacción de datos solo en voz. |
