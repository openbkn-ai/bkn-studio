/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import type { Regression, ReleaseCheck, ReleaseItem } from "@/modules/bkn-project/types/release";

/**
 * Release codes are for machines; the page words them. Every set is open: a code the page does
 * not know reads as "other", never as the code.
 */
const PREFIX = "bknProject.release.publish";

const CHECKS = new Set([
  "confirmed",
  "mapped",
  "data_source",
  "names",
  "drift",
  "check",
  "index",
  "baseline",
]);
const REASONS = new Set([
  "not_confirmed",
  "confirmation_outdated",
  "mapping_missing",
  "table_missing",
  "data_source_unreadable",
  "duplicate_names",
  "similar_names",
  "drift",
  "check_not_run",
  "check_running",
  "check_issues",
  "check_failed",
  "check_partial",
  "index_not_ready",
  "index_unreadable",
  "branch_behind",
]);
const ACCEPTS = new Set(["similar_names", "check_partial", "index_not_ready"]);
const REFUSALS = new Set([
  "VersionExists",
  "NetworkExists",
  "InvalidVersion",
  "BranchBehind",
  "Drift",
  "CapabilitiesSkipped",
]);
const PUBLISH_ERRORS = new Set([
  "NotOwner",
  "ProjectArchived",
  "ReviewOutdated",
  "ChecksFailed",
  "InvalidAccepts",
  "InvalidVersion",
  "VersionExists",
  "NetworkExists",
  "BranchBehind",
  "Drift",
  "MergeConflict",
]);
const CAPABILITY_REASONS = new Set(["changed", "network_id"]);

/** The last part of an error code: `Release.VersionExists` and `Lineage.VersionExists` alike. */
const codeName = (code: string) => code.slice(code.lastIndexOf(".") + 1);

const listOf = (t: TFunction, names: string[]) => names.join(t("bknProject.listSeparator"));

export const checkTitle = (t: TFunction, code: string) =>
  t(`${PREFIX}.check.${CHECKS.has(code) ? code : "other"}`);

/** Why a check did not pass, with what its details name. */
export function checkReasonText(t: TFunction, check: ReleaseCheck): string {
  const reason = check.reason && REASONS.has(check.reason) ? check.reason : "other";
  const details = check.details;
  if (reason === "mapping_missing" && Array.isArray(details)) {
    const names = (details as ReleaseItem[]).map((item) => item.name || item.id);
    return t(`${PREFIX}.reason.mapping_missing`, { names: listOf(t, names) });
  }
  if (reason === "table_missing" && Array.isArray(details)) {
    return t(`${PREFIX}.reason.table_missing`, { count: details.length });
  }
  if ((reason === "duplicate_names" || reason === "similar_names") && details) {
    const pairs = (details as { same?: NamePair[] | null; similar?: NamePair[] | null })[
      reason === "duplicate_names" ? "same" : "similar"
    ];
    const names = (pairs ?? []).map((pair) =>
      t(`${PREFIX}.reason.namePair`, { added: pair.added.name, other: pair.other.name }),
    );
    return t(`${PREFIX}.reason.${reason}`, { pairs: listOf(t, names) });
  }
  if (reason === "index_not_ready" && details && typeof details === "object") {
    const counts = details as Record<string, number>;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return t(`${PREFIX}.reason.index_not_ready`, { ready: counts.ready ?? 0, total });
  }
  if (reason === "branch_behind" && details && typeof details === "object") {
    const base = (details as { base_version?: string }).base_version;
    if (base) {
      return t(`${PREFIX}.reason.branch_behind_version`, { version: base });
    }
  }
  return t(`${PREFIX}.reason.${reason}`);
}

/** The items a check names one per line: those whose tables are gone. */
export function checkDetailRows(t: TFunction, check: ReleaseCheck): string[] {
  if (check.passed || check.reason !== "table_missing" || !Array.isArray(check.details)) {
    return [];
  }
  return (check.details as ReleaseItem[]).map((item) =>
    t(`${PREFIX}.reason.tableMissingItem`, { name: item.name || item.id }),
  );
}

type NamePair = { added: ReleaseItem; other: ReleaseItem };

/** The words for what the owner accepts in publishing anyway. */
export const acceptText = (t: TFunction, accept: string) =>
  t(`${PREFIX}.accept.${ACCEPTS.has(accept) ? accept : "other"}`);

/** What a published release accepted, as a release's notes name it. */
const acceptedText = (t: TFunction, accept: string) =>
  t(`${PREFIX}.accepted.${ACCEPTS.has(accept) ? accept : "other"}`);

