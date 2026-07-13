/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import tseslint from "typescript-eslint";

import { createTypeScriptConfig, ignoreConfig } from "./eslint.base.mjs";

// For CI / pre-merge: full TypeScript-aware lint (slower, overlaps with `tsc -b`).
export default tseslint.config(
  ignoreConfig,
  createTypeScriptConfig({ typeChecked: true }),
  {
    files: [
      "src/modules/knowledge-network/components/object-type/useObjectTypePropertyTableState.ts",
    ],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
