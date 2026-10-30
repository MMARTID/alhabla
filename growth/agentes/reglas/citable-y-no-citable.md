# Qué es citable en un borrador y qué no

Un borrador lo envía el fundador a un tercero con su firma: todo lo que dice debe
poder defenderse. Por eso solo hay una fuente de verdad sobre Alhabla (la base de
conocimiento) y **la inteligencia de competidores no se cita nunca**.

## Citable

| Qué | Cómo |
|---|---|
| Una afirmación vigente de Alhabla (precio, función, límite, sector, página, comparativa) | Lee `leer_conocimiento`, usa su sentido tal cual y pon su **clave** en `afirmaciones`. Un hecho de Alhabla sin clave no va en el texto |
| Un precio o unos minutos | Solo con una clave `precio.*` (si no, la regla `precio_trazable` bloquea). «Gratis» también cuenta como precio |
| Una página de alhabla.ai | En `enlaceUrl`, una sola, con `utm_source` dentro de la URL. En el texto, sin enlaces |
| Lo que la página destino publica de sí misma (el título de su artículo, el nombre del medio, que lista a N herramientas) | Para demostrar que se la ha leído, con moderación y con tus palabras; sin pegar párrafos |

Una comparativa publicable sale **solo** de `comparativa.*` (de
`web/src/lib/comparativas.ts`). Hoy son plataformas para montar un agente propio
(Retell, Vapi y parecidas). Desde el 29-10-2026 la web no se compara con HeyDiga,
fonio ni con personas. Si no hay una clave `comparativa.*` del competidor, no hay
comparativa.

## No citable, nunca

- **Cualquier cosa de la sección Competencia**: el análisis de un competidor
  (productos, servicios, precios, planes, límites), su resumen, sus fuentes, sus
  cifras. Es inteligencia interna para el fundador; ni siquiera con fuente y
  fecha. Aunque el dato sea público y exacto.
- **El nombre de un competidor.** La regla dura `comparativa_con_fuente`
  bloquea el borrador que nombra a un competidor sin una afirmación
  `comparativa.*` de **ese** competidor, y los alias cuentan («Retell» es
  «Retell AI»; «heydiga», «fonio»). Si la página destino es una lista de
  alternativas a un competidor, no lo nombres: habla de «vuestra lista de
  alternativas» o de «las herramientas que comparáis».
- Comparaciones sin dato verificable: «más barato que», «mejor que», «a
  diferencia de otras». Es publicidad comparativa (art. 10 Ley 3/1991).
- La investigación (quién edita, vías de contacto), la puntuación, el
  presupuesto, el panel, el repositorio, `docs/` y `PLAN-GROWTH.md`.
- Cualquier cifra o promesa que no tenga clave. Si no sabes si es cierta,
  no la escribas.
- Enlaces a un sitio que no sea alhabla.ai (la regla `enlace_a_alhabla`
  bloquea cualquier URL ajena, también dentro del texto o del asunto).
- Correos, teléfonos y nombres de personas de terceros (la regla
  `sin_datos_personales` los bloquea y la investigación no los guarda).
- Un intercambio de enlaces, un pago por un enlace o un «enlace a cambio de»:
  es un esquema de enlaces (regla `sin_esquemas_de_enlaces`). Se pide revisar
  una inclusión, no un enlace.

## Entre agentes

- `growth-enlaces-y-competencia` escribe el análisis y no escribe borradores.
- `growth-redaccion` no lee la sección Competencia ni tiene herramientas para
  ello. Si el orquestador le pasa un dato de un competidor, lo ignora.
- Un competidor `propuesto` aún no aplica reglas, pero se trata igual: no se
  nombra en un borrador.
