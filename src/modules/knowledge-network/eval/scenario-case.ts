/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { compileCriteria, type CaseCriterion } from "./case-form-model";
import type { EvalCaseDefinition } from "./m0-run.service";

export type ScenarioCaseValues = {
  title: string;
  question: string;
  scenarioContext?: string;
  scenarioConstraints?: string;
  outputRequirements?: string;
  criteria?: CaseCriterion[];
  sourceKind?: EvalCaseDefinition["expected_source"]["kind"];
  evidenceRef?: string;
  diagnosticNote?: string;
};

export function buildScenarioCase(
  values: ScenarioCaseValues,
  networkId: string,
): EvalCaseDefinition {
  const compiled = compileCriteria(values.criteria ?? []);
  const needsValue = values.criteria?.some((entry) =>
    ["equals", "numeric_range", "approx", "contains", "regex"].includes(entry.type),
  );
  return {
    title: values.title.trim(),
    category: "decision",
    risk_level: "medium",
    input_spec: {
      question: values.question.trim(),
      output_fields: (values.criteria ?? []).map((criterion) => ({
        path: criterion.path,
        type: ["numeric_range", "approx"].includes(criterion.type)
          ? "number"
          : ["contains", "regex"].includes(criterion.type)
            ? "string"
            : criterion.valueType,
      })),
      ...(values.scenarioContext?.trim() ? { context: values.scenarioContext.trim() } : {}),
      ...(values.scenarioConstraints?.trim()
        ? { constraints: values.scenarioConstraints.trim() }
        : {}),
      ...(values.outputRequirements?.trim()
        ? { output_requirements: values.outputRequirements.trim() }
        : {}),
    },
    execution_spec: { runner: "agent_task", target_kind: "business_scenario", kn_id: networkId },
    assertions: [
      ...compiled.assertions,
      { id: "execution-evidence", type: "evidence_complete", required: true },
    ],
    expected_spec: compiled.expected_spec,
    expected_source: {
      kind: needsValue ? (values.sourceKind ?? "business_expert") : "declared_contract",
      evidence_refs: (values.evidenceRef ?? "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    },
    diagnostic_spec: {
      case_type: "scenario",
      form_version: 1,
      note: values.diagnosticNote?.trim() ?? "",
    },
  };
}
