import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mensajeDeError } from "@/lib/api-errors";
import {
  claves,
  useAceptarCompetidor,
  useAnadirTarea,
  useBorrarTarea,
  useComparador,
  useDescartarTarea,
  useEditarTarea,
  useFichaDeAlhabla,
  useMarcarTareaHecha,
  useReabrirTarea,
  useTareas,
} from "@/lib/consultas";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { renderConCliente } from "../helpers/render";

/** El reloj del demo se fija: las tareas que se marcan escriben `hechaEn` con él. */
const AHORA = new Date("2026-10-30T09:00:00.000Z");

/** Una «vista» mínima que usa los hooks reales contra el cliente de demostración. */
function Recorrido() {
  const tareas = useTareas();
  const comparador = useComparador();
  const ficha = useFichaDeAlhabla();
  const anadir = useAnadirTarea();
  const editar = useEditarTarea("demo-ta-guia-de-pymes");
  const hecha = useMarcarTareaHecha("demo-ta-guia-de-pymes");
  const descartar = useDescartarTarea("demo-ta-guia-de-pymes");
  const reabrir = useReabrirTarea("demo-ta-guia-de-pymes");
  const borrar = useBorrarTarea("demo-ta-guia-de-pymes");
  const aceptar = useAceptarCompetidor("demo-co-4");
  const fallo = [anadir, editar, hecha, descartar, reabrir, borrar].find(
    (m) => m.error
  )?.error;
  const guia = tareas.data?.data.find((t) => t.id === "demo-ta-guia-de-pymes");
  return (
    <div>
      <p data-testid="guia">
        {guia ? `${guia.titulo}|${guia.estado}|${guia.resultado ?? "-"}` : "no"}
      </p>
      <p data-testid="total">{tareas.data?.data.length}</p>
      <p data-testid="comparador">
        {comparador.data?.data.map((f) => f.competidorId).join(",")}
      </p>
      <p data-testid="ficha">{ficha.data?.campos.length}</p>
      <p data-testid="error">{fallo ? mensajeDeError(fallo, "fallo") : ""}</p>
      <button onClick={() => hecha.mutate({ resultado: "alta_creada" })}>
        hecha
      </button>
      <button onClick={() => descartar.mutate({})}>descartar</button>
      <button onClick={() => reabrir.mutate()}>reabrir</button>
      <button onClick={() => editar.mutate({ titulo: "Renombrada" })}>
        editar
      </button>
      <button onClick={() => editar.mutate({})}>editar-mal</button>
      <button onClick={() => borrar.mutate()}>borrar</button>
      <button
        onClick={() =>
          anadir.mutate({ titulo: "Nueva", url: "https://nueva.example/" })
        }
      >
        anadir
      </button>
      <button onClick={() => aceptar.mutate()}>aceptar</button>
    </div>
  );
}

function montar() {
  return renderConCliente(
    <Recorrido />,
    clienteDemo({ retardoMs: 0, ahora: () => AHORA })
  );
}

describe("los hooks del comparador, la ficha y las tareas", () => {
  it("las claves de caché cuelgan de «growth», para que toda mutación las refresque", () => {
    expect(claves.comparador()).toEqual(["growth", "comparador"]);
    expect(claves.ficha()).toEqual(["growth", "ficha-de-alhabla"]);
    expect(claves.tareas()).toEqual(["growth", "tareas"]);
  });

  it("cargan el comparador (sin propuestos), la ficha y las tareas sembradas", async () => {
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("comparador")).toHaveTextContent(
        "demo-co-1,demo-co-2,demo-co-3"
      )
    );
    expect(screen.getByTestId("ficha")).toHaveTextContent("8");
    expect(screen.getByTestId("total")).toHaveTextContent("12");
    expect(screen.getByTestId("guia")).toHaveTextContent(
      "Guía de herramientas para pymes (ejemplo)|hecha|alta_creada"
    );
  });

  it("reabrir, marcar hecha, descartar y editar refrescan la lista de tareas", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("guia")).toHaveTextContent("|hecha|")
    );
    await user.click(screen.getByRole("button", { name: "reabrir" }));
    await waitFor(() =>
      expect(screen.getByTestId("guia")).toHaveTextContent("|pendiente|-")
    );
    await user.click(screen.getByRole("button", { name: "descartar" }));
    await waitFor(() =>
      expect(screen.getByTestId("guia")).toHaveTextContent("|descartada|-")
    );
    await user.click(screen.getByRole("button", { name: "hecha" }));
    await waitFor(() =>
      expect(screen.getByTestId("guia")).toHaveTextContent("|hecha|alta_creada")
    );
    await user.click(screen.getByRole("button", { name: "editar" }));
    await waitFor(() =>
      expect(screen.getByTestId("guia")).toHaveTextContent("Renombrada|hecha")
    );
  });

  it("añadir y borrar cambian el total", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("total")).toHaveTextContent("12")
    );
    await user.click(screen.getByRole("button", { name: "anadir" }));
    await waitFor(() =>
      expect(screen.getByTestId("total")).toHaveTextContent("13")
    );
    await user.click(screen.getByRole("button", { name: "borrar" }));
    await waitFor(() =>
      expect(screen.getByTestId("total")).toHaveTextContent("12")
    );
    // Ya no existe: el siguiente intento es un 404 con su frase.
    await user.click(screen.getByRole("button", { name: "borrar" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "La tarea no existe."
      )
    );
  });

  it("un 400 llega a la vista con su frase y no cambia nada", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("total")).toHaveTextContent("12")
    );
    await user.click(screen.getByRole("button", { name: "editar-mal" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Indica al menos un campo que cambiar."
      )
    );
    expect(screen.getByTestId("total")).toHaveTextContent("12");
  });

  it("aceptar un propuesto lo mete en el comparador (toda mutación refresca lo de growth)", async () => {
    const user = userEvent.setup();
    montar();
    await waitFor(() =>
      expect(screen.getByTestId("comparador")).toHaveTextContent(
        "demo-co-1,demo-co-2,demo-co-3"
      )
    );
    await user.click(screen.getByRole("button", { name: "aceptar" }));
    await waitFor(() =>
      expect(screen.getByTestId("comparador")).toHaveTextContent(
        // Por nombre: «Atiende24» va el primero.
        "demo-co-4,demo-co-1,demo-co-2,demo-co-3"
      )
    );
  });
});
