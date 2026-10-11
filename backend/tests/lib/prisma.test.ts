import { describe, it, expect } from "vitest";
import { conUnaConexion } from "../../src/lib/prisma.js";

// La URL de la conexión propia del limitador: solo se tocan sus parámetros.
describe("conUnaConexion", () => {
  it("con la URL de Cloud SQL, cambia connection_limit, añade los parámetros codificados y deja el resto tal cual", () => {
    const url =
      "postgresql://app:p%40ss%2Fx@localhost/alhabla?host=/cloudsql/proyecto:europe-west1:bd&connection_limit=2";

    expect(
      conUnaConexion(url, {
        socket_timeout: "5",
        options: "-c statement_timeout=2000",
      })
    ).toBe(
      "postgresql://app:p%40ss%2Fx@localhost/alhabla?host=/cloudsql/proyecto:europe-west1:bd&connection_limit=1&socket_timeout=5&options=-c%20statement_timeout%3D2000"
    );
  });

  it("sustituye un parámetro que ya estaba y abre la consulta si la URL no tenía", () => {
    expect(
      conUnaConexion(
        "postgresql://u:p@db:5432/x?socket_timeout=1&schema=public",
        { socket_timeout: "5" }
      )
    ).toBe(
      "postgresql://u:p@db:5432/x?socket_timeout=5&schema=public&connection_limit=1"
    );
    expect(conUnaConexion("postgresql://u:p@db:5432/x")).toBe(
      "postgresql://u:p@db:5432/x?connection_limit=1"
    );
  });
});
