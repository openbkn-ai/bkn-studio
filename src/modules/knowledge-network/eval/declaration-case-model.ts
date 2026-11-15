/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EvalCaseDefinition } from "./m0-run.service";
import type { RuleApplicationRow } from "./rule-application.service";
import { evalScalarText } from "./eval-scalar-text";

export function declarationRowFromDefinition(definition: EvalCaseDefinition): RuleApplicationRow {
  const execution = definition.execution_spec;
  const target = execution.target as { resource_kind: string; resource_id: string; name: string };
  return {
    key: "frozen",
    target_key: "frozen",
    resource: { kind: target.resource_kind, id: target.resource_id },
    resource_name: target.name,
    target_id: evalScalarText(execution.evaluation_target_id ?? target.resource_id),
    target_name: target.name,
    rule_id: evalScalarText(execution.template_rule_id ?? ""),
    rule_title: evalScalarText(definition.diagnostic_spec.template_rule_title ?? ""),
    rule_checksum: "",
    resource_checksum: "",
    match: "applicable",
    configuration: "complete",
    execution: "ready",
    execution_reason: "",
    missing: [],
    check: execution.check as RuleApplicationRow["check"],
    sample: {
      target_key: "frozen",
      sample_id: "default",
      title: definition.title,
      question: evalScalarText(definition.input_spec.question ?? ""),
      arguments: definition.input_spec.arguments as Record<string, unknown>,
      scope: { mode: "invocation" },
    },
  };
}
