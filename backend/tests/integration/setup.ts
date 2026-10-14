import { config } from "dotenv";
import { conectarRedisDeCompatibilidad } from "../../src/lib/redisDeCompatibilidad.js";
import { comprobarEntornoDeTest } from "./helpers/entornoDeTest.js";

// Carga DATABASE_URL/REDIS_URL de .env.test — Postgres/Redis reales de
// docker-compose (perfil dev), no contenedores nuevos: una base de datos
// separada (alhabla_test) y un índice de Redis separado (/1).
config({ path: ".env.test" });
comprobarEntornoDeTest();
process.env.CALENDAR_CREDENTIALS_KEY ??= Buffer.alloc(32, 7).toString("base64");

// La suite corre en modo compatibilidad, como producción mientras exista
// REDIS_URL: cada cerrojo se toma en Postgres y en Redis (/1). Los tests que
// quieren «solo Postgres» llaman a cerrarRedisDeCompatibilidad().
await conectarRedisDeCompatibilidad();
