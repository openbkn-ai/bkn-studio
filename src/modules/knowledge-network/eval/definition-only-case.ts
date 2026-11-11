/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { compileCriteria, validateCaseArguments, type CaseCriterion } from "./case-form-model";
import type { EvalCaseDefinition, EvalCaseResource } from "./m0-run.service";
import type { EvalTemplateRule } from "./types";

// This is an editable test definition, never an executable adapter. The backend
// independently rejects enabling or running it until execution is configured.
export function definitionOnlyCase({
  networkId,
  resource,
  rule,
  target,
  question,
  argumentsJson,
  criteria,
  source,
  evidence,
  reason,
}: {
  networkId: string;
  resource: EvalCaseResource;
  rule: EvalTemplateRule;
  target?: { id: string; name: string };
  question: string;
  argumentsJson: string;
  criteria: CaseCriterion[];
  source: "business_expert" | "independent_sample";
  evidence: string;
  reason: string;
}): EvalCaseDefinition {
  if (!question.trim() || question.trim().length > 4000)
    throw Error("EVAL_DEFINITION_STEPS_REQUIRED");
  const refs = evidence
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  if (!refs.length || refs.length > 20 || refs.some((r) => r.length > 512))
    throw Error("EVAL_DEFINITION_REFERENCES_REQUIRED");
  const args = validateCaseArguments(argumentsJson || "{}");
  const compiled = compileCriteria(criteria);
  return {
    title: `${target?.name ?? resource.name} · ${rule.title}`,
    category:
      resource.kind === "action"
        ? "action"
        : resource.kind === "metric"
          ? "calculation"
          : resource.kind === "relationType"
            ? "relation"
            : "fact",
    risk_level: "medium",
    input_spec: { question: question.trim(), arguments: args },
    execution_spec: {
      runner: "unbound",
      target_kind: "resource",
      target: {
        kn_id: networkId,
        resource_kind: resource.kind,
        capability_type: resource.kind,
        resource_id: resource.id,
        name: resource.name,
      },
    },
    ...compiled,
    expected_source: { kind: source, evidence_refs: refs },
    diagnostic_spec: {
      form_version: 2,
      definition_only: true,
      resource_case_form: true,
      case_type: "functional",
      template_rule_id: rule.id,
      template_rule_title: rule.title,
      template_rule_revision: rule.revision ?? 0,
      rule_snapshot: rule,
      resource_kind: resource.kind,
      resource_id: resource.id,
      target_id: target?.id ?? resource.id,
      target_name: target?.name ?? resource.name,
      execution_blockers: [reason],
    },
  };
}
