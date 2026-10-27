/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type {
  Draft,
  DraftJoinEvidence,
  DraftKeyEvidence,
  DraftRelationType,
} from "@/modules/bkn-project/types/draft";

/**
 * Evidence is rendered as source + verification + counts. Sources and reasons are open sets:
 * drafting may add new ones, so an unknown value reads as "other basis" with the raw value
 * kept for the details, never as an error.
 */
export type Phrase = { key: string; params?: Record<string, unknown> };

export const say = (t: TFunction, phrase: Phrase) => t(phrase.key, phrase.params);

const PREFIX = "bknProject.model.evidence";

const KEY_SOURCES = ["primary_key", "unique_index", "inferred", "chosen", "none"];
const ORIGINS = ["foreign_key", "name_match", "link_table"];
const VERIFICATIONS = ["confirmed", "unconfirmed"];
const COUNT_REASONS = ["composite_key", "query_failed", "cross_catalog", "link_table"];

const known = (group: string, values: string[], value: string): Phrase =>
  values.includes(value)
    ? { key: `${PREFIX}.${group}.${value}` }
    : { key: `${PREFIX}.other`, params: { value } };

export const keySourcePhrase = (source: string) => known("keySource", KEY_SOURCES, source);
export const originPhrase = (origin: string) => known("origin", ORIGINS, origin);
export const verificationPhrase = (verification: string) =>
  known("verification", VERIFICATIONS, verification);

/**
 * Why nothing was counted. A failed query carries the data source's reply after the code
 * ("query_failed: …"); the page only says counting did not finish, never the reply.
 */
export function countReasonPhrase(reason: string | undefined): Phrase {
  if (!reason) {
    return { key: `${PREFIX}.countReason.none` };
  }
  const code = reason.split(":", 1)[0].trim();
  // In the count slot an unknown reason still reads as "not counted", not as another basis.
  return COUNT_REASONS.includes(code)
    ? { key: `${PREFIX}.countReason.${code}` }
    : { key: `${PREFIX}.countReason.other`, params: { value: code } };
}

export const formatRate = (rate: number) => `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;

export function keyCountPhrase(key: DraftKeyEvidence): Phrase {
  return key.computed
    ? {
        key: `${PREFIX}.keyCount`,
        params: { distinct: key.distinct, nulls: key.nulls, rows: key.rows },
      }
    : countReasonPhrase(key.reason);
}

/**
 * Warnings about a counted key: records that share a value merge into one instance, and
 * records without a value create none. They warn and never block; the checks after the
 * draft is confirmed decide.
 */
export function keyWarnings(key: DraftKeyEvidence): Phrase[] {
  if (!key.computed) {
    return [];
  }
  const warnings: Phrase[] = [];
  if (key.distinct < key.rows - key.nulls) {
    warnings.push({
      key: `${PREFIX}.warning.notUnique`,
      params: { distinct: key.distinct, rows: key.rows },
    });
  }
  if (key.nulls > 0) {
    warnings.push({ key: `${PREFIX}.warning.nulls`, params: { nulls: key.nulls } });
  }
  return warnings;
}

export function joinCountPhrase(evidence: DraftJoinEvidence): Phrase {
  return evidence.computed
    ? {
        key: `${PREFIX}.joinCount`,
        params: {
          hits: evidence.hits,
          orphans: evidence.orphans,
          rate: formatRate(evidence.hitRate),
          rows: evidence.rows,
        },
      }
    : countReasonPhrase(evidence.reason);
}

/**
 * Relations adopted while an object type they connect is not: drafts made before the rule
 * that a relation needs both ends adopted may hold them. People unadopt them; the page never
 * edits on its own.
 */
export function relationsWithUnadoptedEnds(draft: Draft): DraftRelationType[] {
  const adopted = new Set(
    draft.items.objectTypes.filter((item) => item.adopted).map((item) => item.id),
  );
  return draft.items.relationTypes.filter(
    (relation) =>
      relation.adopted && !(adopted.has(relation.source) && adopted.has(relation.target)),
  );
}

/**
 * Catalogs the project or its draft reads that the caller cannot see in the catalog list:
 * gone, or hidden from the caller. Drafting from them fails, and so do counts and restores
 * on the tables the draft took from them.
 */
export function missingCatalogs(
  projectCatalogIds: string[],
  draft: Draft | null,
  visibleCatalogIds: ReadonlySet<string>,
): string[] {
  const read = new Set(projectCatalogIds);
  for (const item of draft?.items.objectTypes ?? []) {
    read.add(item.table.catalogId);
  }
  return [...read].filter((id) => id && !visibleCatalogIds.has(id));
}

/** Why a field was left out or a table could not be read; unknown reasons read as other. */
export function excludedReasonText(t: TFunction, reason: string | undefined, keyword?: string) {
  if (!reason) {
    return t("bknProject.model.excluded.reason.none");
  }
  return t(`bknProject.model.excluded.reason.${reason}`, {
    defaultValue: t("bknProject.model.excluded.reason.other", { value: reason }),
    keyword,
  });
}
