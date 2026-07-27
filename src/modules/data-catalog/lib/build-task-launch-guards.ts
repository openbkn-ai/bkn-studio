/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BuildMode } from "@/modules/data-catalog/types/data-catalog";

/** 流式构建以资源索引配置中的增量键作为稳定行标识。 */
export function streamingNeedsBuildKey(mode: BuildMode, buildKeyFields: string[]) {
  return mode === "streaming" && buildKeyFields.length === 0;
}