export function refusalText(t: TFunction, code: string) {
  const name = codeName(code);
  return t(`${PREFIX}.refusal.${REFUSALS.has(name) ? name : "other"}`);
}

/** Why publishing was refused, from its error code; none for an error without one. */
export function publishErrorText(t: TFunction, code: string | undefined) {
  const name = code ? codeName(code) : "";
  return t(`${PREFIX}.error.${PUBLISH_ERRORS.has(name) ? name : "other"}`);
}

export const capabilityReasonText = (t: TFunction, reason: string) =>
  t(`${PREFIX}.capabilityReason.${CAPABILITY_REASONS.has(reason) ? reason : "other"}`);

/**
 * A release's notes as people wrote them, and what was accepted to publish it: bkn-project
 * appends that as a line `Accepted: ` of codes, which the page words.
 */
export function releaseNotes(t: TFunction, notes: string): { accepted: string; text: string } {
  const lines = notes.split("\n");
  const marker = "Accepted: ";
  // bkn-project appends it last; a line a person wrote the same way stays theirs.
  const acceptedLine = [...lines].reverse().find((line) => line.startsWith(marker));
  const accepted = acceptedLine
    ? acceptedLine
        .slice(marker.length)
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((code) => acceptedText(t, code))
    : [];
  return {
    accepted: accepted.length ? listOf(t, accepted) : "",
    text: lines
      .filter((line) => line !== acceptedLine)
      .join("\n")
      .trim(),
  };
}

const REGRESSION = "bknProject.release.regression";

const REGRESSION_STATUSES = new Set([
  "running",
  "passed",
  "not_passed",
  "needs_values",
  "failed",
  "no_questions",
  "data_source_missing",
]);
const REGRESSION_ERRORS = new Set(["interrupted", "definitions_unreadable"]);
const OUTCOMES = new Set([
  "passed",
  "missing",
  "no_answer",
  "needs_values",
  "not_answered",
  "error",
  "data_source_missing",
]);
const EXPECTS = new Set(["exists", "not_exists", "same_record"]);
/** Why a question could not be asked or judged; the codes of the services behind are never shown. */
const ANSWER_ERRORS = new Map([
  ["BknAgent.Execution.Forbidden", "forbidden"],
  ["BknAgent.NotFound", "assistantMissing"],
  ["answer_interrupted", "interrupted"],
  ["cancelled", "cancelled"],
  ["judge_invalid", "judgeInvalid"],
  ["judge_unavailable", "judgeUnavailable"],
  ["tools_unavailable", "toolsUnavailable"],
  ["unreachable", "unreachable"],
]);

export const regressionStatusText = (t: TFunction, status: string) =>
  t(`${REGRESSION}.status.${REGRESSION_STATUSES.has(status) ? status : "other"}`);

export const regressionErrorText = (t: TFunction, error: string) =>
  t(`${REGRESSION}.runError.${REGRESSION_ERRORS.has(error) ? error : "other"}`);

export const outcomeText = (t: TFunction, outcome: string) =>
  t(`${REGRESSION}.outcome.${OUTCOMES.has(outcome) ? outcome : "other"}`);

export const expectText = (t: TFunction, expect: string) =>
  t(`${REGRESSION}.expect.${EXPECTS.has(expect) ? expect : "other"}`);

export const answerErrorText = (t: TFunction, code: string) =>
  t(`${REGRESSION}.answerError.${ANSWER_ERRORS.get(code) ?? "other"}`);

const REGRESSION_TONE: Record<string, LightStatusTone> = {
  data_source_missing: "error",
  failed: "error",
  needs_values: "warning",
  no_questions: "neutral",
  not_passed: "error",
  passed: "success",
  running: "info",
};

const OUTCOME_TONE: Record<string, LightStatusTone> = {
  data_source_missing: "error",
  error: "warning",
  missing: "error",
  needs_values: "warning",
  no_answer: "error",
  not_answered: "error",
  passed: "success",
};

const toneOf = (tones: Record<string, LightStatusTone>, value: string): LightStatusTone =>
  Object.hasOwn(tones, value) ? tones[value] : "neutral";

export const regressionTone = (status: string) => toneOf(REGRESSION_TONE, status);

export const outcomeTone = (outcome: string) => toneOf(OUTCOME_TONE, outcome);

/** How many asked questions and tests passed; those not asked for want of their tables do not count. */
export const passedCount = (regression: Regression) => {
  const asked = regression.results.filter((result) => result.outcome !== "data_source_missing");
  return {
    passed: asked.filter((result) => result.outcome === "passed").length,
    total: asked.length,
  };
};
