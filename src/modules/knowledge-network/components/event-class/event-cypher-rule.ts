/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type {
  KnEventCypherRule,
  KnEventRuleParameter,
  KnEventValueFrom,
} from "@/modules/knowledge-network/types/event-type";
import { isCheckOffset } from "@/modules/knowledge-network/utils/action-type-condition";

/** A parameter of a Cypher rule as the form edits it. */
export type CypherParameterDraft = {
  /** Keeps a row's identity while its name is edited. */
  id: number;
  name: string;
  value?: unknown;
  value_from: KnEventValueFrom;
};

export type CypherRuleDraft = {
  parameters: CypherParameterDraft[];
  query: string;
};

/** As bkn-backend checks a target parameter's name. */
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** Given by the platform at each check; a rule cannot name its own. */
const BUILT_IN_PARAMETERS = new Set(["check_time", "check_date"]);
/** As bkn-backend limits a Cypher target. */
export const CYPHER_QUERY_MAX_BYTES = 16 << 10;
const CYPHER_PARAMETER_MAX = 32;

let nextParameterId = 1;

/** A new parameter row, or the row of a saved parameter. */
export function cypherParameterDraft(
  name: string,
  parameter?: KnEventRuleParameter,
): CypherParameterDraft {
  nextParameterId += 1;
  return {
    id: nextParameterId,
    name,
    value: parameter?.value,
    value_from: parameter?.value_from ?? "const",
  };
}

export function cypherDraftFromRule(rule: KnEventCypherRule | undefined): CypherRuleDraft {
  return {
    parameters: Object.entries(rule?.parameters ?? {}).map(([name, parameter]) =>
      cypherParameterDraft(name, parameter),
    ),
    query: rule?.query ?? "",
  };
}

function isBlank(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/** The rule to send, none when the query is empty, or a problem to show. */
export function buildCypherRule(
  draft: CypherRuleDraft,
  t: TFunction,
): { cypher: KnEventCypherRule | null } | { problem: string } {
  const query = draft.query.trim();
  if (!query) return { cypher: null };
  if (new TextEncoder().encode(query).length > CYPHER_QUERY_MAX_BYTES) {
    return { problem: t("knowledgeNetwork.eventClasses.form.cypherQueryTooLong") };
  }
  const parameters: Record<string, KnEventRuleParameter> = {};
  for (const row of draft.parameters) {
    const name = row.name.trim();
    if (!name && isBlank(row.value)) continue;
    if (!PARAMETER_NAME.test(name) || BUILT_IN_PARAMETERS.has(name)) {
      return {
        problem: t("knowledgeNetwork.eventClasses.form.cypherParameterNameInvalid", { name }),
      };
    }
    if (parameters[name]) {
      return {
        problem: t("knowledgeNetwork.eventClasses.form.cypherParameterDuplicate", { name }),
      };
    }
    if (row.value_from === "const") {
      parameters[name] = { value: row.value ?? "", value_from: "const" };
      continue;
    }
    const offset = typeof row.value === "string" ? row.value.trim() : "";
    if (!isCheckOffset(offset, row.value_from === "check_date")) {
      return { problem: t("knowledgeNetwork.eventClasses.form.offsetInvalid") };
    }
    parameters[name] = { ...(offset ? { value: offset } : {}), value_from: row.value_from };
  }
  if (Object.keys(parameters).length > CYPHER_PARAMETER_MAX) {
    return {
      problem: t("knowledgeNetwork.eventClasses.form.cypherParameterTooMany", {
        max: CYPHER_PARAMETER_MAX,
      }),
    };
  }
  return {
    cypher: { query, ...(Object.keys(parameters).length ? { parameters } : {}) },
  };
}
