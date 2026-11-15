/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import "./locales";

import { evalScalarText } from "./eval-scalar-text";

import BigNumber from "bignumber.js";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { compileCriteria, readCriteria } from "./case-form-model";
import type { EvalCaseDefinition } from "./m0-run.service";

const ruleText = (key: string, values?: Record<string, unknown>): string =>
  i18n.t(`knowledgeNetwork.eval.foundation.ruleModel.${key}`, {
    ...values,
    interpolation: { escapeValue: false },
  });

export const resourceCaseKinds = ["function", "api", "mcp", "metric", "action", "skill"];
export const resourceCaseChecks = [
  "action_execution",
  "resource_available",
  "input_contract",
  "output_contract",
  "resource_result",
  "resource_error",
  "resource_request",
  "metric_lineage",
  "result_compare",
];

export type EvalRuleCheck = {
  type: string;
  declaration?: DeclarationProgram;
  independent_value?: boolean;
  binding?: string;
  program?: EvalRuleProgram;
  program_input?: boolean;
  scope?: { mode: "sample" | "all" | "invocation"; limit?: number };
  minimum?: string;
  maximum?: string;
  values?: unknown[];
  assertions?: Record<string, unknown>[];
  expected?: Record<string, unknown>;
};
export type RuleCheckCapability = {
  type: string;
  name: string;
  kinds: string[];
  bindings?: string[];
  help: string;
};
export const ruleCheckAllowsAll = (check?: EvalRuleCheck) =>
  !!check &&
  ((check.binding === "primary_keys" && ["non_empty", "unique"].includes(check.type)) ||
    (check.type === "program" &&
      !!check.program?.aggregates?.length &&
      !check.program.expect &&
      !check.program.where &&
      !check.program.reference &&
      !check.program.aggregates.some((a) => a.function === "duplicate_count") &&
      check.program.aggregate_scope !== "sample"));
export function ruleCheckCriteria(check: EvalRuleCheck) {
  return (
    readCriteria({
      assertions: check.assertions ?? [],
      expected_spec: check.expected ?? {},
    } as EvalCaseDefinition) ?? []
  );
}
export function validateRuleCheck(
  kind: string,
  check: EvalRuleCheck | undefined,
  capabilities: RuleCheckCapability[],
) {
  if (!check) return;
  const capability = capabilities.find(
    (item) => item.type === check.type && item.kinds.includes(kind),
  );
  if (!capability) throw Error(ruleText("unsupported"));
  if (
    capability.bindings?.length &&
    (!check.binding || !capability.bindings.includes(check.binding))
  )
    throw Error(ruleText("fieldRequired"));
  if (check.type === "declaration") {
    const p = check.declaration;
    if (
      !p ||
      p.version !== 1 ||
      !Array.isArray(p.assertions) ||
      !p.assertions.length ||
      p.assertions.length > 32 ||
      !["resource", "property", "dataProperty", "logicProperty"].includes(p.target) ||
      new TextEncoder().encode(transformPrecisionSafeJSONRequest(p)).length > 32768
    )
      throw Error(ruleText("conditionRequired"));
  }
  if (check.type === "program") {
    if (check.program_input) {
      if (kind !== "objectType" || check.binding !== "fields" || check.program)
        throw Error(ruleText("unsupported"));
    } else validateRuleProgram(check.program);
  }
  if (check.type === "numeric_range") {
    if (!check.minimum && !check.maximum) throw Error(ruleText("boundaryRequired"));
    for (const v of [check.minimum, check.maximum])
      if (v && !new BigNumber(v).isFinite()) throw Error(ruleText("finiteBoundary"));
    if (check.minimum && check.maximum && new BigNumber(check.minimum).gt(check.maximum))
      throw Error(ruleText("rangeReversed"));
  }
  if (check.type === "enum" && (!check.values?.length || check.values.length > 100))
    throw Error(ruleText("allowedValues"));
  if (check.type === "result_compare") compileCriteria(ruleCheckCriteria(check));
}

