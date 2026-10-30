import { describe, it, expect, vi } from "vitest";
import {
  JOBS_QUE_NO,
  JOBS_QUE_SE_PUEDEN_LANZAR,
  lanzarJobDeProd,
} from "../../mcp/jobsDeProd.js";

describe("growth-mantenimiento en el MCP de desarrollo", () => {
  it("está entre los jobs que NO se lanzan desde el MCP, con su motivo", () => {
    expect(JOBS_QUE_NO["growth-mantenimiento"]).toMatch(
      /caduca oportunidades.*borra datos/
    );
  });

  it("no está entre los lanzables: caducar es terminal y la purga borra datos", () => {
    expect("growth-mantenimiento" in JOBS_QUE_SE_PUEDEN_LANZAR).toBe(false);
  });

  it("lanzar_job_prod lo rechaza sin llamar a gcloud y dice quién puede lanzarlo", async () => {
    const gcloudFn = vi.fn();
    await expect(
      lanzarJobDeProd("growth-mantenimiento", { gcloudFn })
    ).rejects.toThrow(
      /growth-mantenimiento no se lanza desde aquí: caduca oportunidades.*gcloud scheduler jobs run/
    );
    expect(gcloudFn).not.toHaveBeenCalled();
  });
});
