import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnlaceExterno } from "@/components/enlace-externo";
import { ErrorDeCarga } from "@/components/error-de-carga";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { InsigniaDeEstado } from "@/components/insignia";
import { ListaDeComprobaciones } from "@/components/lista-de-comprobaciones";
import { Paginacion } from "@/components/paginacion";
import {
  ETIQUETA_DE_ACCION,
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_CODIGO_DE_DESCARTE,
  ETIQUETA_DE_ESTADO,
  ETIQUETA_DE_ESTADO_DE_BORRADOR,
  ETIQUETA_DE_ESTADO_DE_EJECUCION,
  ETIQUETA_DE_GRUPO_DE_BORRADORES,
  ETIQUETA_DE_OBJETIVO,
  ETIQUETA_DE_RESULTADO,
  ETIQUETA_DE_TIPO_DE_AFIRMACION,
  ETIQUETA_DE_TIPO_DE_BORRADOR,
  TONO_DE_ESTADO,
  etiquetaDeAccionDelRegistro,
  etiquetaDeAutor,
  etiquetaDeCodigoDeDescarte,
  etiquetaDeRegla,
} from "@/lib/etiquetas";
import {
  CANALES,
  CODIGOS_DE_DESCARTE,
  ESTADOS_DE_BORRADOR,
  ESTADOS_DE_OPORTUNIDAD,
  GRUPOS_DE_BORRADORES,
  OBJETIVOS,
  TIPOS_DE_AFIRMACION,
  TIPOS_DE_BORRADOR,
} from "@/lib/types";
import { ErrorDeCliente } from "@/lib/api-errors";

describe("EnlaceExterno", () => {
  it("un enlace http(s) se abre en otra pestaña con noopener, noreferrer y nofollow", () => {
    render(
      <EnlaceExterno href="https://revista.example/listado" conIcono>
        revista.example
      </EnlaceExterno>
    );
    const enlace = screen.getByRole("link", { name: /revista.example/ });
    expect(enlace).toHaveAttribute("href", "https://revista.example/listado");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace.getAttribute("rel")?.split(" ").sort()).toEqual([
      "nofollow",
      "noopener",
      "noreferrer",
    ]);
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>1</script>",
    "vbscript:x",
    "/relativa",
    "",
    null,
    undefined,
  ])("con %j no hay enlace: el texto se pinta como dato", (href) => {
    render(
      <EnlaceExterno href={href as string}>texto del destino</EnlaceExterno>
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("texto del destino")).toBeInTheDocument();
  });
});

