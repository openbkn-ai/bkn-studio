/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricPropertyRefV1 } from "@/modules/knowledge-network/types/object-metric";

export function objectMetricQueryCapabilities(
  ownerObjectTypeId: string,
  analysisDimensions?: string[],
  timeDimensions?: string[],
): {
  analysis_dimensions: ObjectMetricPropertyRefV1[];
  time_dimensions: ObjectMetricPropertyRefV1[];
} {
  const ref = (propertyName: string): ObjectMetricPropertyRefV1 => ({
    object_type_id: ownerObjectTypeId,
    property_name: propertyName,
  });

  return {
    analysis_dimensions: (analysisDimensions ?? []).map(ref),
    time_dimensions: (timeDimensions ?? []).map(ref),
  };
}
