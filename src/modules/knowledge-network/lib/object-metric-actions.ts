/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

export function objectMetricActions(
  record: ObjectMetricRecordV1,
  canModify: boolean,
  canDelete: boolean,
) {
  const { lifecycle } = record.definition;
  const isWorkingDraft = lifecycle.status === "draft" || lifecycle.status === "validated";
  const canDeprecate = canModify && lifecycle.status === "published";

  return {
    canDeleteVersion: canDelete && lifecycle.status !== "published",
    canDeprecate,
    canEdit: canModify && isWorkingDraft,
    deprecateReason: undefined,
  };
}
