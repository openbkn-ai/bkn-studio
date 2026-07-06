/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

/** 用绑定数据资源的行总数填充已映射属性的 totalCount。 */
export function enrichDataPropertiesWithRowTotal(
  properties: ObjectTypeDataProperty[],
  rowTotalCount?: number,
): ObjectTypeDataProperty[] {
  if (rowTotalCount === undefined) {
    return properties;
  }

  return properties.map((property) => ({
    ...property,
    totalCount:
      property.totalCount ?? (property.mappedField?.name ? rowTotalCount : undefined),
  }));
}
