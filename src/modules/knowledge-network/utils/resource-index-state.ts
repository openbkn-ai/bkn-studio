/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { ObjectTypeIndexStatus } from "@/modules/knowledge-network/types/object-type";

/**
 * Knowledge-network pages use BKN's authorized, response-time index projection. They must not
 * query data-catalog resource details from the browser merely to refine this label.
 */
export function formatKnowledgeNetworkObjectTypeIndexStateLabel(
  stateOrHasIndex: ObjectTypeIndexStatus | boolean | undefined,
  t: TFunction,
) {
  if (typeof stateOrHasIndex === "boolean" || !stateOrHasIndex) {
    return stateOrHasIndex
      ? t("knowledgeNetwork.previewIndexed")
      : t("knowledgeNetwork.previewNotIndexed");
  }

  switch (stateOrHasIndex.state) {
    case "available":
      return t("knowledgeNetwork.previewIndexed");
    case "unavailable":
      return t("knowledgeNetwork.previewNotIndexed");
    case "unknown":
      return t("knowledgeNetwork.objectTypeIndexStateUnknown");
    case "resource_missing":
      return t("knowledgeNetwork.objectTypeIndexStateResourceMissing");
    case "not_applicable":
      return t("knowledgeNetwork.objectTypeIndexStateNotApplicable");
  }
}
