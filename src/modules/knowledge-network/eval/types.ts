/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import type { EvalRuleCheck } from "./rule-check-model";

export const EVAL_TABS = ["overview", "plan", "cases", "runs"] as const;
export type EvalTab = (typeof EVAL_TABS)[number];

export const REGRESSION_SUITE_TAG = "回归";

export type EvalTargetKind =
  "objectType" | "relationType" | "metric" | "function" | "api" | "mcp" | "skill" | "action";
export type EvalRuleKind = EvalTargetKind | "objectProperty";
export type EvalRuleCondition = {
  field: string;
  operator: "exists" | "equals";
  value?: string;
};
export type EvalTemplateRule = {
  check?: EvalRuleCheck;
  id: string;
  builtinVersion?: number;
  origin?: "builtin" | "custom";
  revision?: number;
  kind: EvalRuleKind;
  group: string;
  title: string;
  description: string;
  appliesWhen: string;
  applicability?: { all: EvalRuleCondition[] };
  generationMode?: "manual" | "declaration_review";
  evidence: string;
  planDimensions: string[];
  preset?: "required" | "standard";
  enabled: boolean;
};
