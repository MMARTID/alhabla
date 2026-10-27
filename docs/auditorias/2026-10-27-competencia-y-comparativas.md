# Situación frente a la competencia (27-10-2026)

Revisión de las cinco comparativas de la web (`web/src/app/comparativa/`) contrastadas con lo que
publican hoy HeyDiga y fonio, y con la analítica de la web. Objetivo: ver qué estamos haciendo mal,
no repetir lo que las páginas ya dicen bien.

## Cómo se ha hecho

- Lectura de `alhabla-vs-heydiga`, `alhabla-vs-fonio` y las tres de categoría
  (`recepcionista-de-ia-vs-centralita-virtual`, `…-vs-secretaria-telefonica`,
  `…-vs-recepcionista-humana`).
- Webs de la competencia consultadas el 27-10-2026: heydiga.com/es/precios,
  heydiga.com/es/integraciones y fonio.ai/es/precios.
- Visitas a `/comparativa*` desde el 20-10 en Vercel Web Analytics (solo cuenta a quien acepta
  cookies).

## Resumen

Las comparativas son honestas y están bien documentadas: cada dato lleva fecha y fuente, y dicen dónde
gana el otro (art. 10 de la Ley 3/1991). El problema no es lo que dicen, sino lo que revelan:

- **No las ve nadie.**
- **Perdemos en precio frente a HeyDiga y fonio.**
- **Perdemos en confianza** (dónde están los datos, certificaciones).
- **Perdemos en integraciones** con el software donde viven los salones y las clínicas.

Nuestra ventaja real es estrecha:

- lenguas cooficiales automáticas;
- Outlook e iCloud;
- reorganizar una ausencia avisando a cada cliente;
- precio del minuto extra publicado;
- alta sin demo en todos los planes.

## Lo que estamos haciendo mal

### 1. Las comparativas no tienen tráfico

Cero visitas con consentimiento a `/comparativa*` desde el 20-10. Sin tráfico no convencen a nadie:
- ninguna página con autoridad las enlaza;
- la web aún tiene poca autoridad (ver el estudio SEO/SEM del 22-10).

**Qué hacer:**
- enlazarlas desde `/planes` y desde el bloque de precios de cada sector;
- pedir su indexación en Search Console;
- buscar enlaces externos: directorios de software, prensa local, asociaciones de peluquería y
  fisioterapia.

### 2. Somos más caros por minuto en casi todos los tramos

| Tramo | Alhabla | HeyDiga | fonio |
|---|---|---|---|
| Entrada | 59 € / 200 min (0,30 €) | 49 € / 200 min (0,25 €) | 119 € / 1.000 min (0,12 €; 0,10 € anual) |
| Medio | 139 € / 600 min (0,23 €) | 99 € / 500 min (0,20 €) | — |
| Alto | 269 € / 1.500 min (0,18 €) | 279 € / desde 1.500 min (0,19 €) | 359 € / 3.600 min (0,10 €) |

- Solo Scale gana, y por poco.
- Lo admitimos en las páginas, que es lo correcto, pero no hay una respuesta comercial:
  - no tenemos pago anual (fonio rebaja un 20 %);
  - el plan de entrada cuesta 10 € más que el de HeyDiga.
- Además, el `<title>` de fonio anuncia hoy «desde 84 € al mes», cuando su plan de voz más barato
  publicado es de 99 € pagando el año. Puede haber una oferta nueva que nuestra comparativa no
  recoge: **revisarla**.

### 3. Perdemos en confianza: datos y certificaciones

| | Datos | Certificaciones |
|---|---|---|
| HeyDiga | Servidores en la UE | ENS categoría media e ISO 27001 |
| fonio | Alemania | — |
| Alhabla | «Proveedores con transferencias fuera del EEE con garantías» | Ninguna |

Para una clínica de fisioterapia (datos de salud) y para cualquier cadena, esto descalifica antes de
probar. Son los pendientes de la auditoría del 16-10: el LLM fuera del EEE y Telnyx sin anclaje en
la UE.

**Qué hacer:**
- decidir si se puede anclar la voz y el modelo de lenguaje en la UE;
- si se puede, decirlo en las comparativas y en `/fisioterapia`.

### 4. No nos integramos con el software del sector

HeyDiga publica 28 integraciones:
- belleza: Booksy, Treatwell, Koibox;
- salud: Doctoralia, Clinic Cloud, Dentalink y Gesden;
- y otras, desde su plan Start, sin coste aparte.

Nuestras propias comparativas dicen: «si tu agenda vive en Booksy o Treatwell, HeyDiga encaja
mejor». Es honesto, pero es el caso de una parte grande de los salones y clínicas a los que vendemos.
Booksy, Fresha y Treatwell no tienen API pública para nosotros (ver el roadmap de calendarios).

