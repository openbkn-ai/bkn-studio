/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BuildMode } from "@/modules/data-catalog/types/data-catalog";

/** Streaming builds use the incremental key in resource index configuration as the stable row identifier. */
export function streamingNeedsBuildKey(mode: BuildMode, buildKeyFields: string[]) {
  return mode === "streaming" && buildKeyFields.length === 0;
}
