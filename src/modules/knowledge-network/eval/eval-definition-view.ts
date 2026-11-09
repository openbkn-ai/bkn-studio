/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel } from "./eval-readable-references";
import i18n from "i18next";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import type { EvalSuiteCaseDetail } from "./m0-run.service";

export const definitionText = (key: string) => i18n.t(`knowledgeNetwork.eval.definitionUi.${key}`);
const firstText = (...values: unknown[]): string =>
  values.find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
export const definitionObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const definitionValue = (value: unknown): string =>
  value === undefined
    ? "—"
    : typeof value === "string"
      ? value || '""'
      : transformPrecisionSafeJSONRequest(value);

export function valueAtPath(value: unknown, path: string): unknown {
  if (path === "$") return value;
  if (!path.startsWith("$.")) return undefined;
  return path
    .slice(2)
    .split(".")
    .reduce<unknown>((current, key) => {
      const object = definitionObject(current);
      return Object.hasOwn(object, key) ? object[key] : undefined;
    }, value);
}

export function checkScopeLabel(raw: unknown): string {
  const scope = definitionObject(raw);
  if (scope.mode === "invocation") return definitionText("invocation");
  if (scope.mode === "all") return definitionText("allRows");
  if (scope.mode === "sample") {
    return typeof scope.limit === "number" && Number.isFinite(scope.limit)
      ? i18n.t("knowledgeNetwork.eval.suiteCaseUi.sample", { count: scope.limit })
      : definitionText("sample");
  }
  return "—";
}

export function ruleLabel(detail: EvalSuiteCaseDetail): string {
  const input = detail.definition.input_spec;
  const diagnostic = detail.definition.diagnostic_spec;
  const source = definitionObject(detail.source);
  const title = firstText(
    input.template_rule_title,
    diagnostic.template_rule_title,
    source.rule_title,
  );
  const id = firstText(input.template_rule_id, diagnostic.template_rule_id, source.rule_id);
  const revision =
    input.template_rule_revision ?? diagnostic.template_rule_revision ?? source.rule_revision;
  const name = title || (id ? evalReferenceLabel("unnamedRule") : definitionText("noRule"));
  return typeof revision === "number" && revision > 0
    ? `${name} · ${definitionText("ruleRevision")} ${revision}`
    : name;
}

export function criterionLabel(assertion: Record<string, unknown>): string {
  const type = String(assertion.type);
  if (["resource_used", "evidence_complete", "manual_review"].includes(type)) {
    return definitionText(type);
  }
  return i18n.t(`knowledgeNetwork.eval.caseEditor.predicates.${type}`, { defaultValue: type });
}

export function criterionStandard(
  assertion: Record<string, unknown>,
  detail: EvalSuiteCaseDetail,
): string {
  const type = assertion.type;
  if (type === "exists") return definitionText("exists");
  if (type === "observation_only") return definitionText("observation");
  if (type === "evidence_complete" || type === "manual_review") return definitionText(String(type));
  if (type === "resource_used")
    return firstText(assertion.resource, definitionText("resource_used"));
  if (type === "json_schema") return definitionValue(assertion.schema);
  if (!detail.gold_visible) return definitionText("protectedExpected");
  const expected = valueAtPath(
    detail.definition.expected_spec,
    firstText(assertion.expected_path, assertion.path, "$"),
  );
  if (expected === undefined) return definitionText("unrecordedExpected");
  const config = definitionObject(expected);
  if (type === "numeric_range") {
    const min = config.min === undefined ? "−∞" : definitionValue(config.min);
    const max = config.max === undefined ? "+∞" : definitionValue(config.max);
    return `${config.min === undefined || config.include_min === false ? "(" : "["}${min}, ${max}${config.max === undefined || config.include_max === false ? ")" : "]"}`;
  }
  if (type === "approx") {
    return `${definitionText("reference")} ${definitionValue(config.value)}; ${definitionText("absoluteTolerance")} ${definitionValue(config.absolute_tolerance)}; ${definitionText("relativeTolerance")} ${definitionValue(config.relative_tolerance)}`;
  }
  return definitionValue(expected);
}
