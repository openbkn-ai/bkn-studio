/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import {
  projectErrorCode,
  projectErrorDetails,
  UNDERSTAND_SECONDS_PER_TABLE,
} from "@/modules/bkn-project/services/publish.service";
import type {
  CheckStatus,
  IndexBuild,
  IndexItem,
  IndexState,
  ProjectBlocker,
  UnderstandingStatus,
} from "@/modules/bkn-project/types/publish";

/*
 * What bkn-project answers is shown as what it means for the person and what they can do: codes,
 * reasons and outcomes map to the module's copy, never to the backend's own text.
 */

/** The refusals the pages explain; any other falls back to the action's own failure text. */
export const KNOWN_REFUSALS = [
  "Draft.UndecidedNotAccepted",
  "Draft.PartialNotAccepted",
  "Draft.HasPending",
  "Draft.Stale",
  "Draft.NotReady",
  "Draft.NothingAdopted",
  "Draft.ProjectArchived",
  "Draft.NotOwner",
  "Lineage.DefinitionsExist",
  "Lineage.BranchNotV3",
  "Lineage.LineageNotV3",
  "Lineage.InvalidDefinitions",
  "Check.Running",
  "Check.ConfirmAgain",
  "Check.NothingConfirmed",
  "Check.NotOwner",
  "Index.NotOwner",
  "Index.NothingConfirmed",
  "Index.ConfirmAgain",
  "Understand.NotOwner",
  "Understand.NoCatalogs",
] as const;

const knownRefusals = new Set<string>(KNOWN_REFUSALS);

export function listText(t: TFunction, items: string[]) {
  return items.join(t("bknProject.listSeparator"));
}

/** The ids of the definition files a refusal lists, such as `object_types/customers.bkn`. */
export function definitionIds(details: unknown): string[] {
  if (!Array.isArray(details)) {
    return [];
  }
  return details
    .filter((path): path is string => typeof path === "string")
    .map((path) => (path.split("/").pop() ?? path).replace(/\.bkn$/, ""));
}

/**
 * Explains a refused request. `names` gives the draft's item names by id, so the definitions a
 * confirmation clashes with are named as the person knows them.
 */
export function refusalText(
  t: TFunction,
  error: unknown,
  fallbackKey = "bknProject.errors.generic",
  names: Record<string, string> = {},
) {
  const code = projectErrorCode(error);
  if (!code || !knownRefusals.has(code)) {
    return t(fallbackKey);
  }
  if (code === "Lineage.DefinitionsExist") {
    const ids = definitionIds(projectErrorDetails(error));
    return ids.length
      ? t("bknProject.errors.Lineage.DefinitionsExist", {
          names: listText(
            t,
            ids.map((id) => names[id] ?? id),
          ),
        })
      : t("bknProject.errors.Lineage.DefinitionsExistUnnamed");
  }
  return t(`bknProject.errors.${code}`);
}

/** Reasons said with the count of what waits; without a count they fall back to the general text. */
const COUNTED_REASONS = new Set(["needs_identity", "unadopted_ends"]);

const BLOCKED_REASONS = new Set([
  "archived",
  "branch_not_v3",
  "definitions_exist",
  "lineage_not_v3",
  "needs_identity",
  "no_catalogs",
  "not_owner",
  "nothing_adopted",
  "running",
  "unadopted_ends",
]);

/** Why the draft cannot be confirmed now, counted from the matching blocker. */
export function blockedText(t: TFunction, reason: string | undefined, blockers: ProjectBlocker[]) {
  if (!reason || !BLOCKED_REASONS.has(reason)) {
    return t("bknProject.confirm.blocked.other");
  }
  const count = blockers.find((blocker) => blocker.code === reason)?.count ?? 0;
  if (COUNTED_REASONS.has(reason) && !count) {
    return t("bknProject.confirm.blocked.other");
  }
  return t(`bknProject.confirm.blocked.${reason}`, { count });
}

const PENDING_BECAUSE = new Set([
  "below_adopt_hit_rate",
  "below_suggest_hit_rate",
  "end_not_adopted",
  "few_values",
  "needs_identity",
  "not_adopted",
  "not_counted",
]);

/** Why drafting did not adopt an item nobody has decided on. */
export function pendingBecauseText(t: TFunction, because: string | undefined) {
  return t(
    `bknProject.confirm.because.${because && PENDING_BECAUSE.has(because) ? because : "other"}`,
  );
}

export const CHECK_STATUSES: readonly CheckStatus[] = [
  "running",
  "passed",
  "issues",
  "partial",
  "failed",
];

export const CHECK_STATUS_TONE: Record<CheckStatus, LightStatusTone> = {
  failed: "error",
  issues: "error",
  partial: "warning",
  passed: "success",
  running: "info",
};

const CHECK_REASONS = new Set([
  "cross_catalog",
  "no_key",
  "query_failed",
  "several_fields",
  "timeout",
  "unmapped",
]);

/** Why one count of the check was not made, or failed. */
export function checkReasonText(t: TFunction, reason: string | undefined) {
  return t(
    `bknProject.release.check.reason.${reason && CHECK_REASONS.has(reason) ? reason : "other"}`,
  );
}

export const INDEX_STATE_TONE: Record<IndexState, LightStatusTone> = {
  building: "info",
  not_built: "neutral",
  not_configured: "warning",
  ready: "success",
  stale: "warning",
  unreadable: "error",
};

const INDEX_STATES = new Set<string>(Object.keys(INDEX_STATE_TONE));

/** An index's state; a ready index being rebuilt says so, and a state the page does not know too. */
export function indexStateText(t: TFunction, item: IndexItem) {
  if (item.state === "ready" && item.task) {
    return t("bknProject.release.index.state.readyRebuilding");
  }
  return t(`bknProject.release.index.state.${INDEX_STATES.has(item.state) ? item.state : "other"}`);
}

const INDEX_FIELDS = new Set(["incremental_fields", "primary_key_fields"]);

/** The settings a table lacks for its index, as the object type's fields people know. */
export function missingFieldsText(t: TFunction, missing: string[]) {
  const fields = missing
    .filter((field) => INDEX_FIELDS.has(field))
    .map((field) => t(`bknProject.release.index.field.${field}`));
  if (!fields.length) {
    return t("bknProject.release.index.outcome.notConfigurable.other");
  }
  return t("bknProject.release.index.missing", { fields: listText(t, fields) });
}

/** What the last build did for a table; a reason vega gave is never shown as is. */
export function buildOutcomeText(t: TFunction, build: IndexBuild) {
  if (build.outcome !== "not_configurable") {
    return t(`bknProject.release.index.outcome.${build.outcome}`);
  }
  const keys = (build.reason ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => INDEX_FIELDS.has(key));
  if (!keys.length) {
    return t("bknProject.release.index.outcome.notConfigurable.other");
  }
  return keys
    .map((key) => t(`bknProject.release.index.outcome.notConfigurable.${key}`))
    .join(t("bknProject.sentenceSeparator"));
}

export const UNDERSTANDING_STATUS_TONE: Record<UnderstandingStatus, LightStatusTone> = {
  cancelled: "neutral",
  completed: "success",
  failed: "error",
  not_started: "neutral",
  pending: "neutral",
  running: "info",
};

/**
 * About how many minutes semantic understanding still needs, or null for fewer than two tables:
 * the estimate is rough, so it is given only when it is worth waiting on.
 */
export function understandingMinutesLeft(remainingTables: number): number | null {
  if (remainingTables < 2) {
    return null;
  }
  return Math.ceil((remainingTables * UNDERSTAND_SECONDS_PER_TABLE) / 60);
}
