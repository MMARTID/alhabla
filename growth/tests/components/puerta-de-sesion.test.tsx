import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PuertaDeSesion } from "@/components/puerta-de-sesion";
import { useResumen } from "@/lib/consultas";
import {
  guardarCredencial,
  marcarCaducada,
  marcarSinAcceso,
  obtenerEstadoDeSesion,
  reiniciarSesionParaPruebas,
} from "@/lib/sesion";
import { clienteFalso } from "../helpers/cliente-falso";
import { instalarGoogleFalso } from "../helpers/google-falso";
import { crearJwt } from "../helpers/jwt";
import { renderConCliente } from "../helpers/render";
import { reiniciarTodo } from "../helpers/reiniciar";

function errorHttp(estado: number, data: unknown = {}): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  return new AxiosError("fallo", AxiosError.ERR_BAD_RESPONSE, config, null, {
    status: estado,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

/** El «panel»: un borrador que se está escribiendo y un dato del backend. */
function Panel() {
  const [texto, setTexto] = useState("");
  const resumen = useResumen();
  return (
    <div>
      <p>Contenido del panel</p>
      <textarea
        aria-label="Borrador"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <p>Por revisar: {resumen.data?.paraRevisar ?? "…"}</p>
    </div>
  );
}

function montar(cliente: ReturnType<typeof clienteFalso>) {
  return renderConCliente(
    <PuertaDeSesion>
      <Panel />
    </PuertaDeSesion>,
    cliente
  );
}

const RESUMEN = { paraRevisar: 3 } as never;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  reiniciarTodo();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sin sesión", () => {
  it("pinta el botón de Google y nada del panel, y prueba el inicio automático una vez", async () => {
    const google = instalarGoogleFalso();
    montar(clienteFalso());

    expect(await screen.findByTestId("boton-google-falso")).toBeInTheDocument();
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Alhabla Growth" })
    ).toBeInTheDocument();
    await waitFor(() => expect(google.id.prompt).toHaveBeenCalledTimes(1));
  });

  it("si Google no carga, lo dice y deja reintentar", async () => {
    const { id } = instalarGoogleFalso();
    id.renderButton.mockImplementationOnce(() => {
      throw new Error("bloqueado");
    });
    montar(clienteFalso());

    expect(
      await screen.findByText(
        "No se pudo cargar el inicio de sesión de Google."
      )
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByTestId("boton-google-falso")).toBeInTheDocument();
  });
});

