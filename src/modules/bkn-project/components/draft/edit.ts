/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { extractRequestErrorDetails } from "@/framework/request/error-message";
import type {
  Draft,
  DraftItemEdit,
  DraftItemKind,
  DraftObjectType,
  DraftRelationType,
  DraftValueType,
} from "@/modules/bkn-project/types/draft";

/** The lengths bkn-project accepts for an item's name and description. */
export const NAME_MAX = 128;
export const DESCRIPTION_MAX = 1000;

export type EditableItem = DraftObjectType | DraftRelationType | DraftValueType;

const DRAFT_ERROR_PREFIX = "BknProject.Draft.";

/** The draft error bkn-project answered, without its prefix ("Stale"), if it answered one. */
export function draftErrorCode(error: unknown): string | undefined {
  const { code } = extractRequestErrorDetails(error);
  return code?.startsWith(DRAFT_ERROR_PREFIX) ? code.slice(DRAFT_ERROR_PREFIX.length) : undefined;
}

/** Why an item cannot be adopted now, as people can act on it. */
export type AdoptBlocker = "endsNotAdopted" | "needsIdentity";

/**
 * Why the adoption switch may not be turned on, or null when it may. Unadopting is always
 * accepted; adopting is refused for an object type waiting for its identity, and for a relation
 * type whose ends are not both adopted. The page offers only what bkn-project would accept.
 */
export function adoptBlocker(
  draft: Draft,
  kind: DraftItemKind,
  item: EditableItem,
): AdoptBlocker | null {
  if (item.adopted) {
    return null;
  }
  if (kind === "object_types") {
    return (item as DraftObjectType).needsIdentity ? "needsIdentity" : null;
  }
  if (kind === "relation_types") {
    const relation = item as DraftRelationType;
    const adopted = new Set(
      draft.items.objectTypes.filter((objectType) => objectType.adopted).map(({ id }) => id),
    );
    return adopted.has(relation.source) && adopted.has(relation.target) ? null : "endsNotAdopted";
  }
  return null;
}

export const canAdopt = (draft: Draft, kind: DraftItemKind, item: EditableItem) =>
  adoptBlocker(draft, kind, item) === null;

/** Relations adopted before an edit and not after: those unadopting an object type took along. */
export function unadoptedWith(before: Draft, after: Draft): DraftRelationType[] {
  const was = new Set(
    before.items.relationTypes.filter((relation) => relation.adopted).map(({ id }) => id),
  );
  return after.items.relationTypes.filter((relation) => !relation.adopted && was.has(relation.id));
}

/** The name and description that changed, trimmed; null when nothing did. */
export function nameEdit(
  item: { description: string; name: string },
  values: { description: string; name: string },
): DraftItemEdit | null {
  const edit: DraftItemEdit = {};
  const name = values.name.trim();
  const description = values.description.trim();
  if (name !== item.name) {
    edit.name = name;
  }
  if (description !== item.description.trim()) {
    edit.description = description;
  }
  return Object.keys(edit).length ? edit : null;
}
