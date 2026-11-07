# Alhabla: fuente de verdad para prensa y mensajes

Documento de trabajo (2026-11-06). Todo texto que salga de Alhabla hacia fuera (correos a medios, notas de prensa,
fichas de directorios, `/prensa`, redes) **se copia de aquí**. Si algo cambia, se cambia aquí primero.
Producto y vocabulario: `PRODUCT.md`. Sistema visual: `DESIGN.md`. Sala de prensa pública: `web/src/app/prensa/page.tsx`.

## 1. Reglas que no se rompen

- **Prelanzamiento, sin clientes de pago.** No existen testimonios, casos de éxito, logos de clientes, «X negocios ya
  confían», métricas propias (llamadas, citas recuperadas), premios, apariciones en prensa ni facturación. No se
  insinúan. Se dice claro: «ya disponible, abriendo a los primeros negocios».
- **Toda cifra lleva fuente externa verificable.** Y se presenta como dato del sector, nunca como resultado de Alhabla.
- **Siempre «recepcionista de IA»**, nunca «virtual». Se dice «IA» sin jerga técnica.
- **Alhabla propone, el negocio confirma.** Nada se cambia ni se avisa a un cliente sin el «Confirmar» del dueño.
- **Firma de prensa: «el equipo de Alhabla».** El fundador no se nombra en los textos; solo en el ángulo de la
  propuesta a cada medio (ver §5). El aviso legal ya publica al titular.
- **Nunca se nombra a Telnyx** ni se compara con HeyDiga, fonio ni con personas. Las comparativas son contra
  plataformas para montar tu propio agente (Retell, Vapi…).
- **Español de España, tuteo.** Registro: confianza tranquila y profesional; ni acartonado ni startup.

## 2. Boilerplate (copiar tal cual)

**25 palabras (firma de correo, directorios con límite):**
> Alhabla es la recepcionista de IA para negocios con cita previa: coge las llamadas que tú no puedes, reserva en tu agenda y se gestiona por WhatsApp.

**50 palabras:**
> Alhabla es una recepcionista de IA para peluquerías, barberías, salones de uñas, centros de estética, fisioterapia y otros negocios con cita previa. Atiende las llamadas que el dueño no puede coger, reserva en su agenda y confirma por WhatsApp. El dueño lo gestiona todo desde WhatsApp o el panel. Desde 59 € al mes más IVA.

**100 palabras:**
> Alhabla nace en 2026 en Sant Celoni (Barcelona) para que ningún negocio pierda una llamada por tener las manos
> ocupadas. El negocio conserva su número y desvía a Alhabla las llamadas que no puede coger. La recepcionista avisa de
> que es una inteligencia artificial, mira la agenda del negocio (Google Calendar, Outlook, iCloud o la agenda de
> Alhabla), reserva con el profesional adecuado y confirma la cita por WhatsApp, en castellano, en siete idiomas más y
> en catalán, euskera o gallego según la zona. El dueño tiene además su asistente por WhatsApp: si a mediodía falta
> alguien del equipo, se lo dice y le ayuda a recolocar sus citas, avisando a cada cliente cuando él lo confirma.
> Desde 59 € al mes más IVA, 7 días de prueba, sin permanencia.

## 3. Ficha de datos (fact sheet)

| Dato | Valor | Dónde se comprueba |
|---|---|---|
| Nombre | Alhabla (mayúscula inicial, todo junto) | — |
| Qué es | Recepcionista de IA para negocios con cita previa; el dueño la gestiona por WhatsApp o panel | `PRODUCT.md` |
| Origen | Sant Celoni (Barcelona), 2026; autónomo | `/sobre-alhabla` |
| Estado | Prelanzamiento: producto funcional, abriendo a los primeros negocios | `PRODUCT.md › Evidence on Hand` |
| Sectores | Peluquerías, barberías, salones de uñas, centros de estética, fisioterapia, pestañas y cejas, spa y masajes, peluquería canina | `web/src/lib/sectores/` |
| Idiomas | Castellano, inglés, francés, alemán, italiano, portugués, neerlandés, ruso, y catalán, euskera o gallego según la zona (11) | `backend/src/lib/idiomas/catalogo.ts` |
| Agendas | Google Calendar, Outlook, Apple/iCloud o la agenda de Alhabla | `PRODUCT.md` |
| Planes (sin IVA) | Inicio 59 € (200 min, hasta 3 profesionales) · Pro 139 € (600 min, hasta 10) · Scale 269 € (1.500 min, sin límite) | `web/src/lib/plans.ts` |
| Minuto extra | 0,30 € / 0,25 € / 0,20 € | `web/src/lib/plans.ts` |
| Prueba / permanencia | 7 días de prueba, sin permanencia | `web/src/lib/plans.ts` |
| Aviso de IA | En la primera frase de cada llamada (art. 50 del Reglamento de IA, exigible desde el 2-8-2026); la grabación solo con permiso | `PRODUCT.md` |
| Web / contacto de prensa | alhabla.ai · hola@alhabla.ai (asunto «Prensa») | `web/src/lib/seo.ts` |

