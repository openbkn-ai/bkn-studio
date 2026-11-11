/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EvalTemplateRule, EvalTargetKind } from "./types";

export function rulePreset(rule: EvalTemplateRule): "required" | "standard" {
  return rule.preset ?? "standard";
}

export const resourceKindGroups: { key: "conceptGroup" | "modelGroup"; kinds: EvalTargetKind[] }[] =
  [
    { key: "conceptGroup", kinds: ["objectType", "relationType", "action"] },
    { key: "modelGroup", kinds: ["metric", "function", "api", "mcp", "skill"] },
  ];
