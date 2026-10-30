/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/**
 * Requirement codes are for machines; the page words them. Every set is open: a value the page
 * does not know reads as "other", never as the code.
 */
const PREFIX = "bknProject.requirements";

const word = (group: string, values: readonly string[]) => (t: TFunction, value: string) =>
  t(`${PREFIX}.${group}.${values.includes(value) ? value : "other"}`);

export const DOC_TYPES = ["prd", "policy", "standard", "other"] as const;

export const docTypeText = word("docType", DOC_TYPES);

export const draftErrorText = word("draftError", [
  "agent_rejected",
  "agent_unavailable",
  "agent_failed",
  "agent_timeout",
  "output_invalid",
  "interrupted",
]);

export const categoryText = word("category", [
  "object",
  "event",
  "property",
  "relation",
  "evidence",
  "not_ontology",
]);

export const layerText = word("layer", ["knowledge", "capability"]);

export const questionTypeText = word("questionType", [
  "point_in_time",
  "provenance",
  "filter",
  "compare",
  "aggregate",
  "count",
  "disambiguate",
  "judge",
  "metric",
]);

export const capabilityKindText = word("capabilityKind", ["metric", "function", "skill", "app"]);

export const compilesToText = word("compilesTo", [
  "constraint",
  "metric_definition",
  "code_pattern",
  "enum",
]);

export const conflictKindText = word("conflictKind", ["term", "rule", "goal", "scope", "scenario"]);

/** Why the server refused a question's input. */
export const INPUT_REASONS = [
  "input_unknown_concept",
  "input_concept_not_mapped",
  "input_unknown_property",
  "input_not_in_template",
  "input_not_time",
  "input_unknown_role",
  "input_duplicate_name",
];

export const inputReasonText = word("inputReason", INPUT_REASONS);

const rejectedReasonWord = word("rejectedReason", [
  "quote_not_found",
  "unknown_document",
  "number_not_in_quote",
  "too_few_options",
  "window_without_reference_time",
]);

/** Why drafting dropped an item; a dropped input says it as an input's refusal does. */
export const rejectedReasonText = (t: TFunction, reason: string) =>
  INPUT_REASONS.includes(reason) ? inputReasonText(t, reason) : rejectedReasonWord(t, reason);

/**
 * The inputs a refused edit names, by input name, from `error_details` lines such as
 * "input order: input_not_in_template". Lines that name no input are left out.
 */
export function refusedInputs(details: unknown): Record<string, string> {
  const lines = Array.isArray(details) ? details : typeof details === "string" ? [details] : [];
  const refused: Record<string, string> = {};
  for (const line of lines) {
    const match = typeof line === "string" ? /^input\s+(.+?):\s*(\w+)\s*$/.exec(line.trim()) : null;
    if (match) {
      refused[match[1]] = match[2];
    }
  }
  return refused;
}

export const rejectedKindText = word("rejectedKind", [
  "input",
  "scenario",
  "concept",
  "question",
  "rule",
  "conflict",
  "choice",
]);

/** Why a file was refused, from the code after its area: `Requirement.NotText` alike. */
export function uploadRefusalText(t: TFunction, code: string) {
  const name = code.slice(code.lastIndexOf(".") + 1);
  return word("uploadRefusal", [
    "UnsupportedFormat",
    "NotText",
    "DocumentTooLarge",
    "TooManyDocuments",
    "InvalidRequestBody",
  ])(t, name);
}

/** Why drafting or a document change was refused. */
export function requirementErrorText(t: TFunction, code: string | undefined) {
  const name = code ? code.slice(code.lastIndexOf(".") + 1) : "";
  return word("error", [
    "NotOwner",
    "ProjectArchived",
    "NoDocuments",
    "NoCatalogs",
    "InputsTooLarge",
    "Drafting",
    "DocumentNotFound",
    "InvalidDocumentType",
    "TooManyDocuments",
    "DocumentTooLarge",
  ])(t, name);
}

export const testKindText = word("testKind", [
  "template",
  "paraphrase",
  "boundary",
  "not_exist",
  "variant",
]);

/** Test kinds whose expected result the server sets from the kind; a person edits only the text. */
export const KINDS_WITH_SET_EXPECT = ["template", "paraphrase", "boundary", "variant", "not_exist"];

export const testsNoteText = word("testsNote", ["inputs_untested", "none_checkable"]);

export const testExpectText = word("testExpect", ["exists", "not_exists", "same_record"]);

export const testOutcomeText = word("testOutcome", ["passed", "failed", "not_checked"]);

const checkReasonWord = word("testCheckReason", [
  "pending",
  "record_not_found",
  "record_exists",
  "different_records",
  "no_values",
  "unknown_concept",
  "concept_not_mapped",
  "item_not_drafted",
  "unknown_property",
  "property_not_mapped",
  "same_record_needs_two_values",
  "same_record_needs_one_object_type",
  "composite_identity",
  "query_failed",
  "excluded_field",
  "no_value_in_data",
  "no_absent_value",
  "value_not_in_text",
  "value_outside_slot",
  "check_timeout",
]);

/**
 * Why a test question did not pass its check against the data, or was not checked. A failed
 * query carries the data source's reply after the code; the page says only the code's words.
 */
export const testCheckReasonText = (t: TFunction, reason: string) =>
  checkReasonWord(t, reason.split(":", 1)[0].trim());
