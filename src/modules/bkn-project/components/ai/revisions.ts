/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import { endsEditorValues } from "@/modules/bkn-project/components/relation-type/relation-values";
import type { AskEnds, AskRevision, DraftTable } from "@/modules/bkn-project/types/draft";
import type { RelationTypeMappingFormValues } from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

import type { RevisionPreview } from "./AskAiSidebar";

/*
 * Ask AI's revisions against an editor: how each reads from what the editor holds now, and the
 * editor's values with them put in. Nothing here saves.
 */

const PREFIX = "bknProject.model.ask";

type Basic = { description: string; name: string };

export type ObjectValues = { basic: Basic; properties: ObjectTypeDataProperty[] };
export type RelationValues = { basic: Basic; values: RelationTypeMappingFormValues };

/** A field of either editor, read as the page shows it. */
function basicPreview(t: TFunction, basic: Basic, revision: AskRevision): RevisionPreview | null {
  if (revision.field === "name") {
    return { after: revision.value, before: basic.name, label: t(`${PREFIX}.field.name`) };
  }
  if (revision.field === "comment") {
    return {
      after: revision.value,
      before: basic.description,
      label: t(`${PREFIX}.field.comment`),
    };
  }
  return null;
}

function withBasic(basic: Basic, revision: AskRevision): Basic {
  if (revision.field === "name") {
    return { ...basic, name: revision.value };
  }
  if (revision.field === "comment") {
    return { ...basic, description: revision.value };
  }
  return basic;
}

/** How a revision of an object type reads; properties by their display names. */
export function objectPreview(
  t: TFunction,
  { basic, properties }: ObjectValues,
  revision: AskRevision,
): RevisionPreview {
  const shown = (name: string) =>
    properties.find((property) => property.name === name)?.displayName || name;
  const keys = (names: string[]) => names.map(shown).join(t(`${PREFIX}.preview.keySeparator`));
  switch (revision.field) {
    case "primary_keys":
      return {
        after: keys(revision.value),
        before: keys(properties.filter((property) => property.primaryKey).map(({ name }) => name)),
        label: t(`${PREFIX}.field.primary_keys`),
      };
    case "display_key": {
      const current = properties.find((property) => property.displayKey);
      return {
        after: shown(revision.value),
        before: current ? shown(current.name) : "",
        label: t(`${PREFIX}.field.display_key`),
      };
    }
    case "data_property": {
      const property = properties.find((item) => item.name === revision.value.name);
      const parts = (values: { comment?: string; displayName?: string }) =>
        [
          revision.value.displayName !== undefined
            ? t(`${PREFIX}.preview.displayName`, { value: values.displayName ?? "" })
            : null,
          revision.value.comment !== undefined
            ? t(`${PREFIX}.preview.comment`, { value: values.comment ?? "" })
            : null,
        ]
          .filter(Boolean)
          .join(t(`${PREFIX}.preview.separator`));
      return {
        after: parts(revision.value),
        before: parts({ comment: property?.comment, displayName: property?.displayName }),
        label: t(`${PREFIX}.preview.property`, { name: shown(revision.value.name) }),
      };
    }
    default:
      return (
        basicPreview(t, basic, revision) ?? {
          after: "",
          before: "",
          label: t(`${PREFIX}.field.other`),
        }
      );
  }
}

/** The object type editor's values with the revisions put in, in order. */
export function applyObjectRevisions(values: ObjectValues, revisions: AskRevision[]): ObjectValues {
  return revisions.reduce<ObjectValues>(({ basic, properties }, revision) => {
    switch (revision.field) {
      case "primary_keys":
        return {
          basic,
          properties: properties.map((property) => ({
            ...property,
            primaryKey: revision.value.includes(property.name),
          })),
        };
      case "display_key":
        return {
          basic,
          properties: properties.map((property) => ({
            ...property,
            displayKey: property.name === revision.value,
          })),
        };
      case "data_property": {
        const { comment, displayName, name } = revision.value;
        return {
          basic,
          properties: properties.map((property) =>
            property.name === name
              ? {
                  ...property,
                  ...(comment !== undefined ? { comment } : {}),
                  ...(displayName !== undefined ? { displayName } : {}),
                }
              : property,
          ),
        };
      }
      default:
        return { basic: withBasic(basic, revision), properties };
    }
  }, values);
}

/** Names as people know them, for a relation's ends: object types, properties and tables. */
export type EndNames = {
  object: (id: string) => string;
  property: (objectTypeId: string, name: string) => string;
  table: (resourceId: string) => string;
};

/** A relation's ends and how they join, in one line. */
export function endsText(t: TFunction, names: EndNames, ends: AskEnds): string {
  if (!ends.source && !ends.target) {
    return "";
  }
  const pair = (source: string, target: string) => t(`${PREFIX}.preview.pair`, { source, target });
  const separator = t(`${PREFIX}.preview.separator`);
  const rules = ends.link
    ? t(`${PREFIX}.preview.link`, {
        rules: [
          ...ends.link.sourceMapping.map((item) =>
            pair(names.property(ends.source, item.sourceProperty), item.targetProperty),
          ),
          ...ends.link.targetMapping.map((item) =>
            pair(item.sourceProperty, names.property(ends.target, item.targetProperty)),
          ),
        ].join(separator),
        table: names.table(ends.link.resourceId),
      })
    : ends.mapping
        .map((item) =>
          pair(
            names.property(ends.source, item.sourceProperty),
            names.property(ends.target, item.targetProperty),
          ),
        )
        .join(separator);
  // An end not chosen yet, as in a relation being made, says so; no mapping, no colon after it.
  const end = (id: string) => (id ? names.object(id) : t(`${PREFIX}.preview.unset`));
  return t(`${PREFIX}.preview.${rules ? "ends" : "endsOnly"}`, {
    rules,
    source: end(ends.source),
    target: end(ends.target),
  });
}

/** How a revision of a relation type reads, its ends against the ends being edited. */
export function relationPreview(
  t: TFunction,
  names: EndNames,
  basic: Basic,
  current: AskEnds,
  revision: AskRevision,
): RevisionPreview {
  if (revision.field === "ends") {
    return {
      after: endsText(t, names, revision.value),
      before: endsText(t, names, current),
      label: t(`${PREFIX}.field.ends`),
    };
  }
  return (
    basicPreview(t, basic, revision) ?? { after: "", before: "", label: t(`${PREFIX}.field.other`) }
  );
}

/** The relation editor's values with the revisions put in, in order. */
export function applyRelationRevisions(
  values: RelationValues,
  revisions: AskRevision[],
  tables: DraftTable[],
): RelationValues {
  return revisions.reduce<RelationValues>((current, revision) => {
    if (revision.field !== "ends") {
      return { ...current, basic: withBasic(current.basic, revision) };
    }
    return { ...current, values: endsEditorValues(revision.value, tables) };
  }, values);
}