describe("ListaDeComprobaciones", () => {
  const comprobaciones = [
    {
      regla: "afirmaciones_vigentes",
      ok: false,
      dura: true,
      detalle: "Afirmaciones que ya no valen: precio.x.",
    },
    {
      regla: "similitud_con_version_anterior",
      ok: false,
      dura: false,
      detalle: "Se parece un 38 % a la versión anterior.",
    },
    {
      regla: "identificacion",
      ok: true,
      dura: true,
      detalle: "Dice quién escribe.",
    },
  ];

  it("distingue lo que bloquea, lo que avisa y lo que está bien, también sin color", () => {
    render(<ListaDeComprobaciones comprobaciones={comprobaciones} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(
      "Afirmaciones con clave vigente — Bloquea"
    );
    expect(items[0].querySelector("svg")?.getAttribute("class")).toContain(
      "text-error"
    );
    expect(items[1]).toHaveTextContent(
      "Parecido con la versión anterior — Aviso"
    );
    expect(items[1].querySelector("svg")?.getAttribute("class")).toContain(
      "text-aviso"
    );
    expect(items[2]).toHaveTextContent(
      "Se identifica quien escribe — Correcta"
    );
    expect(items[2].querySelector("svg")?.getAttribute("class")).toContain(
      "text-exito"
    );
  });

  it("puede enseñar solo las que fallan, y no pinta nada si no hay ninguna", () => {
    const { container, rerender } = render(
      <ListaDeComprobaciones comprobaciones={comprobaciones} soloFallidas />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    rerender(
      <ListaDeComprobaciones
        comprobaciones={[comprobaciones[2]]}
        soloFallidas
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("el detalle es TEXTO: un <img onerror> del backend no se convierte en un elemento", () => {
    render(
      <ListaDeComprobaciones
        comprobaciones={[
          {
            regla: "x",
            ok: false,
            dura: true,
            detalle: '<img src=x onerror="alert(1)"><script>alert(2)</script>',
          },
        ]}
      />
    );
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/<img src=x onerror/)).toBeInTheDocument();
  });
});

describe("EstadoDeConsulta", () => {
  const consulta = (parcial: object) => parcial as never;

  it("muestra el esqueleto, el error con «Reintentar» y los datos", async () => {
    const { rerender } = render(
      <EstadoDeConsulta
        consulta={consulta({ isPending: true, isError: false })}
      >
        {() => <p>datos</p>}
      </EstadoDeConsulta>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");

    const refetch = vi.fn();
    rerender(
      <EstadoDeConsulta
        titulo="No se pudo cargar la bandeja"
        consulta={consulta({
          isPending: false,
          isError: true,
          error: new ErrorDeCliente(503, "Growth no está configurado."),
          refetch,
        })}
      >
        {() => <p>datos</p>}
      </EstadoDeConsulta>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo cargar la bandeja"
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Growth no está configurado."
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender(
      <EstadoDeConsulta
        consulta={consulta({
          isPending: false,
          isError: false,
          data: { n: 3 },
        })}
      >
        {(datos: { n: number }) => <p>hay {datos.n}</p>}
      </EstadoDeConsulta>
    );
    expect(screen.getByText("hay 3")).toBeInTheDocument();
  });

  it("ErrorDeCarga sin función de reintento no enseña el botón", () => {
    render(<ErrorDeCarga error={new Error("x")} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Inténtalo de nuevo");
  });
});

describe("Paginacion", () => {
  it("no pinta nada si todo cabe en una página", () => {
    const { container } = render(
      <Paginacion pagina={1} limite={50} total={30} alCambiar={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("dice el tramo, deshabilita los extremos y cambia de página", async () => {
    const alCambiar = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Paginacion pagina={1} limite={50} total={120} alCambiar={alCambiar} />
    );
    expect(screen.getByText("1–50 de 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(alCambiar).toHaveBeenCalledWith(2);

    rerender(
      <Paginacion pagina={3} limite={50} total={120} alCambiar={alCambiar} />
    );
    expect(screen.getByText("101–120 de 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(alCambiar).toHaveBeenLastCalledWith(2);
  });
});

describe("EstadoVacio", () => {
  it("lleva título, texto y acción", () => {
    render(
      <EstadoVacio
        titulo="Esta semana no hay nada que merezca tu tiempo"
        accion={<button>Añadir URL</button>}
      >
        Se descartaron 3 candidatas.
      </EstadoVacio>
    );
    expect(
      screen.getByRole("heading", {
        name: "Esta semana no hay nada que merezca tu tiempo",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se descartaron 3 candidatas.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Añadir URL" })
    ).toBeInTheDocument();
  });
});

describe("etiquetas", () => {
  it("cubren todo el vocabulario de la API (si el backend añade un valor, este test avisa)", () => {
    const claves = (o: object) => Object.keys(o).sort();
    expect(claves(ETIQUETA_DE_ESTADO)).toEqual(
      [...ESTADOS_DE_OPORTUNIDAD].sort()
    );
    expect(claves(TONO_DE_ESTADO)).toEqual([...ESTADOS_DE_OPORTUNIDAD].sort());
    expect(claves(ETIQUETA_DE_ESTADO_DE_BORRADOR)).toEqual(
      [...ESTADOS_DE_BORRADOR].sort()
    );
    expect(claves(ETIQUETA_DE_OBJETIVO)).toEqual([...OBJETIVOS].sort());
    expect(claves(ETIQUETA_DE_TIPO_DE_BORRADOR)).toEqual(
      [...TIPOS_DE_BORRADOR].sort()
    );
    expect(claves(ETIQUETA_DE_GRUPO_DE_BORRADORES)).toEqual(
      [...GRUPOS_DE_BORRADORES].sort()
    );
    expect(claves(ETIQUETA_DE_CODIGO_DE_DESCARTE)).toEqual(
      [...CODIGOS_DE_DESCARTE].sort()
    );
    expect(claves(ETIQUETA_DE_TIPO_DE_AFIRMACION)).toEqual(
      [...TIPOS_DE_AFIRMACION].sort()
    );
    expect(claves(ETIQUETA_DE_CANAL)).toEqual([...CANALES].sort());
    expect(claves(ETIQUETA_DE_RESULTADO)).toEqual(["aviso", "bloquea", "pasa"]);
    expect(claves(ETIQUETA_DE_ESTADO_DE_EJECUCION)).toEqual([
      "en_curso",
      "error",
      "ok",
      "parcial",
    ]);
    expect(claves(ETIQUETA_DE_ACCION)).toEqual([
      "aprobar",
      "conseguido",
      "descartar",
      "devolver",
      "marcar_gestionado",
      "rechazado",
      "sin_respuesta",
    ]);
  });

  it("«sin_respuesta» se llama «Cerrada sin éxito» (decisión 6 de la 1b)", () => {
    expect(ETIQUETA_DE_ESTADO.sin_respuesta).toBe("Cerrada sin éxito");
    render(<InsigniaDeEstado estado="sin_respuesta" />);
    expect(screen.getByText("Cerrada sin éxito")).toBeInTheDocument();
  });

  it("lo desconocido sale legible en vez de romper", () => {
    expect(etiquetaDeRegla("regla_nueva_del_backend")).toBe(
      "regla nueva del backend"
    );
    expect(etiquetaDeCodigoDeDescarte("motivo_nuevo")).toBe("motivo nuevo");
    expect(etiquetaDeAccionDelRegistro("algo_nuevo")).toBe("algo nuevo");
    expect(etiquetaDeAccionDelRegistro("anadir_url")).toBe("URL añadida");
  });

  it("dice quién hizo cada cosa", () => {
    expect(etiquetaDeAutor("sistema")).toBe("Sistema");
    expect(etiquetaDeAutor("agente:orquestador")).toBe("Agente (orquestador)");
    expect(etiquetaDeAutor("admin@alhabla.ai")).toBe("admin@alhabla.ai");
  });
});
