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
      // Never gate visibility based on a license's features[].
      //
      // Authorization is evaluated by **edition** (server-side
      // entitlement.AtLeast). The license's features[] is transmitted but never
      // evaluated: it is the original data for display and audit reconciliation.
      // Using it for visibility gates reintroduces fine-grained authorization
      // through a back door in the least enforceable layer: anyone can change a
      // frontend condition, and it can expose an entry that inevitably returns
      // 404 in a real "community image + professional license" deployment (the
      // license contains a key while the image lacks the corresponding code).
      // 10.211.55.4 is currently such a deployment.
      //
      // The server enforces this discipline in two places (the API documentation
      // and the Features() doc comment). This is the third, and the only place
      // that can enforce it automatically. Use useCapability() for
      // capability-based visibility. See bkn-docs docs/shared/licensing/
      // ee-design.md §3.2.
      //
      // This only catches shapes such as `x.features.includes(...)`; it cannot
      // catch a destructured bare `features`. The type boundary covers that case:
      // useEntitlement does not expose features.
      "no-restricted-syntax": [
        "error",
        {
          message:
            "Do not gate visibility based on license features[]: authorization is edition-based, and features are transmitted but never evaluated. Use useCapability() / CapabilityGate (framework/entitlement). See ee-design.md §3.2.",
          selector:
            "CallExpression[callee.property.name=/^(includes|indexOf|some|find|filter)$/][callee.object.property.name='features']",
        },
      ],
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
