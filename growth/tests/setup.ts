import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// La configuración pública que `src/lib/config.ts` lee al cargar. Los tests de
// configuración la cambian con `vi.stubEnv` y `vi.resetModules()`.
process.env.NEXT_PUBLIC_API_BASE_URL ??= "https://api.alhabla.ai";
process.env.NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID ??=
  "ci-sin-valor-real.apps.googleusercontent.com";

// Con `globals: false`, @testing-library/react no detecta `afterEach` en el
// ámbito global y no limpia el DOM sola entre tests — hay que registrarlo a mano.
afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  // jsdom no implementa matchMedia, que el tema consulta para seguir al
  // sistema. Por defecto responde «sin preferencia» (tema claro); los tests
  // que necesiten lo contrario lo sobrescriben.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
