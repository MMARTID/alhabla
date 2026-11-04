import { describe, it, expect } from "vitest";
import { flujoDeLaCooficial } from "../../src/lib/telnyxAssistantPayload.js";
import { resolverIdiomas } from "../../src/lib/idiomas/resolver.js";
import type { CodigoDeIdioma } from "../../src/lib/idiomas/catalogo.js";

/** Un negocio que saluda en castellano en una zona con cooficial. */
const flujo = (zona: CodigoDeIdioma) =>
  flujoDeLaCooficial(
    resolverIdiomas({
      languages: ["es-ES"],
      voiceLanguage: "es-ES",
      voiceGender: "femenina",
      zona,
    })
  )!;

const instrucciones = (id: string, f: ReturnType<typeof flujo>) =>
  (f.nodes.find((nodo) => nodo.id === id) as { instructions: string })
    .instructions;

describe("flujoDeLaCooficial", () => {
  it("sin cooficial en la zona no hay flujo", () => {
    expect(
      flujoDeLaCooficial(
        resolverIdiomas({
          languages: ["es-ES"],
          voiceLanguage: "es-ES",
          voiceGender: "femenina",
        })
      )
    ).toBeNull();
  });

  it("la primera respuesta en catalán empieza por la frase del cambio y contesta en ese turno", () => {
    const cooficial = instrucciones("cooficial", flujo("ca-ES"));

    expect(cooficial).toContain(
      "Empieza tu primera respuesta en catalán con «Cap problema, et parlo en català.» y, en ese mismo turno, contesta a lo que ha pedido"
    );
    expect(cooficial).toContain(
      "si el saludo ya fue en catalán, sáltate esa frase"
    );
  });

  it("cada cooficial lleva su frase", () => {
    expect(instrucciones("cooficial", flujo("eu-ES"))).toContain(
      "«Ados, euskaraz hitz egingo dizut.»"
    );
    expect(instrucciones("cooficial", flujo("gl-ES"))).toContain(
      "«Moi ben, seguimos en galego.»"
    );
  });

  it("una frase entera en castellano vuelve al nodo inicial, igual que los demás idiomas", () => {
    const f = flujo("ca-ES");
    const vuelta = f.edges!.find((arista) => arista.id === "a_inicial")!;

    expect(vuelta.target).toEqual({ type: "node", node_id: "inicial" });
    expect(vuelta.condition).toEqual({
      type: "llm",
      prompt:
        "Quien llama habla castellano (una frase entera, no una palabra suelta como «vale»), inglés, francés, alemán, italiano, portugués, neerlandés o ruso.",
    });
    expect(instrucciones("cooficial", f)).toContain(
      "Fíjate en el idioma de su última frase: si habla en castellano (una frase entera, no una palabra suelta como «vale»), inglés"
    );
  });
});
