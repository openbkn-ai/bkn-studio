/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import { logicKindText } from "@/modules/bkn-project/components/kinetic/kineticMessages";
import type {
  AskItemKind,
  Proposal,
  ProposalItem,
} from "@/modules/bkn-project/types/conversations";

const PREFIX = "bknProject.ask.proposal";

/** Names what items refer to by id; one no longer in the list reads as empty. */
export type AskNames = {
  logicNeed: (id: string) => string;
  objectType: (id: string) => string;
  scenario: (id: string) => string;
};

/** A proposal as the person reads it: what it does, to what, from what to what, and why. */
export type ProposalView = {
  after: string;
  /** The suggested value is something the network already has, marked as such. */
  afterInNetwork: boolean;
  before: string;
  detail: string;
  label: string;
  op: string;
};

/** The fields a change can touch, in the order they are read. */
const FIELDS = [
  "name",
  "text",
  "statement",
  "logicKind",
  "definition",
  "objectTypeIds",
  "actor",
  "trigger",
  "decision",
  "knowledge",
  "scenarioIds",
  "logicNeedIds",
] as const;

type Field = (typeof FIELDS)[number];

/** The field that names an item of a kind. */
const NAME_FIELD: Record<AskItemKind, "name" | "statement" | "text"> = {
  logic_needs: "name",
  questions: "text",
  rules: "statement",
  scenarios: "name",
};

function fieldValue(t: TFunction, names: AskNames, item: ProposalItem, field: Field): string {
  const separator = t("bknProject.listSeparator");
  const listed = (ids: string[] | undefined, name: (id: string) => string) =>
    (ids ?? []).map((id) => name(id) || t(`${PREFIX}.gone`)).join(separator);
  switch (field) {
    case "logicKind":
      return item.logicKind ? logicKindText(t, item.logicKind) : "";
    case "objectTypeIds":
      return listed(item.objectTypeIds, names.objectType);
    case "scenarioIds":
      return listed(item.scenarioIds, names.scenario);
    case "logicNeedIds":
      return listed(item.logicNeedIds, names.logicNeed);
    case "knowledge":
      return (item.knowledge ?? []).join(separator);
    default:
      return item[field] ?? "";
  }
}

/** The fields an item gives, besides its name unless asked for. */
const given = (item: ProposalItem | null, kind: AskItemKind, withName: boolean) =>
  item
    ? FIELDS.filter(
        (field) => item[field] !== undefined && (withName || field !== NAME_FIELD[kind]),
      )
    : [];

/** "Field: value; field: value", empty values left out. */
function summary(
  t: TFunction,
  names: AskNames,
  item: ProposalItem | null,
  fields: readonly Field[],
): string {
  if (!item) {
    return "";
  }
  return fields
    .map((field) => ({ field, value: fieldValue(t, names, item, field) }))
    .filter(({ value }) => value)
    .map(({ field, value }) =>
      t(`${PREFIX}.fieldValue`, { field: t(`${PREFIX}.field.${field}`), value }),
    )
    .join(t(`${PREFIX}.fieldSeparator`));
}

/** An item's name as its kind names it. */
const itemName = (kind: AskItemKind, item: ProposalItem | null) =>
  (item && item[NAME_FIELD[kind]]) || "";

/** "Metric “Line load”", "Scenario “Re-plan after a stop”". */
function itemLabel(t: TFunction, kind: AskItemKind, item: ProposalItem | null): string {
  const name = itemName(kind, item);
  return kind === "logic_needs" && item?.logicKind
    ? t(`${PREFIX}.item.logicNeedOfKind`, { kind: logicKindText(t, item.logicKind), name })
    : t(`${PREFIX}.item.${kind}`, { name });
}

/** Words a proposal against the items as they were when it was asked. */
export function proposalView(t: TFunction, names: AskNames, proposal: Proposal): ProposalView {
  const { before, item, kind } = proposal;
  const op = t(`${PREFIX}.op.${proposal.op}`);
  const view: ProposalView = {
    after: "",
    afterInNetwork: false,
    before: "",
    detail: "",
    label: "",
    op,
  };
  switch (proposal.op) {
    case "add":
      return {
        ...view,
        detail: summary(t, names, item, given(item, kind, false)),
        label: itemLabel(t, kind, item),
      };
    case "modify": {
      const fields = given(item, kind, true);
      const beforeName = itemName(kind, before);
      // One field changed reads as that field's change; several, as each field's.
      if (fields.length === 1 && item) {
        return {
          ...view,
          after: fieldValue(t, names, item, fields[0]),
          before: before ? fieldValue(t, names, before, fields[0]) : "",
          label: t(`${PREFIX}.fieldOf`, {
            field: t(`${PREFIX}.field.${fields[0]}`),
            name: beforeName,
          }),
        };
      }
      return {
        ...view,
        after: summary(t, names, item, fields),
        before: summary(t, names, before, fields),
        label: itemLabel(t, kind, before),
      };
    }
    case "merge": {
      const from = itemName(kind, before);
      const into = itemName(kind, proposal.intoBefore);
      return {
        ...view,
        after: itemName(kind, item) || into,
        before: [from, into].filter(Boolean).join(t("bknProject.listSeparator")),
        detail: summary(t, names, item, given(item, kind, false)),
        label: t(`${PREFIX}.mergeLabel`, { from, into }),
      };
    }
    case "delete":
      return {
        ...view,
        detail: summary(t, names, before, given(before, kind, false)),
        label: itemLabel(t, kind, before),
      };
    case "link":
      return {
        ...view,
        after: proposal.networkItem?.name ?? "",
        afterInNetwork: true,
        label: t(`${PREFIX}.linkLabel`, { name: itemName(kind, before) }),
      };
    case "split":
      return {
        ...view,
        after: proposal.parts
          .map((part) => itemName(kind, part))
          .filter(Boolean)
          .join(t(`${PREFIX}.fieldSeparator`)),
        before: itemName(kind, before),
        label: t(`${PREFIX}.splitLabel`, {
          count: proposal.parts.length,
          name: itemName(kind, before),
        }),
      };
  }
}

/**
 * The item a proposal changed once adopted, to show it on the page: the one made, the one kept,
 * or the one changed. Nothing for a deletion.
 */
export function changedItem(proposal: Proposal): { id: string; kind: AskItemKind } | null {
  const id =
    proposal.op === "delete"
      ? ""
      : proposal.op === "add"
        ? proposal.resultId
        : proposal.op === "merge"
          ? proposal.intoId
          : proposal.targetId;
  return id ? { id, kind: proposal.kind } : null;
}
