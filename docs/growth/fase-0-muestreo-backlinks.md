# Fase 0 — Muestreo inicial para backlinks (objetivo C)

Hecho el 2026-10-30 con búsqueda web pública. **No se ha tocado Reddit.** Es una primera
señal, no un estudio: sale solo de los extractos de los resultados, no he abierto cada
página, no hay métricas de autoridad de dominio (exigen una herramienta de pago) y no he
distinguido contenido editorial de contenido patrocinado salvo cuando se veía a simple vista.

## Resumen

Hay objetivos concretos para backlinks sin pasar por Reddit. La categoría que más nos
interesa, **«recepcionista de IA en España»**, tiene al menos seis páginas comparativas
publicadas entre agosto y octubre de 2026 y en los extractos que vi no salía Alhabla.
Además hay un directorio sectorial gratuito y varias asociaciones. Va en la dirección de la
hipótesis del diseño: el peso probable del sistema está en C y en SEO/GEO.

## 1. Comparativas de «recepcionista de IA» en España (el objetivo más cercano)

| Página | Quién la publica | Observación |
|---|---|---|
| recepcionista.com/comparar (revisión del 9-10-2026) | Un competidor (Recepcionista.com) | Es un servicio rival que compara a los demás; incluye HeyDiga, IONOS, Safina, Bookline, Ringr, AvisoVoz. Enlazar a Alhabla ahí es poco probable salvo que se pida |
| ai-selection.es/mejores-recepcionistas-virtuales-ia | Ranking con enlaces de afiliado (los enlaces del ganador llevan UTM) | Ranking de 8; parece comercial |
| moncloa.com (25-8-2026) | Medio digital | Texto comparativo de 10 herramientas con precios; parece contenido patrocinado, **por comprobar** |
| dapta.ai/es/blog-posts/mejores-recepcionistas-virtuales-ia | Un competidor (Dapta) | Su propia lista |
| eliocall.es/comparativa-recepcionistas-virtuales-ia | Un competidor (Elio, «próximamente en España») | Su propia lista |
| retellai.com/es/blog/… (3-9-2026) | Una plataforma (Retell) | Lista de plataformas de voz; orientada a desarrolladores |

Lectura: la mayoría son **listas de competidores o contenido comercial**. La vía realista
no es «pedir un enlace» sino (a) estar en esas listas si el editor acepta y (b) que Alhabla
tenga su propia comparativa, que ya existe (`web/src/lib/comparativas.ts`). Conviene mirar
cada una a mano antes de decidir si merece contactar.

**Competidores que aparecen y que no estaban en la lista de comparativas que he visto en el
repo**: Nolam.ai, OptimusCall, Arsys (Recepcionista IA desde 45 €/mes, lanzada en julio de
2026), IONOS Recepcionista IA, AvisoVoz, Bookline, Ringr, Dapta. Vale la pena que
Compliance y Knowledge los tengan en el registro de competidores.

## 2. Listas de software de gestión de citas para salones (categoría vecina)

Reservio, cita.center, Turnito, Zenoti, Eskedula, Happoin, Pabau y SalonLife publican
rankings para peluquerías, barberías y estética (Booksy, Fresha, Koibox, Treatwell…). Casi
todas están hechas **por una marca del propio ranking**. Alhabla no es software de agenda
sino una recepcionista de voz, así que encajaría como complemento, no como alternativa. Son
útiles para ver el vocabulario del sector y las consultas que se disputan, no como objetivo
principal de enlaces.

## 3. Directorios y asociaciones del sector

| Objetivo | Tipo | Observación |
|---|---|---|
| Beautymarket.es (directorio de empresas de peluquería y estética) | Directorio | Dice que incluir tu empresa **es gratis**. Es una ficha con enlace; calidad por medir |
| ANEPE y ANEPE-IMPE (Asociación Nacional de Empresas del Sector Profesional de Peluquería y Estética) | Asociación nacional | Candidata a colaboración, contenido invitado o ventaja para asociados |
| Beauty Cluster Barcelona | Clúster (170 empresas) | Red de empresas del sector en Cataluña |
| Asociación de Imagen Personal de Bizkaia (IPB) | Asociación regional | Encaja con euskera |
| Asociación de Esteticistas de Galicia | Asociación regional | Encaja con gallego |
| Waicita.com (directorio de 31.000 negocios, reservas por WhatsApp) | Directorio de un competidor de WhatsApp | Es de un competidor, no un objetivo de enlace |

Idea sin verificar: la Cámara de Comercio de Madrid publica noticias de empresas socias
(la de Arsys es del 9-7-2026). Si Alhabla fuera socia, saldría el mismo canal. No he
comprobado requisitos ni coste.

## 4. Qué haría con esto

1. En la **Fase 4** (Backlink Intelligence) estas categorías son el punto de partida:
   comparativas de recepcionista de IA, directorios sectoriales gratuitos y asociaciones.
2. Antes, y sin código, puedes revisar a mano en una hora las seis páginas de § 1 y decidir
   cuáles parecen editoriales y cuáles de pago.
3. El directorio de Beautymarket es el candidato más barato para probar el ciclo completo
   (borrador de ficha → tu revisión → alta a mano → medición del enlace).
4. Nada de esto se contacta ni se rellena automáticamente.

## Límites de este muestreo

- Solo extractos de resultados; algunos pueden estar desactualizados o incompletos.
- No sé qué enlaces son `dofollow`, ni la autoridad de cada dominio.
- Que Alhabla no aparezca en los extractos no prueba que no aparezca en la página entera.
