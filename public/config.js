/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Runtime config, loaded before the app bundle so it can override defaults at
// deploy time WITHOUT rebuilding the image. The build ships this no-op; a
// deployment replaces the file (helm ConfigMap / docker mount) to override —
// e.g. disable the in-SPA OAuth gate when bkn-safe is NOT deployed, so studio
// runs gate-less with the default local-admin user and no login:
//   window.__BKN_STUDIO_RUNTIME__ = { mode: "hosted" };
window.__BKN_STUDIO_RUNTIME__ = window.__BKN_STUDIO_RUNTIME__ || {};
