/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import "./locales";
export type EvalTerm =
  | "moduleName"
  | "caseName"
  | "assessmentTarget"
  | "checkTarget"
  | "evaluationInfo"
  | "testContent"
  | "testInput"
  | "arguments"
  | "relatedRule"
  | "noRelatedRule"
  | "decisionMethod"
  | "criteria"
  | "decisionDetails"
  | "decisionItem"
  | "expected"
  | "actual"
  | "evaluationLevel"
  | "evidence"
  | "executionCapability"
  | "executionFunction"
  | "readiness"
  | "ready"
  | "notReady"
  | "enabled"
  | "inactive"
  | "queued"
  | "running"
  | "completed"
  | "executionFailed"
  | "cancelled"
  | "passed"
  | "notPassed"
  | "inconclusive"
  | "humanJudgment"
  | "assessmentScope"
  | "checkScope"
  | "runScope"
  | "targetUnrecorded"
  | "scenarioTarget"
  | "operationRecord"
  | "receiptRecord"
  | "interactionRecord";
export const evalTerm = (key: EvalTerm): string => i18n.t(`knowledgeNetwork.eval.terms.${key}`);
export function evalOutcomeLabel(value?: string | null): string {
  const key: Partial<Record<string, EvalTerm>> = {
    pass: "passed",
    fail: "notPassed",
    inconclusive: "inconclusive",
    review_required: "humanJudgment",
    pending_review: "humanJudgment",
  };
  return value && key[value] ? evalTerm(key[value]) : "—";
}
export function evalExecutionStatusLabel(value?: string): string {
  const key: Partial<Record<string, EvalTerm>> = {
    queued: "queued",
    running: "running",
    completed: "completed",
    failed: "executionFailed",
    cancelled: "cancelled",
  };
  return value && key[value] ? evalTerm(key[value]) : "—";
}
