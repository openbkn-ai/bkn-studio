/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

export function buildLogicPropertyTrialBody(input: {
  instanceIdentities: Array<Record<string, string | number>>;
  logicProperties: ObjectTypeLogicProperty[];
}) {
  return {
    _instance_identities: input.instanceIdentities,
    properties: input.logicProperties.map((property) => property.name),
  };
}
