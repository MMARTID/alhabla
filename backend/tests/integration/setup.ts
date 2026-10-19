import { config } from "dotenv";
import { comprobarEntornoDeTest } from "./helpers/entornoDeTest.js";

// Carga DATABASE_URL de .env.test — el Postgres real de docker-compose
// (perfil dev), no un contenedor nuevo: una base de datos separada
// (alhabla_test).
config({ path: ".env.test" });
comprobarEntornoDeTest();
process.env.CALENDAR_CREDENTIALS_KEY ??= Buffer.alloc(32, 7).toString("base64");
