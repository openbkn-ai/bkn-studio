/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { findMetricLogicProperty } from "@/modules/knowledge-network/lib/object-metric-binding";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

export function objectMetricActions(
  record: ObjectMetricRecordV1,
  canModify: boolean,
  canDelete: boolean,
  ownerObjectType: ObjectTypeDetail | null | undefined,
) {
  const { calculation_scope, id, lifecycle, version } = record.definition;
  const isWorkingDraft = lifecycle.status === "draft" || lifecycle.status === "validated";
  const canDeprecate = canModify && lifecycle.status === "published";
  const boundVersion = findMetricLogicProperty(ownerObjectType, id)?.metricBinding?.metric_ref
    .version;
  const deprecateReason =
    !canDeprecate || calculation_scope !== "object_instance"
      ? undefined
      : !ownerObjectType
        ? objectMetricText("bindingDeprecateStatusUnknown")
        : boundVersion === version
          ? objectMetricText("bindingDeprecateFirstUpgrade")
          : undefined;

  return {
    canDeleteVersion: canDelete && lifecycle.status !== "published",
    canDeprecate,
    canEdit: canModify && isWorkingDraft,
    deprecateReason,
  };
}
