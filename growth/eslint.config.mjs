import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// `next lint` desapareció en Next 16: el lint va con la CLI de ESLint y la
// configuración plana de eslint-config-next (las mismas reglas que en la app y
// en la web: core-web-vitals + typescript).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Reglas nuevas de eslint-plugin-react-hooks 7 (las del React Compiler).
    // Marcan patrones que funcionan (setState dentro de un efecto, refs leídas
    // al renderizar): avisos, no errores que bloqueen CI.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // En los mocks de los tests, `any` es lo razonable.
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
