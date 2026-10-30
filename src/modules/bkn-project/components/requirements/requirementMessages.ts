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

export const rejectedReasonText = word("rejectedReason", [
  "quote_not_found",
  "unknown_document",
  "number_not_in_quote",
  "too_few_options",
]);

export const rejectedKindText = word("rejectedKind", [
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
