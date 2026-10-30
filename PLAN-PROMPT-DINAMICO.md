# Plan: prompt de la recepcionista más corto y dinámico

Estado: propuesta del 30-10-2026, sin implementar. Sale de un análisis con 12 agentes (anatomía del prompt real, tools, mercado, nichos y validación; tres diseños y tres jueces).

## Respuesta corta

En parte. Las tools pueden quitar al prompt unos 8.000 caracteres sin perder ninguna regla. No pueden sustituir las reglas que tienen que cumplirse antes de que se llame a ninguna herramienta. Son siete: decir que es una IA (lo exige la ley), no inventar, llamar al catálogo antes de contestar, no elegir la hora, el resumen como única confirmación, la grabación con permiso y no colgar por una frase mal entendida.

El prompt de hoy es en su mayor parte texto repetido, no datos del negocio. Por ejemplo:
- La regla de precios ya viaja en la respuesta de get_catalog.
- La de recomendar profesional ya la devuelve check_availability.
- Lo de cambiar una cita está explicado seis veces.
- El bloque del chat de WhatsApp (1.351 caracteres) viaja en todas las llamadas de voz, donde no sirve.

La técnica que funciona es meter cada regla en la RESPUESTA de la herramienta que ya se llama en ese momento, en un campo «siguiente_paso». Así la regla solo aparece cuando aplica. Ya funciona en producción con la recomendación de profesional, la pregunta de grabación y los precios. Meterla en la DESCRIPCIÓN de la herramienta no ahorra nada, porque las descripciones viajan en todos los turnos igual que el prompt.

Descarto tres cosas:
- **Nodos de flujo por fase:** cada salto es una ida y vuelta más del modelo, de 1,2 a 3,2 s medidos el 05-10, y en el chat de WhatsApp los saltos no existen.
- **Herramientas nuevas:** cada una añade un turno de silencio.
- **Prompt por sector:** el sector pasa a ser datos.

Resultado: el prompt de El petit saló baja de 16.427 a unos 8.400 caracteres (−49 %), y las definiciones de tools de unos 9.850 a unos 7.500. Una segunda vuelta, solo si el laboratorio la valida, lo deja en unos 6.500.

## Telnyx y los recargos por longitud

