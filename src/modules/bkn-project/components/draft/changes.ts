/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { Draft, DraftDecision } from "@/modules/bkn-project/types/draft";
import type { ProjectAccount } from "@/modules/bkn-project/types/project";

const PREFIX = "bknProject.model.changes";

const ACTIONS = ["adopt", "unadopt", "rename", "describe", "identity", "restore"];
const KINDS = ["object_types", "relation_types", "value_types"];
/** What a confirmation accepted, recorded on the draft as a whole and listing what it took in. */
const ACCEPTANCES = ["accept_partial", "accept_undecided", "accept_unresolved_conflicts"];

/** Current item names by kind and id: a decision names the item as it is now called. */
export type ItemNames = Record<string, Record<string, string>>;

export function itemNames(draft: Draft): ItemNames {
  const byId = (items: { id: string; name: string }[]) =>
    Object.fromEntries(items.map(({ id, name }) => [id, name]));
  const objectTypes = byId(draft.items.objectTypes);
  return {
    // A restore names the object type the field was restored to.
    excluded: objectTypes,
    object_types: objectTypes,
    relation_types: byId(draft.items.relationTypes),
    value_types: byId(draft.items.valueTypes),
  };
}

/** One decision in a sentence, with what it replaced when that says more than the sentence. */
export type DescribedDecision = { after?: string; before?: string; text: string };

const asText = (value: unknown) => (typeof value === "string" ? value : "");
const asList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** What adding catalogs drafted, as its decision records it; or that drafting their tables failed. */
function addedCatalogsText(t: TFunction, after: unknown) {
  const added = (after ?? {}) as Record<string, unknown>;
  const count = (key: string) => asList(added[key]).length;
  if (asText(added.error)) {
    return t(`${PREFIX}.addCatalogs.failed`, { count: count("catalog_ids") });
  }
  return t(`${PREFIX}.addCatalogs.done`, {
    count: count("catalog_ids"),
    objects: count("object_types"),
    relations: count("relation_types"),
  });
}

export function describeDecision(
  t: TFunction,
  decision: DraftDecision,
  names: ItemNames,
): DescribedDecision {
  if (decision.kind === "draft" && decision.action === "add_catalogs") {
    return { text: addedCatalogsText(t, decision.after) };
  }
  if (decision.kind === "draft") {
    const accepted = ACCEPTANCES.includes(decision.action) ? decision.action : "other";
    return {
      text: t(`${PREFIX}.confirmation.${accepted}`, { count: asList(decision.after).length }),
    };
  }
  const name = names[decision.kind]?.[decision.itemId] ?? decision.itemId;
  const kind = t(
    `${PREFIX}.kind.${KINDS.includes(decision.kind) ? decision.kind : "object_types"}`,
  );
  const empty = t(`${PREFIX}.empty`);
  const action = ACTIONS.includes(decision.action) ? decision.action : "other";
  switch (action) {
    case "rename":
      return {
        text: t(`${PREFIX}.action.rename`, {
          after: asText(decision.after),
          before: asText(decision.before),
          kind,
        }),
      };
    case "describe":
      return {
        after: asText(decision.after) || empty,
        before: asText(decision.before) || empty,
        text: t(`${PREFIX}.action.describe`, { kind, name }),
      };
    case "identity": {
      const after = asList(decision.after).join(" + ");
      return {
        after: after || empty,
        before: asList(decision.before).join(" + ") || empty,
        text: t(`${PREFIX}.action.identity`, { name, properties: after }),
      };
    }
    case "restore": {
      const field = (decision.before as { field?: unknown } | null)?.field;
      return {
        text: t(`${PREFIX}.action.restore`, {
          field: asText(field),
          name,
          property: asText(decision.after),
        }),
      };
    }
    default:
      return { text: t(`${PREFIX}.action.${action}`, { kind, name }) };
  }
}

/** Who made a decision, by name when it can be read, never by account id. */
export function whoDecided(
  t: TFunction,
  by: ProjectAccount,
  currentUserId: string | null | undefined,
  directory: ReadonlyMap<string, string>,
): string {
  if (by.id === currentUserId) {
    return t(`${PREFIX}.you`);
  }
  return directory.get(by.id) ?? t(`${PREFIX}.someone`);
}
