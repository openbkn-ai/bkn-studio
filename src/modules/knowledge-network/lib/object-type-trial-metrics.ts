/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

export function filterInstanceTrialLogicProperties(logicProperties: ObjectTypeLogicProperty[]) {
  return logicProperties.filter(
    (property) => property.type === "tool" || property.dataSource?.type === "tool",
  );
}