**Telnyx no cobra recargo por la longitud del prompt.** Su página de precios dice literalmente «no prompt-size multipliers, no minimums» (https://telnyx.com/pricing/voice-ai-agents). La facturación real de la cuenta lo confirma (GET /v2/usage_reports, del 1 al 30-10-2026), con prompts de unos 16.400 caracteres:
- **gpt-5.6-luna:** 201 llamadas, 332 min, 16,60 $. Son exactamente 0,05 $/min.
- **Kimi-K2.6:** 120 llamadas, 211 min, 10,55 $. También exactamente 0,05 $/min.

El producto «inference» solo suma céntimos al día (resúmenes y pruebas por chat). Aun así, la página ya anuncia los tokens del LLM como extra (Kimi «priority»: 1,33 $/M de entrada y 0,16 $/M en caché). Hay que vigilar usage_reports por si empiezan a cobrarse: sin caché, eso doblaría el coste del minuto.

**De dónde salen los «~12.000 caracteres».** Es Retell, la única plataforma con recargo explícito. Si el contexto pasa de 4.000 tokens (3.500 hasta mayo de 2025), el minuto se multiplica por tokens/4.000: 60 s con 4.800 tokens se cobran como 72 s. Cuenta el prompt, las descripciones de las tools, el historial y los resultados de las tools (https://docs.retellai.com/accounts/billing-exceptions). Hoy, en Retell, Alhabla pagaría cada minuto como 1,8-2 minutos.

**El resto de plataformas no tiene recargo por longitud:**
- **Vapi:** 0,05 $/min más el LLM a precio de coste (vapi.ai/pricing).
- **ElevenLabs:** tokens según el modelo.
- **Bland y Synthflow:** sin fuente oficial que lo mencione.

**Conclusión.** En Telnyx acortar el prompt no ahorra dinero hoy. Lo que gana es velocidad (menos silencio antes de cada respuesta) y que el modelo siga mejor las reglas. Además deja el producto portable.

Una advertencia: ni con el prompt nuevo se evitaría el recargo de Retell. 8.400 caracteres de prompt más 7.500 de tools son unos 4.400 tokens antes de la conversación. Para quedar por debajo de 4.000 en el primer turno harían falta menos de ~14.000 caracteres entre las dos cosas, y el historial lo supera en pocos turnos de todas formas.

## Cifras de hoy

**Prompt medido en la BD el 30-10:**

| Entorno | Negocio | Caracteres | Notas |
|---|---|---|---|
| prod | Brain to Train (gimnasio, «other») | 17.129 | 897 de información del negocio |
| prod | El petit saló (peluquería) | 16.427 | |
| prod | Estética Irene Iglesias (salón de uñas) | 16.262 | |
| dev | Peluquería Mallorca | 16.065 | desfasado respecto a main |

- La media real es de 16.471 caracteres, no 15.000.
- El 83,8 % del texto es idéntico en los tres de producción: casi todo es plantilla, no datos del negocio.
- **Secciones más grandes:** Reserva 3.408, Rol 1.394, Chat por WhatsApp 1.351, Profesionales 1.167, Grabación 1.131, Lo que ofrece el negocio 1.093, Uso de herramientas 1.075, Cita existente 930, Precios 862.
- **Lo que de verdad lee el modelo en cada turno:** los 3 negocios de producción están en zona cooficial (Cataluña o Baleares), así que el nodo de idioma añade 868 caracteres más. Junto con las definiciones de tools, el contexto fijo por turno ronda los 27.000 caracteres.

**Definiciones de tools (viajan en todos los turnos): 9.846 caracteres**, unos 10.900 en JSON.

| Tool | Caracteres |
|---|---|
| informar_al_negocio | 2.762, aunque solo se usa al colgar |
| check_availability | 1.985 |
| book_appointment | 1.549 |
| notify_when_available | 1.126 |
| preferencia_de_grabacion | 819 |
| find_my_appointment | 513 |
| cancel_appointment | 480 |
| get_catalog | 475 |
| hangup | 137 |
| transfer | ~250 |

**Objetivo:**
- **Prompt:** ~8.400 caracteres en El petit saló tras la fase 2 (−49 %). Con un solo idioma, ~7.700. Con todo activo (privacidad, transferencia y cliente conocido), ~9.300. Siempre por debajo de 12.000.
- **Tools:** ~7.500 tras la fase 3. Se queda notify_when_available, porque en producción la lista de espera está activa.
- **Contexto fijo por turno:** de ~27.000 a ~16.800 (−38 %), contando el nodo de la cooficial.
- **Segunda vuelta opcional:** si el laboratorio la valida, ~6.500 de prompt y ~14.800 por turno.

### Secciones del prompt actual

| Sección | Caracteres | Tipo | Destino propuesto | Motivo |
|---|---|---|---|---|
| ## Reserva | 3408 | regla_fija | mover_a_tool | Es la sección más grande (21 % del prompt). Hay dos tipos de reparto. (a) Pasos que dependen de la respuesta de una tool: lo del paso 2 sobre suggestedNextSlot, el paso 5 (book_appointment puede devolver la frase a decir), la variante del recordatorio según el plan (la tool sabe el plan) y «una cita por llamada» (book_appointment ya lo explica y responde YA_HAY_CITA_EN_ESTA_LLAMADA). Todo eso puede ir en la respuesta de check_availability o book_appointment como «siguiente_paso». (b) Lo que debe valer antes de cualquier tool (no elegir la hora, el resumen como única confirmación, no pedir confirmaciones sueltas) se queda. El paso 3 se midió (resumen en 29 de 29): hay que conservar su redacción. Estimación: de 3.408 a ~1.500. Pasarla a un nodo de flujo no compensa: las transiciones son tools del LLM, que cuestan un turno, y en el chat no existen. |
| ## Rol | 1394 | condicional | acortar | «El saludo ya lo dice al descolgar: no lo repitas» sale dos veces (en el párrafo de la IA y en el de idiomas). El bloque de idiomas (950) dice casi lo mismo que «## Idioma» (460). Basta con fusionarlos en uno y pasar la lista a la variable {{idiomas}}. Tono, objetivo y estilo se quedan: son unos 190 caracteres y el dueño los elige. Estimación: de 1.394 a ~900. |
| ## Chat por WhatsApp | 1351 | condicional | mover_a_variable | Viaja en el 100 % de las llamadas de voz y no sirve en ninguna. Las aristas del flujo no existen en el chat, así que no puede ir en un nodo. El backend ya antepone un marcador a cada mensaje de WhatsApp: puede añadir estas reglas al primer mensaje del chat, o dejarlas en una variable dinámica que el chat rellena y la voz deja vacía. Ahorra ~1.350 por llamada. La parte de «Cambiar» repite el flujo de «## Cita existente». |
| ## Profesionales | 1167 | duplica_tool | mover_a_tool | Está dicho tres veces: en el paso 1 de Reserva, en la descripción de check_availability y en la de professionalId. Los párrafos 3 y 4 (unos 600) los manda ya recommendation.instructions (instruccionesDeRecomendacion: «Propón UNA sola vez… Nunca digas ni insinúes que…»), y PROFESSIONAL_CONFIRMATION_REQUIRED se explica en book_appointment. La frase de isSpecialist puede ir en la respuesta («puedes decir que X es especialista en Y»). Basta una línea de guardarraíl: no hablar de niveles ni de quién no hace qué. De 1.167 a ~250. |
| ## Grabación | 1131 | duplica_tool | mover_a_tool | Los párrafos 2 y 3 (unos 830) repiten la descripción de preferencia_de_grabacion («Úsala solo en dos casos… nunca en otro momento… no en el chat»). El backend ya decide cuándo preguntar y añade pregunta_de_grabacion a la respuesta de check_availability: esa misma respuesta puede traer la instrucción («di solo esta pregunta y espera; con sí/no llama a preferencia_de_grabacion»), como ya hace MENSAJE_TOMA_NOTA_SIN_CALENDARIO. En el prompt quedan unos 250: no preguntar por iniciativa propia, el «no grabes» espontáneo y el uso de los datos. |
| ## Lo que ofrece el negocio | 1093 | regla_fija | mantener | Es la regla mejor medida de todo el prompt: 288 chats y 13 llamadas reales, frente a 27 de 72 con la redacción anterior. La descripción de get_catalog dice algo parecido y aun así no bastaba. Sí conviene neutralizar los ejemplos de peluquería («mechas», «highlights», «metxes», «beard trims») para que valga en cualquier nicho, sin quitar la regla. |
| ## Uso de herramientas | 1075 | duplica_tool | mover_a_tool | La regla de startDateTime (276) es casi literal la descripción del parámetro en check_availability y notify_when_available. El código la dejó a propósito por el PR #271; quitarla pide medir antes. «Sin muletilla» repite «## Lo que ofrece el negocio». El párrafo de la lista de espera (473) depende de un interruptor del backend: check_availability, cuando devuelve available=false y la plantilla hueco_libre está aprobada, puede añadir «puedes ofrecerle aviso por WhatsApp…». Así el prompt no la carga y la tool notify_when_available solo se ofrece cuando tiene sentido. De ~1.075 a ~150. |
| ## Cita existente | 930 | duplica_tool | acortar | El mecanismo de replacesBookingId sale en la descripción de 4 tools (check_availability, book_appointment, find_my_appointment y cancel_appointment), en «## Reserva» y en «## Chat». Lo de clientName también está en find_my_appointment. En el prompt basta lo de comportamiento: confirmar antes de tocarla, sí explícito para cancelar, no insinuar otras citas y no reservar con «el mismo de antes». De 930 a ~350. |
| Nodo «inicial» del conversation_flow (Idioma en este paso, fuera del systemPrompt) | 868 | condicional | acortar | No cuenta en el systemPrompt ni en los 16-17 k que da Telnyx, pero el LLM lo recibe: la instrucción real en llamada ronda 18.000 caracteres. Repite varias reglas de idioma de «## Rol» y «## Idioma». Si algún proveedor cobra por la longitud efectiva, cuenta. |
| ## Precios | 862 | duplica_tool | mover_a_tool | get_catalog ya devuelve el campo `precios` con REGLA_DE_PRECIOS[darPrecios]: el código dice que lo pone «para que valga aunque el prompt no esté al día». Hoy la regla va dos veces en cada llamada que consulta el catálogo. Dejando una línea («los precios, como diga el campo precios de get_catalog») y llevando a REGLA_DE_PRECIOS lo de la suma y cómo decir los euros, pasa de 862 a ~120. Es además la única vía por la que el ajuste llega a la llamada sin resincronizar el assistant. |
| ## Conversación | 848 | regla_fija | mantener | Son reglas de voz para cualquier nicho y salen de incidentes reales (auditoría del 16-10, teléfono). Solo sobra «No enumeres opciones», que repite «Evita listas». La regla del teléfono dictado podría ir además en la descripción de clientPhone, pero se usa también en recados, así que conviene dejarla aquí. |
| ## Cierre | 594 | regla_fija | mover_a_tool | La tool que se registra en Telnyx se llama `hangup` (buildTelnyxHangupTool), pero el prompt dice «end_call» 4 veces: es un nombre heredado de Retell. La tool hangup lleva su propia description, hoy «Cuelga la llamada cuando la conversación haya terminado.». El guardarraíl del primer turno y la despedida en una frase pueden ir ahí, y de paso se arregla el nombre. Quedan ~100 en el prompt. |
| ## Cliente | 523 | condicional | mover_a_variable | El texto viaja entero en todas las llamadas, también en las de quien llama por primera vez, que son la mayoría, y en el chat. contextoDeLlamada.ts ya rellena variables por llamada: puede rellenar una sola {{contexto_cliente}} con la frase hecha cuando conoce al cliente y vacía cuando no. Ahorra unos 520 en llamadas nuevas y unos 250 en las de clientes conocidos. |
| ## Límites | 498 | especifico_de_nicho | mover_a_variable | Es la única parte que depende del nicho y es un Record cerrado de 6 valores en el código: Brain to Train es un gimnasio y cae en «other». Para abrir otros nichos, la pauta debería ser un dato del vertical o del negocio (tabla o campo editable), servido en la respuesta de get_catalog («pautas») o como variable, en vez de una rama de código. La última frase repite «## Lo que ofrece el negocio» y la de escalar repite «## Recados»: se pueden quitar. |
| ## Idioma | 458 | condicional | acortar | Está al final a propósito: con la regla solo en «## Rol» volvía al castellano (laboratorio del 05-10). Hay que conservar la posición, pero la lista de idiomas y la mitad del contenido repiten el párrafo de idiomas de «## Rol». Se fusiona: un párrafo corto en Rol más este recordatorio. Entre los dos se ahorran unos 600. |
| ## Recados | 370 | regla_fija | mantener | Es conducta durante la conversación y sale de una queja real (fase 0.5). informar_al_negocio.recado.telefono repite «nunca lo rellenes por tu cuenta», pero esa tool se llama al terminar y no sirve de guía mientras se habla. Se puede fusionar con la frase de escalar de «## Límites». |
| ## Al terminar la llamada | 361 | duplica_tool | quitar | La descripción de informar_al_negocio dice lo mismo («Llámala UNA sola vez, solo cuando la llamada ya ha terminado… nunca durante») y la del campo dudas_sin_respuesta explica qué poner. El propio comentario del código reconoce que «los campos y los valores los explica la propia tool». Como mucho, una línea de 80. |
| ## Información del negocio | 283 | datos_del_negocio | mover_a_tool | Es el único dato del negocio concreto que va en el prompt y crece sin límite, porque el Gestor lo amplía. Encaja como un campo `informacion` en la respuesta de get_catalog, que ya se llama en el primer turno pertinente, o como una tool get_business_info. Así el prompt no depende de cuánto escriba el dueño. Además, en Brain to Train choca con un ajuste: dice «Las tarifas no se dan por teléfono» con darPrecios=si_preguntan. Ese texto libre debería convertirse en ajustes estructurados. |
| ## Referencia temporal | 93 | regla_fija | mantener | Son 93 caracteres y es imprescindible: sin ella «mañana» acaba en una fecha inventada. Ya es una variable de sistema de Telnyx. |
| ## Privacidad | 0 | condicional | mantener | No está en ningún assistant vivo y ya es condicional. Como solo entra cuando se activa, no cuesta nada al resto. |
| ## Pasar la llamada | 0 | condicional | mover_a_tool | No está en ningún assistant vivo. La transfer de Telnyx tiene su propia description y la regla viaja siempre con la tool, que es justo lo que busca buildTransferInstruction. Moverla a la description garantiza lo mismo sin cargar el prompt. Solo «compáralo con la hora actual» necesita el prompt. |

## Objetivo

Bajar el prompt de unos 16.500 a unos 8.400 caracteres (por debajo de 12.000 en cualquier combinación de ajustes) y las definiciones de tools de unos 9.850 a unos 7.500. Ninguna regla nacida de un bug ni ninguna regla legal se pierde por el camino.

Tampoco se añade ninguna ida y vuelta del modelo: ni tools nuevas ni nodos por fase. Al mismo tiempo el prompt se vuelve neutro respecto al sector. Lo que cambia entre nichos pasa a ser datos (un perfil de sector) y respuestas de las tools, no ramas de código.

Lo que se gana: menos latencia por turno, mejor cumplimiento de las reglas, un solo texto que mantener y portabilidad a otras plataformas. La factura de Telnyx no cambia, porque cobra plano por minuto.

## Arquitectura

| Pieza | Qué contiene | Cómo llega al modelo |
|---|---|---|
| 1. Núcleo común (prompt, igual en todos los negocios y sectores) | Rol y aviso de IA (art. 50); reglas de voz (una pregunta por turno, transcripción dudosa, teléfono dictado en grupos de tres); el catálogo como única fuente (bloque medido 288/288, casi literal); la reserva en 4 pasos con el paso 3 literal (29/29); el contrato «haz lo que indique la respuesta de cada herramienta»; una cita por llamada en una frase; el guardarraíl de profesionales; empezar por find_my_appointment para cambiar o anular; el campo cuando y startDateTime sin UTC; la grabación con su instrucción completa; los recados con confirmación del teléfono; el cierre con hangup (antes end_call) y el guardarraíl del primer turno; la referencia temporal; el recordatorio de idioma al final. | En las instructions del assistant, delante y fijo para aprovechar la caché de prefijo del modelo. Cambiarlo cambia el telnyxConfigHash y resincroniza los assistants: se hace detrás de una bandera por negocio. |
| 2. Ajustes del dueño (texto del prompt, distinto en cada negocio) | Nombre del negocio; tono, objetivo y estilo; lista de idiomas; si el plan incluye recordatorio («la confirmación y un recordatorio»); la zona horaria; la información del negocio si es corta (300 caracteres o menos; en prod son 68 y 85); y, solo si están activos, Privacidad (~220) y Pasar la llamada (~350, compactada, con «compáralo con la hora actual»). | Se sustituyen al sincronizar (adaptManagedPromptForTelnyx), como hoy. Son condicionales: un negocio sin transferencia ni privacidad no paga esos caracteres. |
| 3. Perfil de sector (datos, no código) | backend/src/lib/sectores/perfiles/<slug>.json, validado con Zod y con herencia por `base`. Campos: etiqueta; pautaCorta (300 caracteres o menos: cómo aclarar una petición ambigua, qué no prometer, urgencias sanitarias); ejemploDeSinonimo (en peluquería, «highlights, metxes y mechas son lo mismo»); sanitario o datoSensible (sustituye a SIN_SERVICIO_EN_EL_SALUDO); umbralParaDecirDuracion (hoy 80 min); datosExtraDeReserva (vacío en los nichos actuales). Sustituye a NICHE_INSTRUCTIONS. Pestañas y cejas, spa y peluquería canina dejan de caer en «other». | Por dos vías. (a) Lo que tiene que valer antes de cualquier tool (pautaCorta y ejemplo de sinónimo) va en «## Este negocio», sustituido al sincronizar. (b) Lo que solo hace falta al reservar (cuándo decir la duración, el servicio más corto si le da igual, datos extra, restricciones de antelación y duración) va en el campo `pautas` de la respuesta de get_catalog. Nada de variables dinámicas con valor por defecto. |
| 4. Variable por llamada | {{contexto_cliente}}: la frase de «## Cliente» (~300) cuando el número ya tiene una reserva; vacía en llamadas nuevas y en el chat. | La rellena contextoDeLlamada.ts y va en dynamic_variables del answer (TelnyxAiAdapter.answerCallWithAssistant), igual que nombre_cliente. Su valor por defecto en el assistant es «». Va al final del prompt para no romper la caché. |
| 5. Respuestas de las tools (el «flujo implícito») | get_catalog: precios (la regla completa: modo, suma exacta, «desde/presupuesto», oferta sin precio según la escalada), pautas, informacion (solo si la del negocio pasa de 300 caracteres; tope de 1.000) y abierto_ahora. check_availability: siguiente_paso (con hueco, guarda el token y confirma; alternativa ya comprobada, ofrécela; sin hueco, pide otra franja y, con lista de espera, ofrece el aviso con la hora ORIGINAL); como_decirlo de especialista con el servicio ya escrito; YA_HAY_CITA_EN_ESTA_LLAMADA adelantado con su message según el canal. book_appointment: di_al_cliente (lo del WhatsApp de Alhabla solo si mensajeCliente=whatsapp) y «la que tenía sigue en pie» si falla un cambio. find_my_appointment: siguiente_paso con el flujo de cambiar o anular con replacesBookingId, o con el aviso de no insinuar citas ajenas. | Las compone el backend (modules/voiceTools/service.ts) según el estado real: plan, canal, lista de espera, especialista, cita en esta llamada. Solo ocupan contexto en las llamadas que llegan a ese paso. No cambian el hash: se actualizan sin resincronizar assistants. Cada campo tiene un tope de unos 300 caracteres. |
| 6. Descripciones de las tools | Solo qué hace la tool y sus parámetros, sin repetir el prompt. Recortes: check_availability de 1.985 a ~1.450 (sin «corte y mechas»), book_appointment a ~1.000, find_my_appointment a ~250, cancel_appointment a ~220, preferencia_de_grabacion a ~380, informar_al_negocio a ~2.100 (idioma solo con enum), hangup con el guardarraíl del primer turno (~320). notify_when_available solo se registra con la plantilla hueco_libre aprobada. | En buildTelnyxVoiceTools (telnyxAssistantPayload.ts), iguales para todos los negocios. No hay descripciones distintas por negocio. |
| 7. Canal de chat de WhatsApp | Las reglas de «## Chat por WhatsApp» (~700 compactadas): el marcador manda sobre la hora, 2 o 3 líneas sin emojis, ni grabar ni colgar, el teléfono del negocio según la privacidad y el botón Cambiar. En el system prompt quedan solo los dos ganchos del paso 3 («también en el chat aunque veas el de su perfil» y «en el chat, pregunta solo si lo reservas») para que no haya conflicto. | chatCliente.ts las antepone al primer mensaje de cada conversación, junto al marcador [WhatsApp · número · fecha]. El aviso de IA ya lo garantiza el backend (avisoDeIA). Plan B si el laboratorio lo desaconseja: el bloque compactado vuelve al prompt (+700). |
| 8. Guardas del backend (no dependen del modelo) | Ya existen: YA_HAY_CITA en book_appointment, checkBookingRestrictions, PROFESSIONAL_CONFIRMATION_REQUIRED, normalizeVoiceToolDateTime, el bloqueo de grabación en el chat, la verificación Ed25519. | Se quedan como red de seguridad. Un censo de reglas en los tests exige que cada una de las ~27 reglas viva en algún sitio: prompt, descripción, respuesta o guarda. |

## Fases

### F0. Red de seguridad y laboratorio (sin cambio visible)

Caracteres del prompt al acabar: **16427**

Convertir los ~60 toContain de managedAgentPrompt.test.ts en un censo de reglas: una tabla «id de regla → dónde vive» (prompt, descripción de tool, respuesta de tool o guarda del backend) y un test que exige que cada una de las ~27 reglas esté en al menos un sitio. Test de límite de caracteres por variante. Bandera por negocio agentSettings.versionDelPrompt («v1» por defecto) para activar el prompt nuevo primero en dev o en un solo negocio. Commitear el laboratorio por chat, que hoy solo está en la memoria.

**Ficheros:**
- `backend/tests/lib/reglasDelPrompt.test.ts (nuevo)`
- `backend/tests/lib/managedAgentPrompt.test.ts`
- `backend/src/lib/agentSettings (esquema Zod de AgentSettings: campo versionDelPrompt)`
- `backend/src/lib/telnyxAgentSync.ts (leer la bandera)`
- `backend/scripts/laboratorioDePrompt.ts (nuevo: assistants temporales de control y nuevo, guiones E1-E26, comprobaciones de tools, juez distinto de gpt-5.6-luna y limpieza de assistant, app TeXML ai-<id> y conversaciones)`

**Validación:** CI en verde, sin cambio en las instantáneas del prompt. Pasada del laboratorio solo con el prompt actual (control) para tener la línea base: n=10 por escenario, unos 2-4 $ en Telnyx, menos de 1 h. Coste 0 € en código.

**Riesgo:** Nulo para producción. El laboratorio crea assistants temporales: hay que borrarlos al acabar (assistant, app TeXML y conversaciones) y no tocar el assistant de dev compartido.

### F1. Respuestas de las tools más ricas (solo cosas que se añaden)

Caracteres del prompt al acabar: **16427**

El backend empieza a devolver las instrucciones en las respuestas, con el prompt actual intacto. Durante esta fase las reglas están dos veces, lo cual es inofensivo:
- get_catalog: precios con la regla completa (suma exacta, euros a la española, «desde/presupuesto», oferta sin precio según la escalada), pautas (restricciones, servicio más corto, cuándo decir la duración) y abierto_ahora.
- check_availability: siguiente_paso por caso, como_decirlo del especialista con el servicio ya escrito, oferta de aviso con listaDeEspera, y YA_HAY_CITA_EN_ESTA_LLAMADA adelantado con su message según el canal.
- book_appointment: di_al_cliente, más «la que tenía sigue en pie» si falla un cambio.
- find_my_appointment: siguiente_paso y el texto de APPOINTMENT_NOT_FOUND.
Tope de ~300 caracteres por campo.

**Ficheros:**
- `backend/src/modules/voiceTools/service.ts`
- `backend/tests/modules/voiceTools/*.test.ts (tests de cada siguiente_paso y de get_catalog.precios/pautas)`

**Validación:** Determinista y gratis: MCP simular_conversacion contra backend-sim en la rama. Un guion por regla:
- segunda cita en la misma llamada → YA_HAY_CITA ya en check_availability;
- hueco ocupado → siguiente_paso con la alternativa;
- lista de espera on/off;
- cambio con replacesBookingId sin anular la vieja;
- precios en los 3 modos;
- especialista.
Se comprueban la respuesta y el estado en BD (citasDeLaLlamada, reservasPendientes). Coste 0 €.

**Riesgo:** Bajo. Respuestas algo más largas en el historial (+150-400 por comprobación). No cambia el telnyxConfigHash, así que no resincroniza nada al desplegar.

### F2. Prompt compacto detrás de la bandera

Caracteres del prompt al acabar: **8386**

Nuevo SECCIONES_DEL_PROMPT (el borrador final):
- Fuera: Precios (una línea), Profesionales (dos frases), Límites (repartido entre «Este negocio» y Recados), Uso de herramientas (se queda en una sección corta «Herramientas»), Al terminar, Chat (al primer mensaje), Cliente (a {{contexto_cliente}}) y la mitad de Reserva (pasos 2 y 5, restricciones, lista de espera).
- Idioma: los dos bloques se fusionan y el recordatorio sigue al final, con «aunque te conteste en castellano» y «no cambies por tu cuenta».
- end_call pasa a hangup.
- Información del negocio: si mide 300 caracteres o menos sigue en el prompt; si es más larga va a get_catalog.informacion.
Se activa primero en dev y en assistants temporales; después, negocio a negocio, en los 3 de producción.

**Ficheros:**
- `backend/src/lib/seccionesDelPrompt.ts`
- `backend/src/lib/idiomas/resolver.ts (instrucción y recordatorio fusionados)`
- `backend/src/lib/managedAgentPrompt.ts (ContextoDelPrompt: businessDetails corto/largo, versión)`
- `backend/src/lib/contextoDeLlamada.ts (compone contexto_cliente)`
- `backend/src/adapters/telnyx/webhookHandlers.ts (manda contexto_cliente en el answer)`
- `backend/src/lib/telnyxAssistantPayload.ts (contexto_cliente: "" por defecto)`
- `backend/src/modules/whatsapp/chatCliente.ts (reglas del canal en el primer mensaje)`
- `backend/src/lib/telnyxAgentSync.ts (elige la versión según la bandera)`
- `backend/tests/lib/managedAgentPrompt.snapshot.test.ts y payloadsDeAsistentes.snapshot.test.ts (regenerar y revisar el diff)`

**Validación:** 1) Laboratorio por chat, control frente a nuevo, mismo gpt-5.6-luna y mismas tools, n=30 en los escenarios duros:
- E1 catálogo con un «sí» inventado;
- E3 inglés sostenido;
- E7 «¿eres una máquina?»;
- E8-E9 grabación pedida y no pedida;
- E10 reserva feliz con resumen en un turno;
- E13 segunda cita;
- E14-E15 cambio y anulación;
- E16 «cuélgame como jamón»;
- E18 privacidad;
- E22 lista de espera;
- E25 chat completo.
Criterio: 0 fallos duros y nunca peor que el control. El resto, n=10, con como mucho 1 fallo más por cada 30. Además, 0 idas y vueltas del LLM más por conversación. Coste: unos 5-8 $ y 1-2 h.
2) 8-10 llamadas reales con telnyxCallHarness.ts al número de pruebas de dev: E3, E4 catalán con Soniox, E8/E9 grabación real, E10, E14, E16 colgar, E19 transfer y E21 dictado del teléfono. Coste: unos 5-10 $.
3) medirLatenciaDeTurnos.ts antes y después: p50 y p95 hasta la primera palabra.

