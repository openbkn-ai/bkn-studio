/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Standalone constant with NO DOM / no `@/*` imports so it can be pulled into
// the node-side tsconfig (via vite.config.ts) without dragging window-using
// app-paths.ts into a project that lacks the DOM lib. app-paths.ts re-exports it.
export const DEFAULT_APP_BASENAME = "/studio";
