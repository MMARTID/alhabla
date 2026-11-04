import { describe, it, expect } from "vitest";
import {
  assistantsDeLasTareas,
  claveDelAssistant,
  type ContextoDelNegocio,
  type Tarea,
} from "../../scripts/laboratorioDePrompt.js";
import { todosLosGuiones } from "../../scripts/laboratorioDePrompt.escenarios.js";

const deLlamada = todosLosGuiones().find((g) => g.canal === "llamada")!;
const deChat = todosLosGuiones().find((g) => g.canal === "chat")!;

function tarea(guion: Tarea["guion"]): Tarea {
  return {
    guion,
    escenarioId: "E",
    variante: "control",
    repeticion: 1,
    negocioId: "neg",
    negocioOrigen: "laboratorio",
  };
}

function contexto(conChat: boolean): ContextoDelNegocio {
  return {
    negocioId: "neg",
    nombre: "Lab",
    zonaHoraria: "Europe/Madrid",
    saludo: "",
    payloads: { control: { name: "alhabla-lab-prompt-x-control", instructions: "voz" } } as never,
    ...(conChat
      ? { payloadsDeChat: { control: { name: "alhabla-lab-prompt-x-control-chat", instructions: "chat" } } as never }
      : {}),
    llamadas: [],
    telefonos: {},
    chats: [],
    avisos: [],
  };
}

describe("laboratorio con los assistants de voz y chat separados", () => {
  it("los guiones de chat van al assistant de chat y los de llamada al de voz", () => {
    const c = contexto(true);
    expect(claveDelAssistant(tarea(deLlamada), c)).toBe("neg:control");
    expect(claveDelAssistant(tarea(deChat), c)).toBe("neg:control:chat");
    const porCrear = assistantsDeLasTareas(
      [tarea(deLlamada), tarea(deChat), tarea(deChat)],
      new Map([["neg", c]])
    );
    expect([...porCrear.keys()]).toEqual(["neg:control", "neg:control:chat"]);
    expect(porCrear.get("neg:control:chat")!.payload.instructions).toBe("chat");
  });

  it("sin payload de chat, todo al de siempre", () => {
    const c = contexto(false);
    expect(claveDelAssistant(tarea(deChat), c)).toBe("neg:control");
    expect([
      ...assistantsDeLasTareas([tarea(deLlamada), tarea(deChat)], new Map([["neg", c]])).keys(),
    ]).toEqual(["neg:control"]);
  });
});
