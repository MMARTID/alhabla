import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA,
  grupoDeInsightsDeLaRecepcionista,
  olvidarGrupoDeInsights,
} from "../../src/lib/insightsDeTelnyx.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    listInsightGroups: vi.fn(),
    createInsightGroup: vi.fn(),
  },
}));

const mockedList = vi.mocked(telnyxAiAdapter.listInsightGroups);
const mockedCreate = vi.mocked(telnyxAiAdapter.createInsightGroup);

beforeEach(() => {
  vi.clearAllMocks();
  olvidarGrupoDeInsights();
});

describe("grupoDeInsightsDeLaRecepcionista", () => {
  it("usa el grupo vacío de la recepcionista si existe, nunca «Default»", async () => {
    mockedList.mockResolvedValue([
      { id: "default", name: "Default", insights: 6 },
      { id: "vacio", name: GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA, insights: 0 },
    ]);
    expect(await grupoDeInsightsDeLaRecepcionista()).toBe("vacio");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("si no existe lo crea, y lo recuerda", async () => {
    mockedList.mockResolvedValue([{ id: "default", name: "Default", insights: 6 }]);
    mockedCreate.mockResolvedValue({ id: "nuevo" });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await grupoDeInsightsDeLaRecepcionista()).toBe("nuevo");
    expect(await grupoDeInsightsDeLaRecepcionista()).toBe("nuevo");
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA })
    );
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("avisa si alguien le añadió insights a mano", async () => {
    mockedList.mockResolvedValue([
      { id: "vacio", name: GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA, insights: 2 },
    ]);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await grupoDeInsightsDeLaRecepcionista()).toBe("vacio");
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("tiene 2 insights"));
  });
});