## 4. Mensajes clave

Orden fijo (visión del fundador, 29-10-2026): primero que no se pierda ninguna llamada; después el asistente por
WhatsApp, que es lo que provoca el «flipa».

1. **Promesa:** que ningún negocio pierda una llamada. Llamada perdida = cita perdida = ingreso perdido, y el dueño
   no tiene recepcionista ni forma de contestar mientras trabaja.
   *Prueba:* demo de voz pública en alhabla.ai y la calculadora de llamadas perdidas.
2. **Reserva verificada, no conversación simpática.** La recepcionista tiene prohibido inventar: consulta el
   catálogo, comprueba el hueco (horario, capacidad, ausencias y calendario) y vuelve a comprobarlo al reservar. Si el
   calendario no responde, no reserva a ciegas: avisa al dueño y reintenta.
3. **«Mañana falta Marta» se resuelve por WhatsApp.** El dueño dice que alguien no viene; su asistente bloquea la
   agenda, propone pasar cada cita al mejor profesional libre y, tras su sí, avisa a cada cliente. Cada paso lleva
   «Confirmar»; nada sale sin permiso. *Verificado el 20-10-2026:* ningún competidor revisado publica la cadena entera.
4. **Lenguas cooficiales.** Atiende en catalán, euskera o gallego según la zona del negocio, además de castellano y
   siete idiomas más.
5. **Transparencia por diseño.** Avisa de que es IA en la primera frase y no se puede quitar; graba solo si el cliente
   lo permite.
6. **Hecha para el oficio, no un constructor genérico.** Plantillas e instrucciones por sector; reparto por
   especialidad del profesional.

**Qué no se dice:** «el único», «el primero», «sustituye a tu recepcionista», «sin errores», cualquier cifra propia,
cualquier cliente, «si Google se cae». El asistente por WhatsApp **no es exclusivo** (mims publica uno parecido):
lo distintivo es el «Confirmar» en cada cambio, que vaya en el plan de entrada y la ausencia resuelta de punta a punta.

## 5. Ángulos para proponer a cada medio

Cada correo lleva **un** ángulo, no los cuatro.

| Ángulo | Titular posible | Para quién | Apoyo citable |
|---|---|---|---|
| Fundador en solitario | «Un autónomo de Sant Celoni construyó solo una recepcionista de IA para peluquerías» | Prensa local y comarcal, medios de emprendimiento | Historia propia (la cuenta el fundador en el correo) |
| Lenguas cooficiales | «Una IA que coge el teléfono en catalán, euskera y gallego» | Medios catalanes, vascos y gallegos; tecnología con foco lingüístico | Producto verificable por demo |
| Llamadas perdidas | «Cuántas citas pierde un negocio por no coger el teléfono» | Prensa de pyme, belleza y autónomos | Estadísticas de §6 |
| Ley y transparencia | «Qué cambia para el comercio el aviso obligatorio de IA desde el 2 de agosto» | Prensa jurídica y de tecnología | `/guias/ley-y-recepcionista-de-ia` |

## 6. Datos del sector citables

Hablan del problema, **no de Alhabla** (`PRODUCT.md › Evidence on Hand`). Las fuentes de varios son blogs de
proveedores: citar solo con la fuente al lado y contrastar el enlace antes de enviar.

| Dato | Fuente |
|---|---|
| 1 peluquería por cada 900 habitantes, la mayor concentración de Europa | El Confidencial Digital |
| Más del 50 % de las peluquerías en España sin digitalizar | Estética Magazine |
| 37 % de las llamadas a salones y centros de estética se pierden; 57 % de los clientes reserva por teléfono | Zenoti |
| 26.000 centros ofrecen servicios de uñas; 600 M€ de facturación anual | STANPA / El Periódico |
| 78 % contrata al primer negocio que responde | minute-call.com *(blog de proveedor)* |
| 85 % de quienes no hablan con una persona real no vuelve a llamar | safina.ai *(blog de proveedor)* |
| 45–65 € de ticket medio por sesión de fisioterapia | Doctoralia |

Citas recogidas en prensa (sobre el problema): David Aranda, Estetical, en Crónica Global; Excelsior Barber Studio
(Palma) en Diario de Mallorca. Origen: `git show 34d2573:web/src/lib/niche-landings.ts`.

