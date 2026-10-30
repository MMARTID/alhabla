import { QueryClient, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { BotonDeEnlaceExterno } from "@/components/comunes/d1-boton-de-enlace";
import {
  ChipDeCaducidad,
  calcularCaducidad,
  textoDeCaducidadCalculada,
} from "@/components/comunes/d1-caducidad";
import { Campo } from "@/components/comunes/d1-campo";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { ErrorDeCliente } from "@/lib/api-errors";
import { renderConCliente } from "../helpers/render";
import { clienteFalso } from "../helpers/cliente-falso";
import { comprobacion } from "../helpers/d1-datos";

const AHORA = Date.parse("2026-10-30T10:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

describe("calcularCaducidad", () => {
  it("sin fecha o con una fecha ilegible no hay caducidad", () => {
    expect(calcularCaducidad(null, AHORA)).toBeNull();
    expect(calcularCaducidad(undefined, AHORA)).toBeNull();
    expect(calcularCaducidad("no es una fecha", AHORA)).toBeNull();
  });

  it("una fecha pasada es «vencida» aunque el servidor no la haya cerrado todavía", () => {
    expect(
      calcularCaducidad(new Date(AHORA - 1000).toISOString(), AHORA)
    ).toEqual({ tipo: "vencida" });
  });

  it("a una semana o menos es un plazo próximo; con más margen, un plazo normal", () => {
    expect(
      calcularCaducidad(new Date(AHORA + 3 * DIA + 1000).toISOString(), AHORA)
    ).toEqual({ tipo: "pronto", dias: 3 });
    expect(
      calcularCaducidad(new Date(AHORA + 7 * DIA + 1000).toISOString(), AHORA)
    ).toEqual({ tipo: "pronto", dias: 7 });
    expect(
      calcularCaducidad(new Date(AHORA + 8 * DIA + 1000).toISOString(), AHORA)
    ).toEqual({ tipo: "plazo", dias: 8 });
  });

  it("menos de 24 horas es «hoy»", () => {
    const caducidad = calcularCaducidad(
      new Date(AHORA + 5 * 60 * 60 * 1000).toISOString(),
      AHORA
    );
    expect(caducidad).toEqual({ tipo: "pronto", dias: 0 });
    expect(textoDeCaducidadCalculada(caducidad!)).toBe("Caduca hoy");
  });
});

describe("ChipDeCaducidad", () => {
  it("«Vencida» cuando expiraEn < ahora y la oportunidad sigue abierta", () => {
    render(
      <ChipDeCaducidad
        expiraEn={new Date(AHORA - DIA).toISOString()}
        estado="pendiente_aprobacion"
        ahora={AHORA}
      />
    );
    expect(screen.getByText("Vencida")).toBeInTheDocument();
  });

  it("«Caduca en N d» cuando queda poco", () => {
    render(
      <ChipDeCaducidad
        expiraEn={new Date(AHORA + 3 * DIA + 1000).toISOString()}
        estado="aprobada"
        ahora={AHORA}
      />
    );
    expect(screen.getByText("Caduca en 3 d")).toBeInTheDocument();
  });

  it.each([
    "gestionada",
    "conseguida",
    "descartada",
    "caducada",
    "sin_respuesta",
  ] as const)(
    "no pinta nada en una oportunidad %s: ya está cerrada",
    (estado) => {
      const { container } = render(
        <ChipDeCaducidad
          expiraEn={new Date(AHORA - DIA).toISOString()}
          estado={estado}
          ahora={AHORA}
        />
      );
      expect(container).toBeEmptyDOMElement();
    }
  );

  it("sin expiraEn no pinta nada", () => {
    const { container } = render(
      <ChipDeCaducidad expiraEn={null} estado="calificada" ahora={AHORA} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Dialogo", () => {
  function Abrible({ ocupado = false }: { ocupado?: boolean }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <div>
        <button onClick={() => setAbierto(true)}>Abrir</button>
        {abierto ? (
          <Dialogo
            titulo="Un diálogo"
            descripcion="Con descripción"
            alCerrar={() => setAbierto(false)}
            ocupado={ocupado}
          >
            <input aria-label="Primero" />
            <button>Último</button>
          </Dialogo>
        ) : null}
      </div>
    );
  }

  it("es un diálogo modal con título y descripción, y el foco va al primer control", async () => {
    const user = userEvent.setup();
    render(<Abrible />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialogo = screen.getByRole("dialog", { name: "Un diálogo" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleDescription("Con descripción");
    // Al primer control del contenido, no a la X de la cabecera.
    expect(screen.getByRole("textbox", { name: "Primero" })).toHaveFocus();
  });

  it("Escape lo cierra y el foco vuelve al botón que lo abrió", async () => {
    const user = userEvent.setup();
    render(<Abrible />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await user.click(abrir);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("mientras hay una acción en vuelo ni Escape ni la X lo cierran", async () => {
    const user = userEvent.setup();
    render(<Abrible ocupado />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
  });

  it("pulsar fuera no lo cierra: un toque perdido no tira lo escrito", async () => {
    const user = userEvent.setup();
    render(<Abrible />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const fondo = screen.getByRole("dialog").parentElement!;
    await user.click(fondo);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("el tabulador da la vuelta: del último control al primero y al revés", async () => {
    const user = userEvent.setup();
    render(<Abrible />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const cerrar = screen.getByRole("button", { name: "Cerrar" });
    const ultimo = screen.getByRole("button", { name: "Último" });
    ultimo.focus();
    await user.tab();
    expect(cerrar).toHaveFocus();
    await user.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it("bloquea el scroll de la página mientras está abierto y lo devuelve al cerrar", async () => {
    const user = userEvent.setup();
    render(<Abrible />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("Campo", () => {
  it("la etiqueta de un campo opcional dice «Opcional» con un espacio por medio", () => {
    render(
      <Campo id="x" etiqueta="Nota" opcional>
        <input id="x" />
      </Campo>
    );
    expect(screen.getByLabelText("Nota Opcional")).toBeInTheDocument();
  });

  it("enseña la ayuda y el error", () => {
    render(
      <Campo id="x" etiqueta="Nota" ayuda="Una ayuda" error="Un error">
        <input id="x" />
      </Campo>
    );
    expect(screen.getByText("Una ayuda")).toBeInTheDocument();
    expect(screen.getByText("Un error")).toBeInTheDocument();
  });
});

describe("BotonDeEnlaceExterno", () => {
  it("una URL https es un enlace que se abre fuera con noopener, noreferrer y nofollow", () => {
    render(
      <BotonDeEnlaceExterno href="https://revista.example/x">
        Abrir página
      </BotonDeEnlaceExterno>
    );
    const enlace = screen.getByRole("link", { name: /Abrir página/ });
    expect(enlace).toHaveAttribute("href", "https://revista.example/x");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace.getAttribute("rel")?.split(" ").sort()).toEqual([
      "nofollow",
      "noopener",
      "noreferrer",
    ]);
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "/ruta/relativa",
    "",
  ])("«%s» no es un enlace: queda un botón apagado sin href", (href) => {
    render(
      <BotonDeEnlaceExterno href={href}>Abrir página</BotonDeEnlaceExterno>
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("[href]")).toBeNull();
    expect(screen.getByText(/Abrir página/)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

describe("AvisoDeErrorDeAccion", () => {
  it("sin error no pinta nada", () => {
    const { container } = render(
      <AvisoDeErrorDeAccion error={null} respaldo="Falló" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("un 409 de cumplimiento enseña el texto, qué hacer y las reglas que fallan", () => {
    render(
      <AvisoDeErrorDeAccion
        error={
          new ErrorDeCliente(409, "Una regla dura ya no se cumple.", {
            codigo: "cumplimiento",
            comprobaciones: [
              comprobacion({
                regla: "sin_terminos_prohibidos",
                ok: false,
                detalle: "Usa un término prohibido.",
              }),
              comprobacion({ regla: "identificacion", ok: true }),
            ],
          })
        }
        respaldo="Falló"
      />
    );
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Una regla dura ya no se cumple.");
    expect(alerta).toHaveTextContent("El borrador ha quedado bloqueado");
    expect(alerta).toHaveTextContent("Usa un término prohibido.");
    // Solo lo que falla, no lo que está bien.
    expect(alerta).not.toHaveTextContent("Se identifica quien escribe");
  });

  it.each([
    ["tope_semanal", "cambia el tope en Ajustes"],
    ["dominio_ya_aprobado", "un contacto por dominio"],
    ["caducada", "Descártala o déjala caducar"],
  ])("el código %s añade su ayuda", (codigo, texto) => {
    render(
      <AvisoDeErrorDeAccion
        error={new ErrorDeCliente(409, "No se puede.", { codigo })}
        respaldo="Falló"
      />
    );
    expect(screen.getByRole("alert").textContent?.toLowerCase()).toContain(
      texto.toLowerCase()
    );
  });

  it("un error desconocido usa el texto de respaldo, nunca el volcado", () => {
    render(
      <AvisoDeErrorDeAccion
        error={new Error("ECONNRESET at socket.js:123")}
        respaldo="No se pudo completar."
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo completar."
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("ECONNRESET");
  });
});

describe("ConsultaConDatos", () => {
  function Prueba({ cliente }: { cliente: () => Promise<string> }) {
    const consulta = useQuery({ queryKey: ["x"], queryFn: cliente });
    return (
      <ConsultaConDatos consulta={consulta} titulo="No se pudo cargar">
        {(dato) => <p>Dato: {dato}</p>}
      </ConsultaConDatos>
    );
  }

  it("mientras carga, un esqueleto; con datos, el contenido", async () => {
    renderConCliente(<Prueba cliente={async () => "uno"} />, clienteFalso());
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("Dato: uno")).toBeInTheDocument();
  });

  it("sin datos y con error, la pantalla de error con «Reintentar»", async () => {
    renderConCliente(
      <Prueba
        cliente={async () => {
          throw new Error("x");
        }}
      />,
      clienteFalso()
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar"
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("si falla un refresco con datos ya cargados, NO se tira el contenido: sale un aviso aparte", async () => {
    const consultas = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let llamada = 0;
    const cliente = async () => {
      llamada += 1;
      if (llamada === 1) return "uno";
      throw new ErrorDeCliente(401, "Tu sesión ha caducado.");
    };
    renderConCliente(<Prueba cliente={cliente} />, clienteFalso(), consultas);
    expect(await screen.findByText("Dato: uno")).toBeInTheDocument();

    await consultas.refetchQueries({ queryKey: ["x"] });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo actualizar lo que ves"
      )
    );
    // El contenido sigue ahí, con lo último que llegó.
    expect(screen.getByText("Dato: uno")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tu sesión ha caducado."
    );
  });

  it("«Reintentar» del aviso vuelve a pedir y, si llega, lo quita", async () => {
    const user = userEvent.setup();
    const consultas = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let llamada = 0;
    const cliente = vi.fn(async () => {
      llamada += 1;
      if (llamada === 2) throw new Error("red");
      return `dato ${llamada}`;
    });
    renderConCliente(<Prueba cliente={cliente} />, clienteFalso(), consultas);
    await screen.findByText("Dato: dato 1");
    await consultas.refetchQueries({ queryKey: ["x"] });
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Dato: dato 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });
});
