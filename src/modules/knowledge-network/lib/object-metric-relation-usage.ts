/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

/**
 * Returns relationship types at the start of an explicitly declared path from the
 * metric owner. Later steps belong to the expanded path, not the owner's one-hop map.
 * A metric without such a path is unclassified; it is not necessarily relationship-free.
 */
export function rootRelationTypeIds(metric: ObjectMetricRecordV1): string[] {
  const specification = metric.definition.specification;
  if (specification.kind === "derived") {
    const id = specification.business_qualifiers.relation_path?.steps[0]?.relation_type_id;
    return id ? [id] : [];
  }
  if (specification.kind === "composite") {
    return Array.from(
      new Set(
        specification.dependencies
          .map((dependency) => dependency.object_alignment.relation_path?.[0]?.relation_type_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }
  return [];
}
