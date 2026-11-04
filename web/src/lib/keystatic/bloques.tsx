import { fields } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

/**
 * Bloques de marca disponibles en el editor del blog. Cada uno tiene su
 * formulario (schema) y una vista dentro del editor (ContentView) que imita
 * el bloque real; en la web los pinta components/blog/bloques.tsx. Los
 * nombres (Cta, Dato, Aviso, Pasos, Faq, ChatWhatsApp, Checklist, Tabla,
 * Cuenta, Plantilla, Indice) son las etiquetas JSX que quedan en el .mdx.
 */
const DESTINOS = [
  { label: "Planes y precios", value: "planes" },
  { label: "Escuchar la demo", value: "demo" },
  { label: "Cómo funciona", value: "como_funciona" },
  { label: "Landing de peluquerías", value: "peluqueria" },
  { label: "Landing de barberías", value: "barberia" },
  { label: "Landing de centros de estética", value: "centro-de-estetica" },
  { label: "Landing de salones de uñas", value: "salon-de-unas" },
  { label: "Landing de fisioterapia", value: "fisioterapia" },
  { label: "Desvío de llamadas por operador", value: "desvio-de-llamadas" },
  { label: "Tu asistente por WhatsApp", value: "agenda-por-whatsapp" },
] as const;

const TIPOS_DE_AVISO = {
  consejo: {
    etiqueta: "Consejo",
    fondo: "#f3eeff",
    borde: "#ddd6fe",
    color: "#6d28d9",
  },
  importante: {
    etiqueta: "Importante",
    fondo: "#fef8e7",
    borde: "#f0dfa8",
    color: "#9f7a15",
  },
  ejemplo: {
    etiqueta: "Ejemplo real",
    fondo: "#fafafa",
    borde: "#e5e5e5",
    color: "#52525b",
  },
} as const;

const tarjeta: React.CSSProperties = {
  border: "1px solid #ddd6fe",
  background: "#f3eeff",
  borderRadius: 20,
  padding: 20,
};

const etiqueta: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

