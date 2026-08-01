/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnDetail } from "@/modules/knowledge-network/services/context-loader.service";

/**
 * Builds a compact cache fingerprint from the whole network summary.
 *
 * Names and descriptions influence the generated questions, so counts alone
 * are insufficient to decide whether a cached recommendation is still valid.
 */
export function recommendationFingerprint(detail: KnDetail): string {
  const serialized = JSON.stringify(detail);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${serialized.length}:${(hash >>> 0).toString(16)}`;
}
