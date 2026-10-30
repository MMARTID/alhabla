import { vi } from "vitest";
import type { RespuestaDeCredencial } from "@/lib/gis";

/**
 * Un `window.google.accounts.id` falso: guarda el `callback` de `initialize`
 * para que el test pueda «entregar» una credencial, como haría Google.
 */
export function instalarGoogleFalso() {
  let callback: ((respuesta: RespuestaDeCredencial) => void) | null = null;
  const id = {
    initialize: vi.fn(
      (opciones: { callback: (r: RespuestaDeCredencial) => void }) => {
        callback = opciones.callback;
      }
    ),
    renderButton: vi.fn((padre: HTMLElement) => {
      const boton = document.createElement("div");
      boton.setAttribute("data-testid", "boton-google-falso");
      padre.appendChild(boton);
    }),
    prompt: vi.fn(),
    cancel: vi.fn(),
    disableAutoSelect: vi.fn(),
  };
  window.google = { accounts: { id } };
  return {
    id,
    /** Google entrega un ID token. */
    entregar(credential: string) {
      if (!callback) throw new Error("initialize no se ha llamado todavía.");
      callback({ credential });
    },
  };
}