export const bloquesDelEditor = {
  Cta: block({
    label: "Llamada a la acción",
    description:
      "Tarjeta morada con un botón. Una por artículo, hacia el final.",
    schema: {
      titulo: fields.text({
        label: "Título",
        validation: { isRequired: true, length: { max: 90 } },
      }),
      texto: fields.text({
        label: "Texto",
        multiline: true,
        validation: { length: { max: 200 } },
      }),
      destino: fields.select({
        label: "Adónde lleva el botón",
        options: DESTINOS,
        defaultValue: "planes",
      }),
      boton: fields.text({
        label: "Texto del botón (opcional)",
        validation: { length: { max: 40 } },
      }),
    },
    ContentView: (props) => (
      <div style={tarjeta}>
        <div style={{ ...etiqueta, color: "#6d28d9" }}>Alhabla</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
          {props.value.titulo || "Título de la llamada a la acción"}
        </div>
        {props.value.texto ? (
          <div style={{ marginTop: 6, color: "#52525b" }}>
            {props.value.texto}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            background: "#0a0a0a",
            color: "#fff",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {props.value.boton ||
            DESTINOS.find((d) => d.value === props.value.destino)?.label ||
            "Ver planes"}{" "}
          →
        </div>
      </div>
    ),
  }),
  Dato: block({
    label: "Dato destacado",
    description:
      "Una cifra grande con su explicación y su fuente. Solo datos con fuente externa.",
    schema: {
      cifra: fields.text({
        label: "Cifra",
        description: "Por ejemplo «1 de cada 3» o «600 €/mes».",
        validation: { isRequired: true, length: { max: 20 } },
      }),
      texto: fields.text({
        label: "Qué significa",
        multiline: true,
        validation: { isRequired: true, length: { max: 200 } },
      }),
      fuente: fields.text({
        label: "Fuente (nombre)",
        validation: { length: { max: 80 } },
      }),
      fuenteUrl: fields.url({ label: "Fuente (enlace)" }),
    },
    ContentView: (props) => (
      <div style={{ ...tarjeta, background: "#fff", borderColor: "#e5e5e5" }}>
        <div
          style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}
        >
          {props.value.cifra || "42 %"}
        </div>
        <div style={{ marginTop: 6 }}>
          {props.value.texto || "Qué significa la cifra"}
        </div>
        {props.value.fuente ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#52525b" }}>
            Fuente: {props.value.fuente}
          </div>
        ) : null}
      </div>
    ),
  }),
  Aviso: wrapper({
    label: "Aviso",
    description: "Consejo, advertencia o ejemplo real, con el texto dentro.",
    schema: {
      tipo: fields.select({
        label: "Tipo",
        options: [
          { label: "Consejo", value: "consejo" },
          { label: "Importante", value: "importante" },
          { label: "Ejemplo real", value: "ejemplo" },
        ],
        defaultValue: "consejo",
      }),
      titulo: fields.text({
        label: "Título (opcional)",
        validation: { length: { max: 60 } },
      }),
    },
    ContentView: (props) => {
      const t = TIPOS_DE_AVISO[props.value.tipo] ?? TIPOS_DE_AVISO.consejo;
      return (
        <div
          style={{
            ...tarjeta,
            background: t.fondo,
            borderColor: t.borde,
            borderRadius: 16,
          }}
        >
          <div style={{ ...etiqueta, color: t.color }}>
            {props.value.titulo || t.etiqueta}
          </div>
          {/* @keystar/ui trae su propio @types/react: el children es el mismo ReactNode. */}
          <div style={{ marginTop: 6 }}>
            {props.children as React.ReactNode}
          </div>
        </div>
      );
    },
  }),
  Pasos: block({
    label: "Pasos numerados",
    description: "Una lista de pasos con título y explicación.",
    schema: {
      pasos: fields.array(
        fields.object({
          titulo: fields.text({
            label: "Título del paso",
            validation: { isRequired: true, length: { max: 80 } },
          }),
          texto: fields.text({
            label: "Explicación",
            multiline: true,
            validation: { length: { max: 240 } },
          }),
        }),
        { label: "Pasos", itemLabel: (p) => p.fields.titulo.value || "Paso" }
      ),
    },
    ContentView: (props) => (
      <div style={{ display: "grid", gap: 8 }}>
        {(props.value.pasos.length
          ? props.value.pasos
          : [{ titulo: "Primer paso", texto: "" }]
        ).map((p, i) => (
          <div
            key={i}
            style={{
              ...tarjeta,
              background: "#fff",
              borderColor: "#e5e5e5",
              borderRadius: 16,
              display: "flex",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#0a0a0a",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{p.titulo}</div>
              {p.texto ? (
                <div style={{ fontSize: 13, color: "#52525b", marginTop: 2 }}>
                  {p.texto}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    ),
  }),
  Faq: block({
    label: "Preguntas frecuentes",
    description:
      "Preguntas con su respuesta, desplegables. Van bien al final del artículo.",
    schema: {
      preguntas: fields.array(
        fields.object({
          pregunta: fields.text({
            label: "Pregunta",
            validation: { isRequired: true, length: { max: 120 } },
          }),
          respuesta: fields.text({
            label: "Respuesta",
            multiline: true,
            validation: { isRequired: true, length: { max: 400 } },
          }),
        }),
        {
          label: "Preguntas",
          itemLabel: (p) => p.fields.pregunta.value || "Pregunta",
        }
      ),
    },
    ContentView: (props) => (
      <div
        style={{
          ...tarjeta,
          background: "#fff",
          borderColor: "#e5e5e5",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {(props.value.preguntas.length
          ? props.value.preguntas
          : [{ pregunta: "¿Primera pregunta?", respuesta: "" }]
        ).map((p, i) => (
          <div
            key={i}
            style={{
              padding: "14px 20px",
              borderTop: i ? "1px solid #e5e5e5" : "none",
            }}
          >
            <div style={{ fontWeight: 600 }}>{p.pregunta}</div>
            {p.respuesta ? (
              <div style={{ fontSize: 13, color: "#52525b", marginTop: 4 }}>
                {p.respuesta}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    ),
  }),
  ChatWhatsApp: block({
    label: "Conversación de WhatsApp",
    description:
      "Simula un chat con Alhabla o con un cliente. Ideal para enseñar cómo pide el dueño un cambio («Marta está de baja hoy») y qué responde Alhabla.",
    schema: {
      titulo: fields.text({
        label: "Título de la ventana (opcional)",
        validation: { length: { max: 40 } },
      }),
      mensajes: fields.array(
        fields.object({
          autor: fields.select({
            label: "Quién escribe",
            options: [
              { label: "El negocio (tú)", value: "negocio" },
              { label: "Alhabla", value: "alhabla" },
              { label: "El cliente", value: "cliente" },
            ],
            defaultValue: "alhabla",
          }),
          texto: fields.text({
            label: "Mensaje",
            multiline: true,
            validation: { isRequired: true, length: { max: 240 } },
          }),
        }),
        {
          label: "Mensajes",
          itemLabel: (m) => m.fields.texto.value.slice(0, 40) || "Mensaje",
        }
      ),
    },
    ContentView: (props) => (
      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 20,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            ...etiqueta,
            color: "#6d28d9",
            padding: "10px 16px",
            borderBottom: "1px solid #e5e5e5",
            background: "#fafafa",
          }}
        >
          {props.value.titulo || "WhatsApp · Alhabla"}
        </div>
        <div style={{ padding: 16, display: "grid", gap: 8 }}>
          {(props.value.mensajes.length
            ? props.value.mensajes
            : [{ autor: "alhabla" as const, texto: "Mensaje" }]
          ).map((m, i) => {
            const esNegocio = m.autor === "negocio";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: esNegocio ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    borderRadius: 16,
                    padding: "8px 14px",
                    fontSize: 13,
                    background: esNegocio
                      ? "#0a0a0a"
                      : m.autor === "alhabla"
                        ? "#f3eeff"
                        : "#fff",
                    color: esNegocio ? "#fff" : "#27272a",
                    border:
                      !esNegocio && m.autor === "cliente"
                        ? "1px solid #e5e5e5"
                        : "none",
                  }}
                >
                  {m.texto}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  }),
  Checklist: block({
    label: "Lista de comprobación",
    description:
      "Puntos con marca de verificación, para «qué pedir a tu sistema» o «antes de lanzar».",
    schema: {
      items: fields.array(
        fields.object({
          texto: fields.text({
            label: "Punto",
            validation: { isRequired: true, length: { max: 160 } },
          }),
        }),
        { label: "Puntos", itemLabel: (p) => p.fields.texto.value || "Punto" }
      ),
    },
    ContentView: (props) => (
      <div style={{ display: "grid", gap: 8 }}>
        {(props.value.items.length
          ? props.value.items
          : [{ texto: "Primer punto" }]
        ).map((p, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e5e5",
              background: "#fff",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 8,
                background: "#f3eeff",
                color: "#8b5cf6",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 13 }}>{p.texto}</div>
          </div>
        ))}
      </div>
    ),
  }),
  Indice: block({
    label: "Índice del artículo",
    description:
      "«En este artículo»: los títulos de los apartados (##), escritos igual que en el texto. Cada uno salta a su apartado.",
    schema: {
      apartados: fields.array(
        fields.object({
          texto: fields.text({
            label: "Título del apartado (igual que el ##)",
            validation: { isRequired: true, length: { max: 90 } },
          }),
        }),
        { label: "Apartados", itemLabel: (p) => p.fields.texto.value || "Apartado" }
      ),
    },
    ContentView: (props) => (
      <div style={{ ...tarjeta, background: "#fafafa", borderColor: "#e5e5e5" }}>
        <div style={{ ...etiqueta, color: "#6d28d9" }}>En este artículo</div>
        <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
          {props.value.apartados.map((a, i) => (
            <li key={i}>{a.texto}</li>
          ))}
        </ol>
      </div>
    ),
  }),
  Tabla: block({
    label: "Tabla",
    description:
      "Tabla de datos (operadores, precios, comparaciones). La primera columna va en negrita; un código entre comillas invertidas (`##002#`) sale en monoespaciado.",
    schema: {
      titulo: fields.text({
        label: "Título (opcional)",
        validation: { length: { max: 80 } },
      }),
      columnas: fields.array(
        fields.text({ label: "Columna", validation: { isRequired: true } }),
        { label: "Columnas", itemLabel: (c) => c.value || "Columna" }
      ),
      filas: fields.array(
        fields.object({
          celdas: fields.array(fields.text({ label: "Celda" }), {
            label: "Celdas (una por columna, en orden)",
            itemLabel: (c) => c.value || "Celda",
          }),
        }),
        {
          label: "Filas",
          itemLabel: (f) => f.fields.celdas.elements[0]?.value || "Fila",
        }
      ),
      nota: fields.text({
        label: "Nota o fuente (opcional)",
        multiline: true,
        validation: { length: { max: 300 } },
      }),
    },
    ContentView: (props) => (
      <div style={{ ...tarjeta, background: "#fff", borderColor: "#e5e5e5", overflowX: "auto" }}>
        {props.value.titulo ? (
          <div style={{ ...etiqueta, color: "#6d28d9", marginBottom: 8 }}>
            {props.value.titulo}
          </div>
        ) : null}
        <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {props.value.columnas.map((c, i) => (
                <th key={i} style={{ textAlign: "left", padding: 4, borderBottom: "1px solid #e5e5e5" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.value.filas.map((f, i) => (
              <tr key={i}>
                {f.celdas.map((c, j) => (
                  <td key={j} style={{ padding: 4, borderBottom: "1px solid #f0f0f0" }}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  }),
  Cuenta: block({
    label: "Cuenta paso a paso",
    description:
      "Conceptos con su importe y un total destacado: para enseñar de dónde sale una cifra.",
    schema: {
      titulo: fields.text({
        label: "Título (opcional)",
        validation: { length: { max: 80 } },
      }),
      lineas: fields.array(
        fields.object({
          concepto: fields.text({
            label: "Concepto",
            validation: { isRequired: true, length: { max: 90 } },
          }),
          importe: fields.text({
            label: "Importe",
            validation: { isRequired: true, length: { max: 30 } },
          }),
          detalle: fields.text({
            label: "Detalle (opcional)",
            validation: { length: { max: 160 } },
          }),
        }),
        { label: "Líneas", itemLabel: (l) => l.fields.concepto.value || "Línea" }
      ),
      totalConcepto: fields.text({ label: "Texto del total", defaultValue: "Total" }),
      total: fields.text({
        label: "Total",
        validation: { isRequired: true, length: { max: 30 } },
      }),
      nota: fields.text({
        label: "Nota (opcional)",
        multiline: true,
        validation: { length: { max: 300 } },
      }),
    },
    ContentView: (props) => (
      <div style={{ ...tarjeta, background: "#fff", borderColor: "#e5e5e5", padding: 0, overflow: "hidden" }}>
        {props.value.lineas.map((l, i) => (
          <div
            key={i}
            style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", fontSize: 13, borderTop: i ? "1px solid #f0f0f0" : "none" }}
          >
            <span>{l.concepto}</span>
            <strong>{l.importe}</strong>
          </div>
        ))}
        <div
          style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "#0a0a0a", color: "#fff", fontWeight: 700 }}
        >
          <span>{props.value.totalConcepto || "Total"}</span>
          <span>{props.value.total}</span>
        </div>
      </div>
    ),
  }),
  Plantilla: block({
    label: "Plantilla para copiar",
    description:
      "Un mensaje listo para pegar (WhatsApp, contestador…) con botón «Copiar». Los saltos de línea se respetan.",
    schema: {
      titulo: fields.text({
        label: "Para qué es",
        validation: { isRequired: true, length: { max: 80 } },
      }),
      cuando: fields.text({
        label: "Cuándo usarla (opcional)",
        validation: { length: { max: 160 } },
      }),
      texto: fields.text({
        label: "Texto del mensaje",
        multiline: true,
        validation: { isRequired: true, length: { max: 700 } },
      }),
    },
    ContentView: (props) => (
      <div style={{ ...tarjeta, background: "#fff", borderColor: "#e5e5e5" }}>
        <div style={{ fontWeight: 600 }}>{props.value.titulo}</div>
        {props.value.cuando ? (
          <div style={{ fontSize: 13, color: "#52525b" }}>{props.value.cuando}</div>
        ) : null}
        <div
          style={{ marginTop: 10, whiteSpace: "pre-line", fontSize: 13, background: "#f3eeff", border: "1px solid #ddd6fe", borderRadius: 14, padding: "8px 12px" }}
        >
          {props.value.texto}
        </div>
      </div>
    ),
  }),
};
