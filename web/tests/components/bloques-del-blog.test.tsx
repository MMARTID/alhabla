import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  Apartado,
  Cuenta,
  Faq,
  Indice,
  Plantilla,
  Tabla,
  idDeApartado,
  respuestaSinEnlaces,
  textoPlano,
} from "@/components/blog/bloques";

describe("bloques del blog", () => {
  it("el ancla de un apartado no lleva tildes, signos ni mayúsculas", () => {
    expect(idDeApartado("¿Cuánto cuesta una recepcionista en 2026?")).toBe(
      "cuanto-cuesta-una-recepcionista-en-2026"
    );
    expect(idDeApartado("Movistar, Vodafone y Orange")).toBe(
      "movistar-vodafone-y-orange"
    );
    expect(textoPlano(["Con ", <strong key="a">negrita</strong>, " dentro"])).toBe(
      "Con negrita dentro"
    );
  });

  it("el índice salta al id que reciben los ## del artículo", () => {
    render(
      <>
        <Indice apartados={[{ texto: "Qué es el mensaje de ausencia" }]} />
        <Apartado>Qué es el mensaje de ausencia</Apartado>
      </>
    );
    const enlace = screen.getByRole("link", { name: "Qué es el mensaje de ausencia" });
    const titulo = screen.getByRole("heading", { level: 2 });
    expect(enlace.getAttribute("href")).toBe(`#${titulo.id}`);
    expect(titulo.id).toBe("que-es-el-mensaje-de-ausencia");
  });

  it("la tabla pone cabeceras, la primera columna como cabecera de fila y los códigos en monoespaciado", () => {
    render(
      <Tabla
        titulo="Operadores"
        columnas={["Operador", "Para quitarlo"]}
        filas={[{ celdas: ["Movistar", "`##002#`"] }]}
        nota="Fuente: ayuda del operador."
      />
    );
    const tabla = screen.getByRole("table");
    expect(within(tabla).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Operador",
      "Para quitarlo",
    ]);
    expect(within(tabla).getByRole("rowheader")).toHaveTextContent("Movistar");
    expect(tabla.querySelector("code")).toHaveTextContent("##002#");
    expect(screen.getByText("Fuente: ayuda del operador.")).toBeInTheDocument();
  });

  it("la cuenta enseña cada línea y el total", () => {
    render(
      <Cuenta
        lineas={[
          { concepto: "Sueldo bruto", importe: "17.500 €" },
          { concepto: "Seguridad Social", importe: "5.626 €", detalle: "32,15 %" },
        ]}
        totalConcepto="Coste al año"
        total="23.126 €"
      />
    );
    expect(screen.getByText("Sueldo bruto")).toBeInTheDocument();
    expect(screen.getByText("32,15 %")).toBeInTheDocument();
    expect(screen.getByText("Coste al año")).toBeInTheDocument();
    expect(screen.getByText("23.126 €")).toBeInTheDocument();
  });

  it("la plantilla copia el texto tal cual, con sus saltos de línea", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const texto = "¡Hola! Gracias por escribirnos.\nTe contestamos en cuanto podamos.";
    render(<Plantilla titulo="Bienvenida" texto={texto} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copiar/ }));
    });

    expect(writeText).toHaveBeenCalledWith(texto);
    expect(screen.getByRole("button", { name: /Copiado/ })).toBeInTheDocument();
  });

  it("las preguntas frecuentes se declaran también a Google como FAQPage, con el mismo texto que ve el lector", () => {
    const { container } = render(
      <Faq
        preguntas={[
          { pregunta: "¿Se puede usar en el ordenador?", respuesta: "Sí, vinculando el dispositivo." },
          { pregunta: "¿Y con </script> dentro?", respuesta: "Se escapa el signo menor." },
        ]}
      />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const crudo = script!.innerHTML;
    expect(crudo).not.toContain("</script>");
    const datos = JSON.parse(crudo);
    expect(datos["@type"]).toBe("FAQPage");
    expect(datos.mainEntity).toHaveLength(2);
    expect(datos.mainEntity[0].name).toBe("¿Se puede usar en el ordenador?");
    expect(datos.mainEntity[0].acceptedAnswer.text).toBe("Sí, vinculando el dispositivo.");
    expect(screen.getByText("Sí, vinculando el dispositivo.")).toBeInTheDocument();
  });

  it("sin preguntas, el bloque no emite JSON-LD", () => {
    const { container } = render(<Faq preguntas={[]} />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("una respuesta puede llevar enlaces: el lector los ve, Google recibe el texto plano", () => {
    const respuesta =
      "Lo dice el [BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) y lo explicamos en [la guía](/guias/ley-y-recepcionista-de-ia).";
    expect(respuestaSinEnlaces(respuesta)).toBe(
      "Lo dice el BOE y lo explicamos en la guía."
    );
    const { container } = render(
      <Faq preguntas={[{ pregunta: "¿Es legal?", respuesta }]} />
    );
    const boe = screen.getByRole("link", { name: "BOE" });
    expect(boe.getAttribute("href")).toBe("https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758");
    expect(screen.getByRole("link", { name: "la guía" }).getAttribute("href")).toBe(
      "/guias/ley-y-recepcionista-de-ia"
    );
    const datos = JSON.parse(container.querySelector("script")!.innerHTML);
    expect(datos.mainEntity[0].acceptedAnswer.text).toBe("Lo dice el BOE y lo explicamos en la guía.");
  });
});
