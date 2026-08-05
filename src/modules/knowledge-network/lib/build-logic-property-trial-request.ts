/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isMetricLogicProperty } from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

const LOGIC_PROPERTY_TRIAL_START_AT = Date.UTC(2000, 0, 1);

export function buildLogicPropertyTrialBody(input: {
  instanceIdentities: Array<Record<string, string | number>>;
  logicProperties: ObjectTypeLogicProperty[];
  nowMs?: number;
}) {
  const metricProperties = input.logicProperties.filter(isMetricLogicProperty);
  const nowMs = input.nowMs ?? Date.now();

  const body: Record<string, unknown> = {
    _instance_identities: input.instanceIdentities,
    properties: input.logicProperties.map((property) => property.name),
  };

  if (metricProperties.length > 0) {
    body.dynamic_params = Object.fromEntries(
      metricProperties.map((property) => [
        property.name,
        {
          end: nowMs,
          instant: true,
          start: LOGIC_PROPERTY_TRIAL_START_AT,
        },
      ]),
    );
  }

  return body;
}
