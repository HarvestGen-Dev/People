import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy local maintenance scripts are not shipped application code.
    "create-user.js",
    "fix-rls.js",
    "test-churches.js",
    "test-db.js",
    "test-login.js",
    "update-user.js",
    "update-user2.js",
    "scripts/fix-any.js",
  ]),
]);

export default eslintConfig;
