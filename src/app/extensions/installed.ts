/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Extensions installed into this build. The community build installs none.
 *
 * This is the only module that calls `registerExtension` (framework/extension/registry). A
 * build that ships extensions replaces it through a bundler alias rather than editing it, so
 * this repository never imports extension code. main.tsx imports it before the app mounts.
 */
export {};
