/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export const ignoreConfig = {
  ignores: ["dist", "node_modules", "scripts/**", "tests/e2e/**", "tests/execution-factory/**"],
};

export const reactPluginConfig = {
  plugins: {
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
};

export function createTypeScriptConfig({ typeChecked }) {
  return {
    extends: [
      js.configs.recommended,
      ...(typeChecked
        ? tseslint.configs.recommendedTypeChecked
        : tseslint.configs.recommended),
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      ...(typeChecked
        ? {
            parserOptions: {
              project: ["./tsconfig.app.json", "./tsconfig.node.json"],
              tsconfigRootDir: import.meta.dirname,
            },
          }
        : {}),
    },
    ...reactPluginConfig,
    rules: {
      ...reactPluginConfig.rules,
      ...(typeChecked
        ? {
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/restrict-template-expressions": "warn",
          }
        : {}),
    },
  };
}