## 7. Q&A de portavoz (borrador para afinar)

- **¿Cuántos clientes tenéis?** Estamos en lanzamiento y abriendo a los primeros negocios; no damos cifras de uso.
- **¿Es una persona o una IA?** Una IA, y lo dice en la primera frase de cada llamada, como exige el Reglamento de IA.
- **¿Graba las llamadas?** Solo si la persona lo permite.
- **¿Se equivoca?** Puede ocurrir; por eso no reserva a ciegas: comprueba la agenda antes y, si falla, avisa al dueño.
- **¿Quita el trabajo a una recepcionista?** Está pensada para negocios que hoy no tienen quién coja el teléfono.
- **¿Qué pasa con los datos?** *(verificado en el código el 06-11-2026; ver §7 bis)* Las llamadas se transcriben para que
  el dueño las consulte, y el audio solo se graba si quien llama lo permite. El audio se borra a los 30 días y el texto
  (transcripción, resumen, teléfono y WhatsApp recibidos) a los 90. El servidor y la base de datos están en la UE
  (Bélgica) y las credenciales de calendario van cifradas. No se venden datos ni se entrenan modelos con ellos.
- **¿Por qué no un constructor de agentes?** Un negocio de cita previa no quiere configurar un agente: quiere que
  contesten y reserven en su agenda.

## 7 bis. Datos: qué hace el código y qué se publica

Revisado el 06-11-2026 contra `backend/src` y `web/src/app/legal/privacidad/page.tsx` (actualizada el 20-10-2026).

**Se puede afirmar (el código lo hace y la política lo dice):**
- Aviso de IA al descolgar, que no se puede quitar; grabación solo con permiso y se puede retirar.
- Purga diaria programada (Cloud Scheduler, 04:30): audio a los **30 días** (`RECORDING_RETENTION_DAYS`) y texto de
  la llamada a los **90** (`CALL_TEXT_RETENTION_DAYS`). Un borrado hecho por el negocio se purga a los 7 días. La fila
  se queda sin datos personales (fecha, duración, resultado) para que la facturación cuadre.
- Bucket de grabaciones privado; la reproducción usa URL firmadas temporales.
- Al eliminar la cuenta se borran: suscripción de Stripe, número y assistants de Telnyx, audios del almacenamiento y el
  negocio con todo lo suyo en la base de datos (`modules/auth/accountService.ts`).
- Tokens de calendario y contraseñas de aplicación de Apple cifrados con AES-256-GCM, con la clave en Secret Manager.
- Servidor y base de datos en Google Cloud, Bélgica (UE). No se venden datos ni se usan para entrenar modelos.
- Telnyx guarda su copia con redacción de datos personales activada (`pii_redaction`, desde el 02-11-2026).

**No afirmar todavía (el código no lo respalda):**
- «Todo se procesa en la UE». La cuenta de Telnyx es de región alemana, pero el modelo de voz (GLM-5.3-Flash, con
  respaldo Kimi-K2.6) corre donde Telnyx decida: no hay garantía de localidad (`in_transit_data_locality` sin activar),
  Soniox se usa en catalán, euskera y gallego, y el Gestor usa un modelo de OpenAI. Hoy se dice «puede procesarse fuera
  del EEE», y es lo correcto.
- «Las grabaciones están cifradas por nosotros»: la política lo dice, pero el código de la aplicación no cifra el
  audio; lo cifra el almacenamiento (Cloudflare R2) en reposo. Pedir confirmar la redacción.

**Política y DPA alineados con el código (07-11-2026, PR #441):**
- La política ya no dice que la recepcionista usa «un modelo de OpenAI»: la voz y el chat con clientes usan modelos
  que aloja Telnyx (GLM-5.3-Flash, con respaldo Kimi-K2.6) y OpenAI solo está en el Gestor. Tampoco dice «cifradas»
  como si lo hiciera Alhabla: cifran Cloudflare R2 y Google Cloud en reposo.
- Admiten que no hay garantía de UE para los modelos. Telnyx está certificada en el Marco de Privacidad de Datos
  UE-EE. UU. y su DPA público (leído el 07-11) incluye cláusulas contractuales tipo.
- La redacción de datos personales (`pii_redaction`) solo vale para las llamadas de voz, no para WhatsApp: no
  decir «Telnyx guarda todo redactado».

## 8. Pendiente

- Foto del fundador y de producto en contexto para el press kit.
- Nota de prensa de lanzamiento con fecha.
- Corregir la política de privacidad (modelo de lenguaje y «cifradas») y decidir si se activa la localidad UE.
- Alinear `/prensa` con este documento (hoy dice «Titular: Miguel Martín Delgado», coherente con el aviso legal).
