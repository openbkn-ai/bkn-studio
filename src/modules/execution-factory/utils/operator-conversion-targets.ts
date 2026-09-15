/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";

export function operatorConversionPermission(metadataType?: OperatorRecord["metadataType"]): string {
  if (metadataType === "openapi") return "execution-factory:toolbox:edit";
  if (metadataType === "function") return "execution-factory:function:edit";
  return "";
}

export function eligibleOperatorConversionTargets(
  record: OperatorRecord | null,
  toolboxes: ToolboxRecord[],
  currentPermissions: string[],
): ToolboxRecord[] {
  const permission = operatorConversionPermission(record?.metadataType);
  if (!permission || !currentPermissions.includes(permission)) return [];
  return toolboxes.filter((toolbox) =>
    toolbox.metadataType === record?.metadataType &&
    !toolbox.isInternal &&
    toolbox.operations?.includes("modify") === true,
  );
}
