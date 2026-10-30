import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  useAjustes,
  useAnadirUrl,
  useDecidir,
  useDecisiones,
  useEditarBorrador,
  useGuardarAjustes,
  useOportunidades,
  useResumen,
} from "@/lib/consultas";
import { mensajeDeError } from "@/lib/api-errors";
import { renderConCliente } from "../helpers/render";

/** Una «vista» mínima que usa los hooks reales contra el cliente de demostración. */
function Recorrido() {
  const bandeja = useOportunidades({
    estado: ["pendiente_aprobacion"],
    orden: "puntuacion",
  });
  const resumen = useResumen();
  const decisiones = useDecisiones({ oportunidadId: "demo-op-06" });
  const decidir = useDecidir("demo-op-06");
  const editar = useEditarBorrador("demo-bo-06-1");
  const anadir = useAnadirUrl();
  const ajustes = useAjustes();
  const guardar = useGuardarAjustes();
  return (
    <div>
      <p data-testid="bandeja">
        {bandeja.data?.data.map((o) => o.id).join(",")}
      </p>
      <p data-testid="para-revisar">{resumen.data?.paraRevisar}</p>
      <p data-testid="historial">
        {decisiones.data?.data.map((d) => d.accion).join(",")}
      </p>
      <p data-testid="tope">{ajustes.data?.valores.topeSemanal}</p>
      <p data-testid="error">
        {decidir.error ? mensajeDeError(decidir.error, "fallo") : ""}
      </p>
      <button
        onClick={() =>
          decidir.mutate({ accion: "aprobar", borradorId: "demo-bo-06-1" })
        }
      >
        aprobar
      </button>
      <button
        onClick={() =>
          decidir.mutate({ accion: "marcar_gestionado", canal: "email" })
        }
      >
        gestionar-mal
      </button>
      <button
        onClick={() => editar.mutate({ texto: "Alhabla, el mejor del mundo" })}
      >
        editar
      </button>
      <button onClick={() => anadir.mutate({ url: "https://nueva.example/x" })}>
        anadir
      </button>
      <button onClick={() => guardar.mutate({ topeSemanal: 9 })}>
        guardar
      </button>
    </div>
  );
}

function montar() {
  return renderConCliente(<Recorrido />, clienteDemo({ retardoMs: 0 }));
}

describe("los hooks de datos", () => {
  it("Bandeja → Aprobar → Historial: tras decidir, todo lo que cuelga de growth se refresca", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("bandeja")).toHaveTextContent(
        "demo-op-05,demo-op-06"
      )
    );
    expect(screen.getByTestId("para-revisar")).toHaveTextContent("2");
    expect(screen.getByTestId("historial")).toHaveTextContent("");

    await user.click(screen.getByRole("button", { name: "aprobar" }));

    // La oportunidad sale de la Bandeja, el contador baja y el Historial la recoge.
    await waitFor(() =>
      expect(screen.getByTestId("bandeja")).toHaveTextContent(/^demo-op-05$/)
    );
    expect(screen.getByTestId("para-revisar")).toHaveTextContent("1");
    expect(screen.getByTestId("historial")).toHaveTextContent("aprobar");
  });

  it("un 409 llega a la vista con su frase y no cambia nada", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("para-revisar")).toHaveTextContent("2")
    );
    await user.click(screen.getByRole("button", { name: "gestionar-mal" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Una oportunidad pendiente_aprobacion no admite «marcar_gestionado»."
      )
    );
    expect(screen.getByTestId("para-revisar")).toHaveTextContent("2");
  });

  it("editar un borrador mueve la oportunidad y el contador de la Bandeja", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("bandeja")).toHaveTextContent(
        "demo-op-05,demo-op-06"
      )
    );
    await user.click(screen.getByRole("button", { name: "editar" }));
    // Un texto con un término prohibido bloquea la oportunidad: sale de «por revisar».
    await waitFor(() =>
      expect(screen.getByTestId("bandeja")).toHaveTextContent(/^demo-op-05$/)
    );
    expect(screen.getByTestId("para-revisar")).toHaveTextContent("1");
  });

  it("añadir una URL y guardar ajustes también refrescan", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("tope")).toHaveTextContent("5")
    );
    await user.click(screen.getByRole("button", { name: "guardar" }));
    await waitFor(() =>
      expect(screen.getByTestId("tope")).toHaveTextContent("9")
    );
    await user.click(screen.getByRole("button", { name: "anadir" }));
    // No hay error y la mutación termina: el panel sigue vivo.
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("")
    );
  });
});