export type RuleValueCondition = {
  field: string;
  operator: string;
  other_field?: string;
  reference_field?: string;
  value?: unknown;
};
export type RuleConditionGroup = { mode: "all" | "any"; conditions: RuleValueCondition[] };
export type RuleAggregate = {
  function: string;
  field?: string;
  fields?: string[];
  operator: string;
  value: unknown;
};
export type EvalRuleProgram = {
  standard?: { version: string; evidence_refs: string[] };
  query_filter?: RuleValueCondition;
  version: 1;
  where?: RuleConditionGroup;
  expect?: RuleConditionGroup;
  reference?: {
    matches_field?: string;
    keys: { field: string; reference_field: string }[];
    rows: Record<string, unknown>[];
    evidence_refs?: string[];
  };
  aggregates?: RuleAggregate[];
  aggregate_scope?: "complete" | "sample";
};
export function newRuleProgram(kind: string): EvalRuleProgram {
  return {
    version: 1,
    expect: {
      mode: "all",
      conditions: [{ field: kind === "objectProperty" ? "$property" : "", operator: "non_empty" }],
    },
  };
}
export function validateRuleProgram(program?: EvalRuleProgram) {
  if (
    program &&
    new TextEncoder().encode(transformPrecisionSafeJSONRequest(program)).length > 32 * 1024
  )
    throw Error(ruleText("sizeLimit"));
  if (!program || program.version !== 1 || (!program.expect && !program.aggregates?.length))
    throw Error(ruleText("conditionRequired"));
  const scalar = (v: unknown) =>
    v === null || ["string", "number", "boolean"].includes(typeof v) || BigNumber.isBigNumber(v);
  for (const [label, group] of [
    [ruleText("whereGroup"), program.where],
    [ruleText("expectGroup"), program.expect],
  ] as const) {
    if (!group) continue;
    if (
      !["all", "any"].includes(group.mode) ||
      !group.conditions.length ||
      group.conditions.length > 20
    )
      throw Error(ruleText("conditionCount", { label }));
    group.conditions.forEach((c, i) => {
      if (!c.field.trim()) throw Error(ruleText("conditionField", { label, index: i + 1 }));
      if (["exists", "non_empty"].includes(c.operator)) return;
      if (c.other_field || c.reference_field) {
        if (c.reference_field && !program.reference) throw Error(ruleText("referenceRequired"));
        return;
      }
      if (c.value === undefined || (c.value === "" && c.operator !== "eq" && c.operator !== "ne"))
        throw Error(ruleText("conditionValue", { label, index: i + 1 }));
      if (
        ["in", "not_in"].includes(c.operator) &&
        (!Array.isArray(c.value) ||
          !c.value.length ||
          c.value.length > 100 ||
          !c.value.every(scalar))
      )
        throw Error(ruleText("scalarArray"));
      if (
        ["gt", "gte", "lt", "lte"].includes(c.operator) &&
        !new BigNumber(evalScalarText(c.value)).isFinite()
      )
        throw Error(ruleText("numericComparison"));
    });
  }
  if ((program.aggregates?.length ?? 0) > 10) throw Error(ruleText("aggregateLimit"));
  program.aggregates?.forEach((a) => {
    if (a.function === "duplicate_count") {
      if (
        a.field ||
        !a.fields?.length ||
        a.fields.length > 16 ||
        new Set(a.fields).size !== a.fields.length ||
        a.fields.some((f) => !f.trim())
      )
        throw Error(ruleText("aggregateField"));
    } else if (a.fields?.length || (a.function !== "count" && !a.field?.trim()))
      throw Error(ruleText("aggregateField"));
    if (a.value === undefined || !new BigNumber(evalScalarText(a.value)).isFinite())
      throw Error(ruleText("aggregateExpected"));
  });
  if (program.reference) {
    const ref = program.reference;
    if (program.where || program.aggregates?.length) throw Error(ruleText("referenceExclusive"));
    if (
      !ref.keys.length ||
      ref.keys.length > 16 ||
      ref.keys.some((k) => !k.field.trim() || !k.reference_field.trim())
    )
      throw Error(ruleText("keyMapping"));
    if (
      !ref.rows.length ||
      ref.rows.length > 100 ||
      ref.rows.some((r) => !r || Array.isArray(r) || Object.values(r).some((v) => !scalar(v)))
    )
      throw Error(ruleText("referenceRows"));
    if (
      ref.matches_field &&
      ref.rows.some((row) => ![0, 1].includes(row[ref.matches_field!] as number))
    )
      throw Error(ruleText("referenceMatches"));
    const refs = ref.evidence_refs ?? [];
    if (refs.length > 20 || refs.some((r) => !r.trim() || Array.from(r).length > 512))
      throw Error(ruleText("referenceEvidence"));
  }
}

export type DeclarationProgram = {
  version: 1;
  target: "resource" | "property" | "dataProperty" | "logicProperty";
  parameters?: Record<
    string,
    { title: string; required: boolean; schema: Record<string, unknown>; example?: unknown }
  >;
  assertions: {
    id: string;
    operator: string;
    select: Record<string, unknown>;
    message: string;
    [key: string]: unknown;
  }[];
};
export function newDeclarationProgram(kind: string): DeclarationProgram {
  return {
    version: 1,
    target: kind === "objectProperty" ? "property" : "resource",
    assertions: [
      {
        id: "definition",
        operator: "schema",
        select: { source: "target", paths: ["$"] },
        value: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1 } },
        },
        message: "名称声明缺失或为空。",
      },
    ],
  };
}
export function declarationParametersSchema(program?: DeclarationProgram): Record<string, unknown> {
  const entries = Object.entries(program?.parameters ?? {});
  return {
    type: "object",
    properties: Object.fromEntries(entries.map(([name, p]) => [name, p.schema])),
    required: entries.filter(([, p]) => p.required).map(([name]) => name),
    additionalProperties: false,
  };
}
