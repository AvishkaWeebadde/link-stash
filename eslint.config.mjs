import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party / generated artifacts we don't author.
    "public/**",
    "src/generated/**",
    // Tauri/Rust build output and staged desktop resources.
    "src-tauri/target/**",
    "src-tauri/resources/**",
    "frontend/**",
  ]),
  {
    rules: {
      // One-time client-side sync of theme/selection state from browser APIs
      // inside effects is intentional here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