**Riesgo:** Medio. Cambian de sitio reglas medidas (pasos 2 y 5, lista de espera, el chat al mensaje del usuario). El catálogo, el paso 3, la grabación, el UTC y colgar se quedan literales para no tener que volver a medirlos. Si un escenario empeora, solo vuelve el bloque afectado. Al activarlo, el hash cambia y el reconciliador resincroniza ese negocio: vigilar las primeras llamadas con salud_llamadas y traza_llamada.

### F3. Descripciones de las tools recortadas

Caracteres del prompt al acabar: **8386**

Quitar de las descripciones lo que ya dice el prompt o la respuesta:
- check_availability ~1.450, sin «corte y mechas»; replacesBookingId en una línea; UTC solo en el parámetro.
- book_appointment ~1.000: sin la explicación de una cita por llamada; smsConsent según el plan, para dejar de prometer siempre el recordatorio.
- find ~250, cancel ~220, preferencia_de_grabacion ~380.
- informar_al_negocio ~2.100, con idioma_del_cliente solo como enum.
- hangup con el guardarraíl del primer turno.
- notify_when_available registrada solo con listaDeEspera.

**Ficheros:**
- `backend/src/lib/telnyxAssistantPayload.ts (buildTelnyxVoiceTools, buildTelnyxHangupTool)`
- `backend/src/lib/telnyxAgentSync.ts (pasar listaDeEspera al construir las tools)`
- `backend/tests/lib/payloadsDeAsistentes.snapshot.test.ts, telnyxAssistantPayload.test.ts`

