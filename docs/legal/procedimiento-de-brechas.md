# Procedimiento ante una brecha de seguridad (arts. 33 y 34 RGPD)

Documento **interno**. Versión 1.0, 2026-11-06. Una brecha es cualquier pérdida, acceso, alteración o difusión no
autorizada de datos personales, sea por un ataque, un fallo, un error humano o un proveedor.

**Compromiso con los negocios (DPA):** avisar al negocio **sin demora y, como máximo, 24 horas** desde que se tenga
constancia razonable de la brecha. Es un plazo exigente para una sola persona: por eso este procedimiento es corto.

## 1. Quién es quién

- **Si afecta a datos que Alhabla trata como encargado** (llamadas, citas, clientes del negocio): avisa Alhabla **al
  negocio** en 24 h. El negocio es el responsable y decide si avisa a la AEPD (72 h) y a los afectados.
- **Si afecta a datos que Alhabla trata como responsable** (cuenta, facturación, contacto): Alhabla notifica a la AEPD
  en **72 h** si hay riesgo para las personas, y a los afectados si el riesgo es alto.

## 2. Pasos

| Cuándo | Qué | Cómo |
|---|---|---|
| **Hora 0** | Anotar la hora de constancia y abrir la entrada en el registro de brechas (§4) | Fecha y hora, quién lo detectó, qué se vio |
| **0 a 2 h** | Contener | Revocar la clave o token afectado, cerrar el acceso, desactivar el proveedor o la ruta, pausar el job. En producción: Cloud Run y Secret Manager |
| **2 a 6 h** | Evaluar | Qué datos, cuántas personas, qué negocios, desde cuándo, si hay audio o transcripciones, si hay datos de salud |
| **Antes de 24 h** | **Avisar a los negocios afectados** | Plantilla del §3, desde privacidad@alhabla.ai |
| **Antes de 72 h** (solo si eres responsable) | Notificar a la AEPD si hay riesgo | Sede electrónica de la AEPD; se puede completar por fases |
| **Después** | Corregir la causa, revisar este registro, informar si se pidió | Entrada en el historial |

**Dónde mirar:** MCP `alhabla-dev` (`errores_prod`, `ver_logs_prod`, `ver_peticiones_prod`, `traza_llamada`), registros de
Cloud Run, accesos a Cloudflare R2 y Secret Manager, y los avisos del proveedor afectado.

## 3. Plantilla de aviso al negocio

> **Asunto:** Aviso de incidente de seguridad en Alhabla
>
> Hola, [nombre]:
>
> El [fecha y hora] detectamos [qué pasó, en una o dos frases]. Afecta a [qué datos] de [cuántas personas o llamadas]
> de tu negocio, entre [fecha] y [fecha].
>
> **Lo que hemos hecho:** [contención].
> **Lo que puede implicar para ti:** [riesgo]. Como responsable del tratamiento, valoras si debes notificarlo a la AEPD
> (plazo de 72 horas desde que lo conoces) y a las personas afectadas. Te ayudamos con lo que necesites.
> **Lo que sabemos y lo que no:** [lo que falta por determinar y cuándo te lo diremos].
>
> Puedes escribirnos a privacidad@alhabla.ai. Te mantendremos al día.

## 4. Registro de brechas

Toda brecha, aunque no se notifique, queda anotada: fecha y hora de constancia, hechos, datos y personas afectadas,
efectos, medidas tomadas, a quién se avisó y cuándo, y por qué no se avisó si no se hizo.

| Fecha | Hechos | Datos y afectados | Medidas | Avisos | Cierre |
|---|---|---|---|---|---|
| — | Sin brechas registradas | — | — | — | — |

## 5. Si el origen es un proveedor

Si Telnyx, Google Cloud, Cloudflare u otro avisa de una brecha, el reloj de 24 h empieza cuando **tú** lo sabes. Guarda
el aviso del proveedor, valora si afecta a datos de tus negocios y sigue los mismos pasos.
