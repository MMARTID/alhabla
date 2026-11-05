import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Con píxel de Meta: dos finalidades (medición y publicidad). El ID tiene que
// estar antes de importar el componente, que lo lee al cargarse.
const estado = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890";
  return {
    ruta: "/planes",
    scripts: [] as string[],
    alCargarGoogle: null as null | (() => void),
  };
});

vi.mock("next/navigation", () => ({ usePathname: () => estado.ruta }));
vi.mock("next/script", () => ({
  default: ({ src, onReady }: { src: string; onReady?: () => void }) => {
    estado.scripts.push(src);
    if (src.includes("googletagmanager")) estado.alCargarGoogle = onReady ?? null;
    return null;
  },
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

const { GoogleAnalytics, medirEvento } = await import(
  "@/components/google-analytics"
);

function comoEnLaWeb() {
  return (
    <GoogleAnalytics
      enlaceDePrivacidad="/legal/privacidad"
      grupoDeContenido="web"
      eventosDeRuta={{ planes: "ver_planes" }}
      paginasVistasEnMeta
    />
  );
}

/** Lo que se ha pedido a `fbq`: sin fbevents.js cargado, todo queda en cola. */
function llamadasDeMeta(): unknown[][] {
  return (window.fbq?.queue ?? []) as unknown[][];
}

function enviadosAMeta(): unknown[][] {
  return llamadasDeMeta().filter((llamada) => llamada[0] === "track");
}

function cargaMeta() {
  return estado.scripts.some((src) => src.includes("connect.facebook.net"));
}

function cargaGoogle() {
  return estado.scripts.some((src) => src.includes("googletagmanager"));
}

beforeEach(() => {
  for (const nombre of ["alhabla_analitica", "alhabla_cookies", "_fbp", "_ga"]) {
    document.cookie = `${nombre}=; Path=/; Max-Age=0`;
  }
  window.history.replaceState(null, "", "/planes");
  window.dataLayer = undefined;
  window.gtag = undefined;
  window.alhablaGtagConfigurado = false;
  window.fbq = undefined;
  window._fbq = undefined;
  window.alhablaPixelConfigurado = false;
  estado.ruta = "/planes";
  estado.scripts = [];
  estado.alCargarGoogle = null;
});

describe("aviso con dos finalidades", () => {
  it("ofrece Aceptar, Rechazar y Configurar sin cargar nada antes", async () => {
    render(comoEnLaWeb());
    expect(
      await screen.findByRole("button", { name: "Aceptar cookies" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rechazar cookies" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configurar por finalidad" })
    ).toHaveTextContent("Configurar");
    expect(screen.getByText(/de publicidad \(Meta\)/)).toBeInTheDocument();
    expect(estado.scripts).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
  });

  it("rechazar rechaza las dos y no carga ni Google ni Meta", async () => {
    render(comoEnLaWeb());
    fireEvent.click(
      await screen.findByRole("button", { name: "Rechazar cookies" })
    );
    expect(document.cookie).toContain("alhabla_cookies=medicion:0|publicidad:0");
    expect(cargaGoogle()).toBe(false);
    expect(cargaMeta()).toBe(false);
  });

  it("aceptar carga las dos, y Meta sin eventos automáticos ni páginas vistas solas", async () => {
    render(comoEnLaWeb());
    fireEvent.click(
      await screen.findByRole("button", { name: "Aceptar cookies" })
    );
    expect(document.cookie).toContain("alhabla_cookies=medicion:1|publicidad:1");
    await waitFor(() => expect(cargaMeta()).toBe(true));
    expect(cargaGoogle()).toBe(true);
    expect(window.fbq?.disablePushState).toBe(true);
    expect(llamadasDeMeta()).toEqual(
      expect.arrayContaining([
        ["set", "autoConfig", false, "1234567890"],
        ["init", "1234567890"],
        ["consent", "grant"],
      ])
    );
    // /planes: la página vista y su evento de ruta (`ver_planes`).
    expect(enviadosAMeta()).toEqual([
      ["track", "PageView"],
      ["track", "ViewContent", { content_name: "planes" }],
    ]);
  });

  it("en el panel se puede aceptar solo la publicidad", async () => {
    render(comoEnLaWeb());
    fireEvent.click(
      await screen.findByRole("button", { name: "Configurar por finalidad" })
    );
    expect(screen.getByText("Siempre activas")).toBeInTheDocument();
    const medicion = screen.getByRole("switch", {
      name: "Cookies de medición",
    });
    const publicidad = screen.getByRole("switch", {
      name: "Cookies de publicidad",
    });
    // Nada marcado de antemano.
    expect(medicion).toHaveAttribute("aria-checked", "false");
    expect(publicidad).toHaveAttribute("aria-checked", "false");

    fireEvent.click(publicidad);
    fireEvent.click(screen.getByRole("button", { name: "Guardar selección" }));

    expect(document.cookie).toContain("alhabla_cookies=medicion:0|publicidad:1");
    await waitFor(() => expect(cargaMeta()).toBe(true));
    expect(cargaGoogle()).toBe(false);
  });

  it("el botón de la galleta reabre el panel con lo elegido y permite retirar la publicidad", async () => {
    document.cookie = "alhabla_cookies=medicion:1|publicidad:1; Path=/";
    document.cookie = "_fbp=fb.1.123.456; Path=/";
    render(comoEnLaWeb());
    await waitFor(() => expect(cargaMeta()).toBe(true));

    fireEvent.click(
      screen.getByRole("button", { name: "Configurar cookies" })
    );
    const publicidad = screen.getByRole("switch", {
      name: "Cookies de publicidad",
    });
    expect(publicidad).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Cookies de medición" })
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(publicidad);
    fireEvent.click(screen.getByRole("button", { name: "Guardar selección" }));

    expect(document.cookie).toContain("alhabla_cookies=medicion:1|publicidad:0");
    expect(document.cookie).not.toContain("_fbp=");
    expect(llamadasDeMeta()).toContainEqual(["consent", "revoke"]);
  });

  it("quien solo aceptó la medición con el aviso anterior sigue midiéndose, pero se le pregunta por la publicidad", async () => {
    document.cookie = "alhabla_analitica=aceptada; Path=/";
    render(comoEnLaWeb());
    expect(
      await screen.findByRole("button", { name: "Aceptar cookies" })
    ).toBeInTheDocument();
    await waitFor(() => expect(cargaGoogle()).toBe(true));
    expect(cargaMeta()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Rechazar cookies" }));
    // La elección nueva sustituye a la anterior, que se borra.
    expect(document.cookie).toContain("alhabla_cookies=medicion:0|publicidad:0");
    expect(document.cookie).not.toContain("alhabla_analitica=");
  });
});

describe("qué llega a Meta", () => {
  async function conPublicidadAceptada() {
    document.cookie = "alhabla_cookies=medicion:0|publicidad:1; Path=/";
    render(comoEnLaWeb());
    await waitFor(() => expect(cargaMeta()).toBe(true));
  }

  it("una URL con un parámetro que no está en la lista no manda la página vista", async () => {
    window.history.replaceState(null, "", "/planes?pase=secreto");
    await conPublicidadAceptada();
    expect(enviadosAMeta()).toEqual([]);
  });

  it("los parámetros de campaña sí", async () => {
    window.history.replaceState(
      null,
      "",
      "/planes?utm_source=facebook&fbclid=abc&plan=pro"
    );
    await conPublicidadAceptada();
    expect(enviadosAMeta()).toContainEqual(["track", "PageView"]);
  });

  it("las conversiones van con su nombre estándar y solo con el plan", async () => {
    await conPublicidadAceptada();
    act(() => {
      medirEvento("sign_up", { method: "email" });
      medirEvento("generate_lead", { formulario: "contacto", sedes: "1" });
      medirEvento("begin_checkout", { plan: "pro" });
      medirEvento("checkout_completado", { plan: "pro", estado: "prueba" });
      medirEvento("checkout_completado", { plan: "pro", estado: "activa" });
      // Sin equivalente en Meta: no sale.
      medirEvento("clic_probar", { ubicacion: "portada" });
    });
    expect(enviadosAMeta().slice(2)).toEqual([
      ["track", "CompleteRegistration", {}],
      ["track", "Lead", {}],
      ["track", "InitiateCheckout", { content_name: "pro" }],
      ["track", "StartTrial", { content_name: "pro" }],
      ["track", "Subscribe", { content_name: "pro" }],
    ]);
  });

  it("con el session_id de Stripe en la URL no sale la conversión", async () => {
    await conPublicidadAceptada();
    window.history.replaceState(null, "", "/checkout/resultado?session_id=cs_x");
    const salio = medirEvento("checkout_completado", {
      plan: "pro",
      estado: "prueba",
    });
    expect(salio).toBe(false);
    expect(enviadosAMeta()).not.toContainEqual(
      expect.arrayContaining(["StartTrial"])
    );
  });

  it("sin la publicidad aceptada no sale nada a Meta aunque se mida en Google", async () => {
    document.cookie = "alhabla_cookies=medicion:1|publicidad:0; Path=/";
    render(comoEnLaWeb());
    await waitFor(() => expect(estado.alCargarGoogle).not.toBeNull());
    act(() => estado.alCargarGoogle?.());
    act(() => {
      medirEvento("sign_up", { method: "email" });
    });
    expect(window.fbq).toBeUndefined();
    expect(cargaMeta()).toBe(false);
  });
});
