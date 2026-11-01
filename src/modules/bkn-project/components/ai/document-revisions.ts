/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import type {
  AskRevision,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";
import { objectPreview } from "./revisions";

/** Apply to a copy of the current document form, preserving proof and managed fields. */
export function applyDocumentObjectRevisions(
  value: DraftObjectTypeSave,
  revisions: AskRevision[],
  readOnly: string[],
  role: string,
): DraftObjectTypeSave {
  return revisions.reduce((current, r) => {
    if (r.field === "name") return { ...current, name: r.value };
    if (r.field === "comment") return { ...current, description: r.value };
    if (r.field === "display_key") return { ...current, displayKey: r.value };
    if (r.field === "primary_keys" && role === "entity")
      return { ...current, primaryKeys: [...r.value] };
    if (r.field !== "data_property") return current;
    return {
      ...current,
      properties: current.properties.map((p) =>
        p.name !== r.value.name || readOnly.includes(p.name)
          ? p
          : {
              ...p,
              ...(r.value.displayName !== undefined ? { displayName: r.value.displayName } : {}),
              ...(r.value.comment !== undefined ? { description: r.value.comment } : {}),
              ...(r.value.extractionInstruction !== undefined && p.extraction
                ? { extraction: { ...p.extraction, instruction: r.value.extractionInstruction } }
                : {}),
            },
      ),
    };
  }, value);
}

/** Read the current unsaved document form, rather than the initial table editor state. */
export function documentObjectPreview(
  t: TFunction,
  value: DraftObjectTypeSave,
  revision: AskRevision,
) {
  const preview = objectPreview(
    t,
    {
      basic: { name: value.name, description: value.description },
      properties: value.properties.map((p) => ({
        ...p,
        comment: p.description,
        primaryKey: value.primaryKeys.includes(p.name),
        displayKey: value.displayKey === p.name,
      })),
    },
    revision,
  );
  if (revision.field !== "data_property" || revision.value.extractionInstruction === undefined)
    return preview;
  const before =
    value.properties.find((p) => p.name === revision.value.name)?.extraction?.instruction ?? "";
  const instruction = (text: string) =>
    t("bknProject.model.ask.preview.extractionInstruction", { value: text });
  const join = (a: string, b: string) =>
    [a, b].filter(Boolean).join(t("bknProject.model.ask.preview.separator"));
  return {
    ...preview,
    before: join(preview.before, instruction(before)),
    after: join(preview.after, instruction(revision.value.extractionInstruction)),
  };
}

/** Document suggestions never enter the SQL mapping editor. */
export function applyDocumentRelationRevisions(
  value: DraftRelationTypeSave,
  revisions: AskRevision[],
): DraftRelationTypeSave {
  return revisions.reduce((current, r) => {
    if (r.field === "name") return { ...current, name: r.value };
    if (r.field === "comment") return { ...current, description: r.value };
    if (r.field !== "ends" || !r.value.documentMapping) return current;
    return {
      ...current,
      ...r.value,
      mapping: [],
      link: undefined,
      documentMapping: { ...r.value.documentMapping },
    };
  }, value);
}
