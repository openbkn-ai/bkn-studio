/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/**
 * Knowledge-network pages deliberately rely on their own authorized `hasIndex` summary.
 * They must not query data-catalog resource details from the browser merely to refine this label.
 */
export function formatKnowledgeNetworkObjectTypeIndexStateLabel(hasIndex: boolean, t: TFunction) {
  return hasIndex
    ? t("knowledgeNetwork.previewIndexed")
    : t("knowledgeNetwork.previewNotIndexed");
}
