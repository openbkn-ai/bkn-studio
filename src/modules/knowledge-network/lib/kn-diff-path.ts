/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { KnDiffDefinition, KnDiffResult } from "@/modules/knowledge-network/types/kn-version";

/**
 * A change path as the API writes it, split into what a reader scans.
 *
 * The API writes `data_properties[abbr].display_name`, naming a property by its own name so a
 * reordered table produces no changes. A reader thinks in "数据属性 abbr · 显示名"; the raw path
 * stays available as a tooltip to map a row back to the definition file.
 */
export type ParsedChangePath = {
  /** One data property, one mapping rule, or the definition's own fields. */
  groupKey: string;
  groupLabel: string;
  /** The member inside the group; empty for the definition's own fields. */
  groupMember: string;
  fieldLabel: string;
  raw: string;
};

const SECTIONS = new Set([
  "analysis_dimensions",
  "data_properties",
  "data_source",
  "endpoint",
  "formula",
  "logic_properties",
  "mapping_rules",
  "metric_attributes",
  "parameters",
  "time_dimensions",
]);

const FIELDS = new Set([
  "aggr",
  "description",
  "direction",
  "display_key",
  "display_name",
  "id",
  "incremental_key",
  "mapped_field",
  "name",
  "operation",
  "primary_keys",
  "property",
  "required",
  "scope_ref",
  "scope_type",
  "source",
  "source_property",
  "tags",
  "target",
  "target_property",
  "type",
  "unit",
  "value",
]);

export const SELF_GROUP = "__self__";

/**
 * Paths that differ between any two branches of one network and say nothing about its content,
 * such as the branch a side was read from.
 */
export const BRANCH_ONLY_PATHS = new Set(["branch"]);

function section(name: string, t: TFunction) {
  return SECTIONS.has(name) ? t(`knowledgeNetwork.versions.diff.section.${name}`) : name;
}

function field(name: string, t: TFunction) {
  return FIELDS.has(name) ? t(`knowledgeNetwork.versions.diff.field.${name}`) : name;
}

/** Splits one API path into a group and a field label; an unknown segment is shown as it is. */
export function parseChangePath(raw: string, t: TFunction): ParsedChangePath {
  const indexed = /^([a-z_]+)\[([^\]]+)\](?:\.(.+))?$/.exec(raw);
  if (indexed) {
    const [, name, member, rest] = indexed;
    return {
      fieldLabel: rest
        ? field(rest.split(".").pop() ?? rest, t)
        : t("knowledgeNetwork.versions.diff.field.whole"),
      groupKey: `${name}[${member}]`,
      groupLabel: section(name, t),
      groupMember: member,
      raw,
    };
  }

  const dotted = raw.split(".");
  if (dotted.length > 1 && SECTIONS.has(dotted[0])) {
    return {
      fieldLabel: field(dotted[dotted.length - 1], t),
      groupKey: dotted[0],
      groupLabel: section(dotted[0], t),
      groupMember: "",
      raw,
    };
  }

  return {
    fieldLabel: field(dotted[dotted.length - 1], t),
    groupKey: SELF_GROUP,
    groupLabel: t("knowledgeNetwork.versions.diff.section.basics"),
    groupMember: "",
    raw,
  };
}

/**
 * The definitions a reader needs to look at. Two branches of one network always differ in the
 * branch they were read from; a network entry that differs in nothing else is no change.
 */
export function changedEntries(result: KnDiffResult): KnDiffDefinition[] {
  const listed = result.network?.changes ?? [];
  const changes = listed.filter((change) => !BRANCH_ONLY_PATHS.has(change.path ?? ""));
  const network = result.network ? { ...result.network, changes } : null;
  const keepNetwork =
    network && (network.action !== "update" || changes.length > 0 || listed.length === 0);
  return [...(keepNetwork ? [network] : []), ...(result.entries ?? [])].filter(
    (entry) => entry.action !== "skip",
  );
}
