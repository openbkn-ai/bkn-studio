/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import tseslint from "typescript-eslint";

import { createTypeScriptConfig, ignoreConfig } from "./eslint.base.mjs";

// Default for IDE and `pnpm lint`: syntax + best-practice rules only (no project type-check).
export default tseslint.config(ignoreConfig, createTypeScriptConfig({ typeChecked: false }));
