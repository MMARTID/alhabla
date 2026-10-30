# Afirmaciones prohibidas

Lo que Alhabla no dice en ningún texto de cara al público: ni en un correo, ni
en un formulario, ni en una ficha de directorio.

Esta tabla es la FUENTE de las afirmaciones `prohibida.*` de la base de
conocimiento. El sincronizador (`npm run growth:conocimiento`) la lee, crea una
afirmación por fila de «Reglas aplicadas» y el backend rechaza cualquier
borrador que use uno de sus términos (regla dura `sin_terminos_prohibidos`).
Una fila nueva, o un término nuevo en una fila, vale desde la siguiente
sincronización. Quitar una fila, quitar un término o pasar «Palabra entera» de
sí a no **no lo puede aplicar un token de agente**: el servidor responde 409
`prohibida_debilitada` y lo aplica un administrador (queda en el historial del
conocimiento). Un término de menos de tres caracteres útiles, con caracteres
invisibles o sin letras ni números no vale y se rechaza.

Solo entran términos que el repositorio declara de forma explícita. Los
ambiguos, los que chocan con otra decisión y los que nadie ha decidido están
más abajo, con su motivo: así nada de la lista del repo se ignora en silencio
(`npm run growth:conocimiento -- --comprobar` lo vigila).

## Reglas aplicadas

Cada término se busca como palabra entera, sin distinguir mayúsculas ni tildes
(«prompt» no salta con «prompts» ni dentro de otra palabra). Los términos van
separados por `;` y tienen al menos tres caracteres.

| Clave | Términos | Palabra entera | Motivo | Fuente |
|---|---|---|---|---|
| proveedores | Telnyx | sí | No se nombra a ningún proveedor técnico. | PRODUCT.md (Terminología del producto); PLAN-WEB-CONTENIDO.md (Vocabulario) |
| denominaciones_del_producto | recepcionista virtual; recepcionista de voz | sí | Alhabla es «una recepcionista de IA»: así se llama en titulares y en el cuerpo. | PRODUCT.md (Terminología del producto); PLAN-WEB-CONTENIDO.md (Vocabulario) |
| agenda_real | agenda real; calendario real | sí | Se dice «tu agenda» y «tu calendario». | PRODUCT.md (Terminología del producto); PLAN-WEB-CONTENIDO.md (Vocabulario) |
| promesas_de_folleto | competitividad; ventaja competitiva; productividad; 24/7; llenar la agenda | sí | Lenguaje de folleto: se habla de lo que cambia en el día de la dueña y de lo que el producto hace hoy. | PRODUCT.md (Terminología del producto); PLAN-WEB-CONTENIDO.md (Vocabulario); web/tests/lib/sectores.test.ts |
| jerga_tecnica | orquestador; webhook; prompt; LLM | sí | IA sin complejos y sin jerga técnica: se habla como habla el dueño. | PRODUCT.md (Terminología del producto; Brand Commitments) |

## Descartados (no se emiten)

El repo los nombra, pero con la comprobación actual bloquearían borradores
legítimos o chocan con otra decisión. Cada uno espera una decisión del
fundador.

| Término | Por qué no se emite |
|---|---|
| agente de voz | PRODUCT.md lo prohíbe, pero PLAN-WEB-CONTENIDO.md lo permite como nombre de la categoría de las plataformas con las que se compara (Retell, Vapi y parecidas) y las comparativas lo necesitan. |
| el Gestor | Es solo un nombre de código. «Gestor» y «gestoría» salen en correos legítimos a gestorías (objetivo B del plan). |
| tu gestor | Mismo motivo que «el Gestor»: es contextual. |
| API | PRODUCT.md la prohíbe para el producto, pero aparece en contenido propio ya publicado (el resumen de un artículo sobre WhatsApp Business) y en conversaciones con medios técnicos. |
| modelo | «Modelo de IA» sale en las comparativas (precio de Vapi y de ElevenLabs) y «modelo» es una palabra corriente del castellano. |
| persona real | Solo aparece en los tests de la web; no hay un motivo escrito en el repo. |
| ausencias | Es contextual: vale para alguien del equipo; no para clientes que no vienen. |
| Agente | Es contextual: no se usa para el papel del dueño, pero sí en «agente de voz» de las comparativas. |

## Pendiente de decidir

Lo que el repo NO dice y no se ha añadido a la tabla:

- Otros proveedores técnicos (Soniox, Deepgram, Cloud Run, Anthropic…). Retell
  no debe prohibirse: es competidor de las comparativas.
- Palabras de la prueba social que no existe (PRODUCT.md fija las categorías:
  testimonios y casos de éxito, logos y recuentos, métricas propias, premios y
  prensa; no las palabras).
- Competidores que no son comparables (HeyDiga, fonio…): se nombran con
  `growth_competidores`, no con esta lista. El sincronizador los siembra desde
  `backend/mcp/growth/conocimiento/mapa.ts` (`COMPETIDORES_ADICIONALES`:
  HeyDiga, `heydiga.ai`, y fonio, `fonio.ai`), además de las siete plataformas
  de `comparativas.ts`; **la lista está pendiente de confirmar por el
  fundador**. Con ellos sembrados, la regla dura 3 bloquea cualquier borrador
  que los nombre sin citar un dato comparativo suyo, y no hay ninguno.
- Si la jerga técnica se aplica a todos los tipos de borrador o solo a las
  fichas de directorio.