describe("con una credencial de Google", () => {
  it("no enseña el panel hasta comprobar el acceso con GET /yo", async () => {
    const google = instalarGoogleFalso();
    let resolver!: (valor: { email: string }) => void;
    const cliente = clienteFalso({
      yo: () => new Promise((resolve) => (resolver = resolve)),
      resumen: async () => RESUMEN,
    });
    montar(cliente);
    await screen.findByTestId("boton-google-falso");

    act(() => google.entregar(crearJwt({ email: "admin@alhabla.ai" })));

    expect(
      await screen.findByText("Comprobando tu acceso…")
    ).toBeInTheDocument();
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();

    await act(async () => resolver({ email: "admin@alhabla.ai" }));
    expect(await screen.findByText("Contenido del panel")).toBeInTheDocument();
    expect(cliente.yo).toHaveBeenCalledTimes(1);
  });

  it("entra solo si ya había una sesión viva en la pestaña", async () => {
    instalarGoogleFalso();
    guardarCredencial(crearJwt({ email: "admin@alhabla.ai" }));
    reiniciarSesionParaPruebas(); // «recargar»: la sesión se recupera de sessionStorage
    const cliente = clienteFalso({
      yo: async () => ({ email: "admin@alhabla.ai" }),
      resumen: async () => RESUMEN,
    });
    montar(cliente);
    expect(await screen.findByText("Contenido del panel")).toBeInTheDocument();
  });

  it("403: «Esta cuenta no tiene acceso» con el correo, y «Usar otra cuenta» vuelve al botón", async () => {
    const google = instalarGoogleFalso();
    const cliente = clienteFalso({
      yo: async () => {
        marcarSinAcceso(); // lo que hace el interceptor de axios
        throw errorHttp(403, { error: "No tienes acceso." });
      },
    });
    montar(cliente);
    await screen.findByTestId("boton-google-falso");
    act(() => google.entregar(crearJwt({ email: "intruso@ejemplo.example" })));

    expect(
      await screen.findByRole("heading", {
        name: "Esta cuenta no tiene acceso a Growth",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("intruso@ejemplo.example")).toBeInTheDocument();
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Usar otra cuenta" }));
    expect(google.id.disableAutoSelect).toHaveBeenCalled();
    expect(obtenerEstadoDeSesion().estado).toBe("sin_sesion");
    expect(await screen.findByTestId("boton-google-falso")).toBeInTheDocument();
  });

  it("503: dice «Growth no está configurado.» y deja reintentar", async () => {
    const google = instalarGoogleFalso();
    const cliente = clienteFalso({
      yo: vi
        .fn()
        .mockRejectedValueOnce(
          errorHttp(503, { error: "Growth no está configurado." })
        )
        .mockResolvedValue({ email: "admin@alhabla.ai" }),
      resumen: async () => RESUMEN,
    });
    montar(cliente);
    await screen.findByTestId("boton-google-falso");
    act(() => google.entregar(crearJwt()));

    expect(
      await screen.findByRole("heading", { name: "Growth no está configurado" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Growth no está configurado."
    );
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Contenido del panel")).toBeInTheDocument();
  });

  it("401 al entrar: vuelve a pedir el inicio de sesión con un aviso, sin diálogo", async () => {
    const google = instalarGoogleFalso();
    const cliente = clienteFalso({
      yo: async () => {
        marcarCaducada();
        throw errorHttp(401, {
          error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
        });
      },
    });
    montar(cliente);
    await screen.findByTestId("boton-google-falso");
    act(() => google.entregar(crearJwt()));

    expect(
      await screen.findByText("Tu sesión ha caducado. Vuelve a iniciar sesión.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();
  });
});

describe("la sesión caduca con el panel abierto", () => {
  async function entrarEnElPanel() {
    const google = instalarGoogleFalso();
    const cliente = clienteFalso({
      yo: async () => ({ email: "admin@alhabla.ai" }),
      resumen: vi.fn(async () => RESUMEN),
    });
    montar(cliente);
    await screen.findByTestId("boton-google-falso");
    act(() => google.entregar(crearJwt({ email: "admin@alhabla.ai" })));
    await screen.findByText("Contenido del panel");
    return { google, cliente };
  }

  it("el panel y lo que estabas escribiendo SE QUEDAN; encima sale el diálogo, y el fondo no se puede usar", async () => {
    await entrarEnElPanel();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Borrador"),
      "Hola, soy el equipo de Alhabla"
    );

    act(() => marcarCaducada());

    const dialogo = await screen.findByRole("alertdialog", {
      name: "Tu sesión ha caducado",
    });
    expect(
      within(dialogo).getByTestId("boton-google-falso")
    ).toBeInTheDocument();
    expect(dialogo).toHaveFocus();
    const borrador = screen.getByLabelText("Borrador");
    expect(borrador).toHaveValue("Hola, soy el equipo de Alhabla");
    // El fondo queda inerte: ni foco ni clics hasta volver a entrar.
    expect(borrador.closest("[inert]")).not.toBeNull();
    expect(dialogo.closest("[inert]")).toBeNull();
  });

  it("al volver a entrar el diálogo se cierra, el borrador sigue intacto y se refresca lo de pantalla", async () => {
    const { google, cliente } = await entrarEnElPanel();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Borrador"),
      "Mi borrador sin guardar"
    );
    expect(cliente.resumen).toHaveBeenCalledTimes(1);

    act(() => marcarCaducada());
    await screen.findByRole("alertdialog");
    act(() => google.entregar(crearJwt({ email: "admin@alhabla.ai" })));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText("Borrador")).toHaveValue(
      "Mi borrador sin guardar"
    );
    expect(screen.getByLabelText("Borrador").closest("[inert]")).toBeNull();
    // Lo que había en pantalla se vuelve a pedir con el token nuevo.
    await waitFor(() => expect(cliente.resumen).toHaveBeenCalledTimes(2));
  });

  it("si vuelve a entrar con OTRA cuenta, el panel se monta de nuevo (no se arrastra nada)", async () => {
    const google = instalarGoogleFalso();
    const yo = vi
      .fn()
      .mockResolvedValueOnce({ email: "admin@alhabla.ai" })
      .mockResolvedValueOnce({ email: "otra@alhabla.ai" });
    montar(clienteFalso({ yo, resumen: async () => RESUMEN }));
    await screen.findByTestId("boton-google-falso");
    act(() => google.entregar(crearJwt({ email: "admin@alhabla.ai" })));
    await screen.findByText("Contenido del panel");
    await userEvent
      .setup()
      .type(screen.getByLabelText("Borrador"), "de la primera cuenta");

    act(() => marcarCaducada());
    await screen.findByRole("alertdialog");
    act(() => google.entregar(crearJwt({ email: "otra@alhabla.ai" })));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(await screen.findByLabelText("Borrador")).toHaveValue("");
  });
});

describe("el modo demostración", () => {
  it("se salta Google: el panel aparece sin sesión ni botón", () => {
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    montar(clienteFalso({ resumen: async () => RESUMEN }));
    expect(screen.getByText("Contenido del panel")).toBeInTheDocument();
    expect(window.google).toBeUndefined();
    expect(
      document.head.querySelector('script[src*="accounts.google.com"]')
    ).toBeNull();
  });

  it("en producción NO existe, aunque la variable esté puesta", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    instalarGoogleFalso();
    montar(clienteFalso());
    expect(screen.queryByText("Contenido del panel")).not.toBeInTheDocument();
    expect(await screen.findByTestId("boton-google-falso")).toBeInTheDocument();
  });
});