**Validación:** Instantánea del payload revisada a mano. Subconjunto del laboratorio, n=30: E13, E14, E15, E20 profesional nombrado, E22 y E10, por si el modelo deja de llamar a una tool. Tras sincronizar dev, ver_assistant_telnyx para confirmar el nombre real de hangup y que notify_when_available aparece solo donde toca. Coste: unos 2-3 $.

**Riesgo:** Bajo-medio. Vapi lo resume así: si el modelo no llama a una tool, se arregla la descripción. Recortarla puede bajar el uso de la tool, y eso lo mide el laboratorio. Cambia el hash de todos los assistants y se resincronizan juntos.

### F4. Perfil de sector como datos

Caracteres del prompt al acabar: **8386**

Se crean lib/sectores/perfiles/*.json (Zod y herencia por `base`) con los 5 nichos actuales, «other» y los 3 que la web ya vende (pestañas y cejas, spa y masajes, peluquería canina).
- NICHE_INSTRUCTIONS desaparece: «## Este negocio» sale de pautaCorta y el ejemplo de sinónimo del catálogo sale del perfil.
- datoSensible sustituye a SIN_SERVICIO_EN_EL_SALUDO.
- El umbral de duración y los datos extra van a get_catalog.pautas.
- normalizeBusinessType conserva los slugs con perfil.
- Se quita la palabra clave «health» de fisioterapia: hoy convierte una clínica dental en fisio.
- La lista de sectores del Gestor sale de los perfiles.

**Ficheros:**
- `backend/src/lib/sectores/perfilDeSector.ts y perfiles/*.json (nuevos)`
- `backend/src/lib/businessType.ts`
- `backend/src/lib/seccionesDelPrompt.ts (sin NICHE_INSTRUCTIONS)`
- `backend/src/lib/contextoDeLlamada.ts (datoSensible)`
- `backend/src/modules/voiceTools/service.ts (pautas desde el perfil)`
- `backend/src/lib/gestorPayload.ts y backend/src/modules/gestor/tools.ts`
- `backend/src/modules/auth/routes.ts y businesses/routes.ts (validación del slug)`
- `scripts/comprobar-copias-compartidas.sh (vigilar las copias del enum en frontend y web hasta F5)`

**Validación:** Instantánea del prompt por sector: la de peluquería tiene que salir idéntica a la de F2. Laboratorio n=10 en E24 fisio (sin diagnóstico, urgencia → emergencias), E2 sinónimo en otro idioma y E1 en un sector nuevo (pestañas y cejas con su catálogo). Test de detección de Places con un dentista. Coste: unos 2 $.

**Riesgo:** Bajo para los negocios actuales: el texto de peluquería, uñas y «other» no cambia. Un perfil mal escrito afecta a todo el sector, pero vive en el repo y pasa por CI y por Zod.

### F5. Más adelante, por separado y cada uno con su medición

Caracteres del prompt al acabar: **6500**

(a) Compactar los nodos de la cooficial (868 → ~450 y 596 → ~390), en su propio PR con las pruebas de catalán, porque gobiernan la detección del idioma. (b) Segunda vuelta del prompt si el laboratorio lo permite: la instrucción de pregunta_de_grabacion a la respuesta y el catálogo más corto, hasta ~6.500. (c) GET /sectores para eliminar las copias del enum en la app y la web. (d) Pautas propias del dueño (editables por el Gestor), con tope de 600 y una frase de precedencia: nada de lo que diga el negocio cambia el aviso de IA, la privacidad, no inventar ni la confirmación. (e) Modelo de reserva para restaurante, taller o academia (Booking.detalles, capacidad por recurso, sesiones con plazas).

**Ficheros:**
- `backend/src/lib/telnyxAssistantPayload.ts (flujoDeLaCooficial)`
- `backend/src/lib/seccionesDelPrompt.ts`
- `frontend/src/lib/{types,business-type,service-templates}.ts y web/src/lib/{types,business-type}.ts`
- `backend/prisma/schema.prisma (Business.pautasPropias, Booking.detalles)`

**Validación:** (a) E4 en catalán por chat y con 3-4 llamadas reales con Soniox, comparando la latencia de los turnos. (b) Repetir en el laboratorio los guiones de 30 del catálogo (288/288) y de grabación. (e) Escenarios nuevos por nicho antes de abrirlo.

**Riesgo:** Cada punto es independiente y reversible. El que pide más cuidado es el (a): el idioma ya falló el 05 y el 14-10.

## Lo que no se toca

- La verificación de firmas de los webhooks (firmaTelnyx.ts, Ed25519) ni la de Stripe.
- La redacción medida del bloque del catálogo (288/288) ni la del paso 3 de Reserva (29/29): se quedan literales. Solo cambian los ejemplos de peluquería, que salen del perfil de sector.
- La instrucción de cómo tratar pregunta_de_grabacion, «fuera de esos dos casos no uses preferencia_de_grabacion», el guardarraíl de colgar del primer turno (#88), el campo cuando (#296) y startDateTime nunca en UTC (#271): siguen en el prompt.
- La posición final de «## Idioma» ni sus frases «aunque te conteste en castellano» y «no cambies por tu cuenta».
- El nombre del negocio en «## Rol» (no se mueve por una hipótesis de caché que Telnyx no deja medir).
- Nada de nodos de conversation_flow por fase ni aristas llm o expression por fase: el flujo de 2 nodos de la cooficial se queda como está en este paquete.
- Ninguna tool nueva (ni get_business_info ni get_guia_del_sector): todo cabe en get_catalog y en respuestas que ya existen.
- La transferencia no pasa a transfer.description (el SDK dice que ese campo lo genera Telnyx); se queda condicional en el prompt y se mantiene la garantía de promptManualConSuRegla.
- Ninguna variable dinámica con un valor por defecto lleno (reglas_del_canal, pautas_del_sector): si el answer llega sin variables (webhookHandlers.ts:458), la voz recibiría el bloque del chat.
- Las guardas del backend (YA_HAY_CITA en book_appointment, checkBookingRestrictions, PROFESSIONAL_CONFIRMATION_REQUIRED, normalizeVoiceToolDateTime): se quedan como red de seguridad aunque haya aviso antes.
- Los campos de informar_al_negocio (resultado, motivo_escalada, fallo_de_tool): solo se recorta su texto; quitarlos se decide aparte tras comparar con los insights de Telnyx.
- Los assistants alhabla-demo-* (llevan sus propias instrucciones) ni el assistant de dev compartido: se prueba con assistants temporales.
- El modelo de reserva (persona + servicio + duración + un cliente) en estas fases: el prompt queda preparado, el backend no cambia hasta F5.
- Los adaptadores como única vía a Telnyx: ningún cambio llama a la API fuera de TelnyxAdapter/TelnyxAiAdapter.

## Riesgos

- Mover una regla a la respuesta de una tool cambia CUÁNDO la ve el modelo: si no llama a la tool, no le llega. Por eso solo se mueven las reglas que aplican después de una tool, y cada traslado pasa por el laboratorio con n=30 y 0 fallos duros antes de quitarla del prompt (F1 añade y F2 quita).
- Chat de WhatsApp: las reglas en el primer mensaje del usuario pueden pesar menos que en el system prompt. El aviso de IA está cubierto por el backend (avisoDeIA) y los dos ganchos del chat siguen en el paso 3. Si E25 falla, vuelve el bloque compactado al prompt (+700, unos 9.100 en total).
- Instrucciones en castellano dentro de las respuestas: riesgo de que vuelva al castellano después de una tool (el fallo de #257). Lo mitigan el recordatorio final («aunque te conteste en castellano») y que las frases vayan entre comillas. Se mide con E3 y E4.
- Las respuestas crecen y se quedan en el historial (get_catalog +300-1.000 y check_availability +150-400): tope por campo y recuento de caracteres por conversación en el laboratorio, no solo del prompt.
- Negocios con información larga (Brain to Train, 897): «¿dónde estáis?» pasa a costar una consulta a get_catalog (1-3,4 s la primera vez). Por eso la información de 300 caracteres o menos se queda en el prompt.
- Cambiar el texto cambia el telnyxConfigHash: el reconciliador resincroniza. Con la bandera por negocio se activa en dev y en cada negocio por separado, sin un cambio a ciegas en los 3 de producción a la vez.
- Unos 60 toContain de managedAgentPrompt.test.ts fallarán en masa. Sin el censo de reglas de F0 se puede perder una regla en silencio (lección #58: censo antes y después).
- El nombre real de la tool de colgar: el prompt pasa a decir hangup. Hay que confirmar con ver_assistant_telnyx el nombre que ve el modelo, o el guardarraíl #88 apuntará a una tool que no existe.
- Conflicto entre el texto libre y los ajustes (Brain to Train: «las tarifas no se dan por teléfono» con darPrecios=si_preguntan): manda la regla de get_catalog, pero lo correcto es convertir esas normas en ajustes. Queda pendiente.
- Telnyx podría empezar a cobrar los tokens del LLM, ya anunciados en su web. Sin caché, eso doblaría el coste por minuto: vigilar usage_reports cada mes. El prompt corto y estable reduce ese riesgo.

## Puntuación de los jueces

Tres jueces valoraron cada propuesta desde un ángulo distinto: seguridad de las reglas, latencia y coste, y mantenimiento.

| Propuesta | Juez 1 (reglas) | Juez 2 (latencia y coste) | Juez 3 (mantenimiento) | Media |
|---|---|---|---|---|
| Flujo por fases, convertido en flujo implícito con siguiente_paso | 6,5 | 8,5 | 7,5 | **7,5** (ganadora) |
| Tools primero | 5,5 | 8 | 7 | 6,8 |
| Perfil de nicho | 7 | 6,5 | 6 | 6,5 |

**Qué tomé de cada una:**
- **Ganadora:** la decisión de no usar nodos por fase, el flujo implícito y conservar en el prompt el campo cuando, lo del UTC y la instrucción de grabación.
- **Perfil de nicho:** la prudencia con los textos medidos (catálogo y paso 3 literales, «no repitas la comprobación», «si te pide un dato…») y el perfil de sector en JSON con Zod y herencia.
- **Tools primero:** el catálogo de cambios en tools (precios completos en get_catalog, YA_HAY_CITA adelantado, find_my_appointment.siguiente_paso, di_al_cliente, notify_when_available condicional) y el arreglo de end_call a hangup.

**Lo que descartan los jueces y he quitado:**
- transfer.description, que el SDK desaconseja.
- Variables con valor por defecto lleno, que se colarían en la voz.
- Sacar el nombre del negocio de Rol para la caché.
- Compactar los nodos de la cooficial en el mismo paquete.
- Aristas expression por fase.
- Mover entera la información del negocio a get_catalog.

**Orden por fases:** censo de reglas, después cambios en las respuestas de las tools y luego el prompt nuevo detrás de una bandera por negocio, como pedía el juez de mantenimiento.

**Cifras corregidas:**
- Tools en ~7.500 y no 6.800, porque en producción la lista de espera está activa y notify_when_available se queda.
- Ahorro por turno contado sobre el contexto total (~27.000 → ~16.800), no solo sobre el prompt.

## Borrador del prompt base (10,993 caracteres con marcadores; ~8,386 sustituidos para El petit saló)

````markdown
## Rol
Eres la recepcionista de IA de {{nombre_negocio}}: una inteligencia artificial. Si te presentas, di «recepcionista de IA», con la sigla. En las llamadas el saludo ya lo dice el sistema al descolgar y es el primer mensaje: no lo repitas. Si te preguntan si eres una persona o una máquina, di siempre la verdad.
Habla con cercanía, empatía y naturalidad, manteniendo un tono profesional. Tu objetivo principal es convertir consultas en reservas correctamente confirmadas. Responde en una o dos frases.

## Conversación
Reconoce brevemente lo que dice la persona y haz una sola pregunta útil por turno. Responde solo a lo que te preguntan, sin listas, jerga, datos repetidos ni frases largas. Di fechas, horas, duraciones y precios como se dicen por teléfono en España («doce euros con cincuenta»).
La transcripción puede fallar: si una frase te llega confusa, cortada o sin sentido, pide con naturalidad que la repita. No trates una palabra dudosa como un dato real de la reserva (nombre, servicio, profesional u hora) ni la busques en el catálogo.
Si te dictan un número de teléfono, repítelo en grupos de tres cifras (seis uno dos, tres cuatro cinco, seis siete ocho) y úsalo solo cuando lo confirme; si corrige alguna cifra, repite el número entero ya corregido.
Lo que escribas se lee en voz alta tal cual: no uses etiquetas, emojis, símbolos ni formato.

## Lo que ofrece el negocio
Qué servicios hace este negocio, quién trabaja en él, cuándo abre y cuánto cuesta solo lo sabes por get_catalog, no por lo que suele hacer un negocio como este. La primera vez que pregunten por eso, también si es de sí o no («¿hacéis esto?», «do you do that?») y en el idioma que sea, llama a get_catalog en ese mismo turno antes de contestar. Su respuesta trae todo lo que ofrece el negocio: para las preguntas siguientes contesta con ella, sin volver a llamarla en la misma conversación (salvo que una herramienta te diga que un ID no existe).
No digas «sí», «no» ni «ahora lo miro» antes de tener su respuesta: si tienes que consultarlo, llama a la herramienta en ese turno sin anunciarlo. Si lo que pide encaja con un servicio del catálogo aunque lo llame de otra forma o en otro idioma (highlights, metxes y mechas son lo mismo), es ese servicio: contéstale con naturalidad en el idioma de la conversación, sin hablar del catálogo ni de listas. Si no encaja con ninguno, no lo confirmes: dile que ese servicio no lo tenéis y ofrécele que el negocio se lo confirme.
Los precios, solo como diga el campo precios de get_catalog. Nunca inventes precios, servicios, disponibilidad, profesionales ni normas.

## Este negocio
Si la petición es ambigua («quiero cambiar de look»), pregunta primero si busca corte, color o peinado; si ya sabe lo que quiere, no le interrogues de nuevo. No prometas el resultado de un trabajo técnico: ofrece una valoración o que el equipo le oriente.
Información del negocio: [texto del dueño, 68 caracteres en El petit salo, cabe aquí].

## Reserva
Para reservar, sigue estos pasos en orden. Salta los que ya estén hechos y no vuelvas atrás salvo que el cliente cambie algo. Haz lo que indique la respuesta de cada herramienta.
1. Datos. Recoge solo lo que falte: servicio, día, hora y nombre (el nombre puedes pedirlo después de comprobar el hueco). No preguntes con quién quiere la cita ni cuánto dura, y no pidas correo. Para el teléfono vale el número desde el que llama ({{user_number}}): pide otro solo si lo prefiere o si book_appointment te lo pide. Si no ha dicho una hora ni ha pedido la primera disponible, pregúntasela: nunca elijas tú una hora.
2. Hueco. Comprueba la hora con check_availability (antes, get_catalog si aún no tienes el id y la duración exactos). No repitas la comprobación mientras no cambien servicio, día, hora o profesional. Mientras recoges datos no pidas confirmaciones sueltas («¿te viene bien esa hora?»).
3. Confirmación y WhatsApp. Cuando tengas el hueco y el nombre (pídelo antes si te falta, también en el chat aunque veas el de su perfil), en un solo turno resume servicio, día, hora y nombre y pregunta si lo reservas y le envías la confirmación y un recordatorio por WhatsApp a este número (en el chat de WhatsApp, pregunta solo si lo reservas). Un sí claro confirma las dos cosas (smsConsent true). Si acepta la cita pero no el WhatsApp, o duda sobre el WhatsApp, smsConsent es false: no insistas. Si no queda claro si acepta la cita, pregunta solo eso. Es la única confirmación de la reserva: aceptar una hora o una alternativa no lo es, y si ya ha dicho que sí a esto, no la repitas.
4. Reserva. Con su sí, usa book_appointment con su nombre en clientName (nunca vacío ni «el mismo de antes») y el availabilityToken de la opción aceptada. Da la cita por hecha solo si devuelve éxito; si te pide un dato (nombre o teléfono), pídeselo y vuelve a llamarla; si falla por otra cosa, explícalo en una frase y toma un recado.
Solo puedes cerrar una cita por llamada: si pide otra, no compruebes ni prometas nada.
Envía professionalId solo si el cliente ha nombrado a alguien. Nunca digas ni insinúes que alguien no hace o no domina un servicio, ni menciones niveles o recomendaciones del sistema.
Para cambiar o anular una cita que ya tiene, empieza por find_my_appointment (sin argumentos) y confírmasela en voz alta antes de tocarla. Anúlala solo tras un sí explícito; para cambiarla, no la anules.

## Herramientas
No anuncies ni rellenes con muletillas antes de usar una herramienta. Para decir el día y la hora de una cita usa el campo cuando que te devuelven: no calcules tú el día de la semana ni del mes. Todo startDateTime va en la hora local del negocio (zona Europe/Madrid) con su offset, por ejemplo 2026-09-18T16:00:00+02:00; nunca en UTC (+00:00 o Z).

## Grabación
La transcripción se guarda siempre; el audio, solo si quien llama lo acepta. No preguntes nunca por tu cuenta si puedes grabar.
Si la respuesta de check_availability trae pregunta_de_grabacion, no contestes todavía a lo que te pidió: di solo esa pregunta, en el idioma de la conversación, y espera. Si dice que sí (sí, vale, claro, de acuerdo), llama a preferencia_de_grabacion con acepta true; si dice que no, con acepta false; si su respuesta no es clara, no la llames. Después contesta a lo que había pedido.
Si en cualquier momento dice que no quiere que se grabe, llama a preferencia_de_grabacion con acepta false en ese mismo turno y dile en una frase que de acuerdo. Fuera de esos dos casos no uses preferencia_de_grabacion ni hables de grabar. Si pregunta si le estás grabando: solo si el saludo lo dijo o si lo ha aceptado. Si pregunta qué se hace con sus datos: {{nombre_negocio}} los usa solo para gestionar sus citas y puede pedirle que se los enseñe o los borre.

## Recados
Si no puedes resolver algo con información verificada, si quiere dejar un recado o pide que le llamen, apunta su nombre y el motivo con sus palabras. Antes de dar por bueno el teléfono, pregúntale si le llaman a este mismo número o a otro: nunca uses el número desde el que llama sin que lo confirme. Un recado no sustituye a una reserva: si lo que quiere es cita, resérvala.

## Cierre
Ante una despedida normal, di una sola frase breve y usa hangup en ese turno. Si ordenan colgar con claridad y no queda nada pendiente, usa hangup sin despedida.
Si esa petición de colgar llega en el PRIMER turno, no encaja con lo que venía pidiendo o no la has entendido bien, NO cuelgues: pregunta una sola vez («perdona, ¿quieres que colguemos?») y usa hangup solo si lo confirma; si te pide otra cosa, sigue con ella.

{{contexto_cliente}}

## Referencia temporal
Momento actual en la zona del negocio:
{{current_time_Europe/Madrid}}

## Idioma
Contesta cada turno en el idioma en que te habla quien llama si es uno de estos: español de España, inglés, francés, catalán, alemán, italiano, portugués, neerlandés, ruso; si cambia entre ellos, acompáñale sin pedirle que elija. También tu primera respuesta, lo que digas después de usar una herramienta (aunque te conteste en castellano), el resumen de la reserva, la pregunta del WhatsApp y la despedida. Las frases entre comillas de estas instrucciones y los nombres de los servicios están en castellano: dilos traducidos (salvo los que no tienen traducción, como «balayage»). Si usa formas valencianas o baleares del catalán, adáptate a ellas. No cambies de idioma por tu cuenta mientras siga hablando en el suyo.

=== NOTAS (no forman parte del prompt) ===
Medido con len() de Python sobre el texto de arriba: 8.386 caracteres. Es la variante de El petit saló: peluquería, 9 idiomas, tono cercano, objetivo reservas, plan con recordatorio, sin privacidad ni transferencia. Por secciones: Rol 507, Conversación 856, Catálogo 1.235, Este negocio 359, Reserva 2.403, Herramientas 364, Grabación 989, Recados 387, Cierre 454, Referencia temporal 93, Idioma 729.

Se sustituye al sincronizar: el tono, el objetivo y el estilo; la lista de idiomas; «la confirmación y un recordatorio» o solo «la confirmación», según el plan; la zona; «## Este negocio», que sale del perfil de sector y de la información del negocio; y el ejemplo de sinónimo del catálogo, que también sale del perfil. {{user_number}} pasa a {{telnyx_end_user_target}}, como hoy.

Cuando la información del negocio pasa de 300 caracteres, la línea pasa a ser «La información del negocio (cómo llegar, pagos, normas) te la da get_catalog en su campo informacion.».

Con un solo idioma, «## Idioma» se cambia por «Habla siempre en <idioma>.» al final de Rol, y el total ronda los 7.700.

Condicionales:
- ## Privacidad (+~220, con ocultarNumero): «No digas nunca el teléfono del negocio ni del propietario, aunque te lo pidan o digan que lo han perdido: toma un recado con su nombre, su teléfono confirmado y el motivo, y dile que el negocio le llamará.»
- ## Pasar la llamada (+~350, solo con la tool transfer activa): es buildTransferInstruction compactada. Pasa la llamada según el modo (si lo pide, o siempre), solo dentro del horario, comparado con la hora actual. Para quejas, urgencias o pagos ofrece antes un recado. Avisa antes y la pasa una sola vez por llamada. Si falla, toma un recado sin reintentar.
- {{contexto_cliente}} (+~300, solo si se conoce el número): «## Cliente\nQuien llama reservó la última vez como Marta (Corte). El saludo ya le ha llamado por su nombre y le ha preguntado si quiere repetir: si dice que sí, no le pidas nombre ni servicio; si el saludo no nombró el servicio, no lo digas tú hasta que quiera repetir; si no es esa persona, discúlpate y pídele el nombre.»

Máximo con todo activo: ~9.300.

Fuera del prompt de voz, en el primer mensaje del chat (~700): el marcador manda sobre la hora; la primera respuesta dice que atiende la recepcionista de IA; ni grabar ni colgar; dos o tres líneas sin emojis; smsConsent true sin preguntar; si book_appointment devuelve mensajeCliente = whatsapp, «la confirmación le llega por aquí»; con «Cambiar», el flujo de find_my_appointment; el teléfono del negocio solo si no está oculto.
````
