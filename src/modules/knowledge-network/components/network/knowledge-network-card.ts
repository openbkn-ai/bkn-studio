/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function formatKnowledgeNetworkUpdateTime(value?: string): string {
  return value?.replace(/(\d{2}:\d{2}):\d{2}$/, "$1") || "--";
}