**Qué hacer:** valorar qué integraciones son viables (Koibox, Clinic Cloud; Doctoralia se descartó en el
roadmap de calendarios) y, mientras tanto, explicar en cada sector cómo funciona Alhabla si tu programa sincroniza con Google Calendar.

### 5. No publicamos cuántas llamadas atiende a la vez

- HeyDiga publica de 5 a 25 según el plan; fonio, 1 o 3.
- Nosotros ponemos «sin cifra publicada» en las dos comparativas.
- Si la cifra real es alta (lo que permita Telnyx por cuenta y número), es una ventaja que regalamos.

**Qué hacer:** medir el límite real y publicarlo en `/planes`.

### 6. La prueba es la más corta

| | Prueba |
|---|---|
| Alhabla | 7 días, con tarjeta |
| fonio | 14 días y devolución en 30 |
| HeyDiga | «Empieza gratis» en Lite, y una demo con el nombre del negocio desde la portada |

**Qué hacer:** valorar 14 días o una garantía de devolución, y una demo que use el nombre del negocio
del visitante.

### 7. HeyDiga vende funciones que no comparamos

Su plan Growth (169 €) incluye:
- lista de espera;
- política de cancelación con tarjeta;
- gestión de reseñas;
- recordatorios por llamada;
- informes mensuales.

El Pro (279 €) añade reservas entre centros y API. Nuestras tablas no las mencionan, y quien compara
de verdad las verá.

**Qué hacer:**
- añadir esas filas, con «no consta» o con lo que tengamos;
- **comprobar en el código** si nuestra lista de espera existe de verdad, porque las landings la
  anuncian.

### 8. WhatsApp ya no nos distingue de HeyDiga

HeyDiga se presenta como «la recepcionista IA que contesta el teléfono y el WhatsApp de tu negocio»,
casi nuestro mismo mensaje. Lo que queda de diferencia:
- la conversación por WhatsApp con el cliente va incluida (en HeyDiga cuesta +39 €/mes);
- el Gestor, aunque no es exclusivo: mims también lo tiene (ver los diferenciadores verificados del
  20-10).

**Qué hacer:** dejar de vender «WhatsApp» como diferencia y vender lo concreto: conversación incluida
y una ausencia resuelta en un mensaje, avisando a cada cliente.

### 9. Falta la comparativa con quien de verdad compite en Google

- IONOS (Recepcionista IA desde 39 €, cobra por llamada) es el primer resultado orgánico en
  «recepcionista virtual ia» y el anunciante más fuerte.
- Habla (myhabla.com) se cuela en la búsqueda de nuestra marca.
- Solo comparamos con HeyDiga y fonio (decisión del 20-10).

**Qué hacer:** reconsiderar una página «Alhabla vs IONOS». Es otra categoría de precio (por llamada) y
explica bien cuándo conviene cada uno.

### 10. Dos páginas compiten por la misma búsqueda

Las dos usan el mismo sueldo de convenio para la búsqueda «cuánto cuesta una recepcionista»:
- `/comparativa/recepcionista-de-ia-vs-recepcionista-humana` («Cuánto cuesta una recepcionista frente
  a una IA»);
- el artículo `/blog/cuanto-cuesta-una-recepcionista-de-ia`.

**Qué hacer:** que una sea la principal para el coste de una persona (la comparativa) y que el
artículo se centre en precios de proveedores y enlace a ella.

### 11. Fechas que caducan

Los títulos y las descripciones dicen «a 20 de octubre de 2026». Está bien para la transparencia,
pero:
- en un mes se leerá como página vieja;
- nadie revisa los precios de la competencia de forma periódica.

**Qué hacer:**
- revisión mensual con fecha en `lib/paginas.ts`;
- la fecha en el cuerpo y en `Fuentes`, no en la descripción.

## Lo que sí está bien

- Cada dato tiene fuente y fecha, y «no consta» nunca se convierte en «no lo tiene».
- Las páginas dicen dónde gana el competidor: eso da credibilidad y protege legalmente.
- Los precios de Alhabla salen de `lib/plans.ts`, así que no se desfasan.
- El alta en autoservicio en todos los planes es una ventaja real frente a la demo comercial de
  HeyDiga.

## Prioridades propuestas

1. Tráfico: enlazar las comparativas desde `/planes` y los sectores, y pedir su indexación (1, 9).
2. Confianza: decidir el anclaje en la UE de la voz y el modelo (3).
3. Producto y precio: medir y publicar las llamadas simultáneas; pago anual o prueba más larga (2, 5, 6).
4. Contenido: filas de lista de espera, cancelación y reseñas; fechas; canibalización (7, 10, 11).
5. Integraciones: estudio de viabilidad de Koibox y Clinic Cloud (4).
