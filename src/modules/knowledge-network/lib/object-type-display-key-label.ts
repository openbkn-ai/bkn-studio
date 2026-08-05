/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

type PreviewColumn = {
  dataIndex: string;
  title: string;
};

/** Resolve the column label for an object type display key, aligned with sample data headers. */
export function resolveObjectTypeDisplayKeyLabel(
  displayKey: string,
  dataProperties: ObjectTypeDataProperty[],
  previewColumns?: PreviewColumn[],
) {
  if (!displayKey) {
    return "--";
  }

  const property = dataProperties.find((item) => item.name === displayKey);
  if (property?.displayName) {
    return property.displayName;
  }

  const previewColumn = previewColumns?.find((column) => column.dataIndex === displayKey);
  if (previewColumn?.title) {
    return previewColumn.title;
  }

  return displayKey;
}
