/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { DetailTableColumnDefinition } from "@/modules/knowledge-network/components/shared/DetailTableColumnSettingsButton";

export const ObjectTypePropertyTableColumns: DetailTableColumnDefinition[] = [
  { key: "name", labelKey: "knowledgeNetwork.objectTypePropertyName", required: true },
  { key: "displayName", labelKey: "knowledgeNetwork.objectTypePropertyDisplayName" },
  { key: "type", labelKey: "knowledgeNetwork.objectTypePropertyType" },
  { key: "mappedField", labelKey: "knowledgeNetwork.objectTypePropertyMappedField" },
  { key: "primaryKey", labelKey: "knowledgeNetwork.objectTypePropertyPrimaryKey" },
  { key: "displayKey", labelKey: "knowledgeNetwork.objectTypePropertyTitle" },
  { key: "total_count", labelKey: "knowledgeNetwork.objectTypePropertyTotalCount" },
];

export function getObjectTypePropertyTableColumnLabel(
  columnKey: string,
  t: TFunction,
): string {
  const column = ObjectTypePropertyTableColumns.find((item) => item.key === columnKey);
  return column ? t(column.labelKey) : columnKey;
}
