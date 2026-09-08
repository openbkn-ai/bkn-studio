/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/**
 * A change path as the API writes it, split into something a reader can scan.
 *
 * The API writes `data_properties[abbr].display_name`, which names the property by its own name so
 * a reordered table produces no changes. That is right for the contract and wrong for a page: the
 * reader thinks in "数据属性 abbr · 显示名", not in a field path. The raw path stays available so a
 * developer can still map a row back to the exported file.
 */
export type ParsedChangePath = {
  /** Group the change belongs to, e.g. a single data property or the definition's own fields. */
  groupKey: string;
  groupLabel: string;
  /** The member inside that group, empty for the definition's own fields. */
  groupMember: string;
  /** Field label inside the group. */
  fieldLabel: string;
  raw: string;
};

const SECTION_KEYS: Record<string, string> = {
  analysis_dimensions: "diffSection_analysisDimensions",
  data_properties: "diffSection_dataProperties",
  data_source: "diffSection_dataSource",
  endpoint: "diffSection_endpoint",
  formula: "diffSection_formula",
  logic_properties: "diffSection_logicProperties",
  mapping_rules: "diffSection_mappingRules",
  metric_attributes: "diffSection_metricAttributes",
  parameters: "diffSection_parameters",
  time_dimensions: "diffSection_timeDimensions",
};

const FIELD_KEYS: Record<string, string> = {
  aggr: "diffField_aggr",
  branch: "diffField_branch",
  description: "diffField_description",
  direction: "diffField_direction",
  display_key: "diffField_displayKey",
  display_name: "diffField_displayName",
  id: "diffField_id",
  incremental_key: "diffField_incrementalKey",
  mapped_field: "diffField_mappedField",
  name: "diffField_name",
  operation: "diffField_operation",
  primary_keys: "diffField_primaryKeys",
  property: "diffField_property",
  scope_ref: "diffField_scopeRef",
  scope_type: "diffField_scopeType",
  source: "diffField_source",
  source_property: "diffField_sourceProperty",
  tags: "diffField_tags",
  target: "diffField_target",
  target_property: "diffField_targetProperty",
  type: "diffField_type",
  unit: "diffField_unit",
  value: "diffField_value",
  version: "diffField_version",
};

function translateSegment(segment: string, table: Record<string, string>, t: TFunction) {
  const key = table[segment];
  return key ? t(`knowledgeNetwork.${key}`) : segment;
}

/**
 * parseChangePath turns one API path into a group and a field label.
 *
 * Anything the tables above do not name falls back to the raw segment rather than being dropped:
 * a field nobody translated yet must still show up, spelled the way the API spells it.
 */
export function parseChangePath(raw: string, t: TFunction): ParsedChangePath {
  const basics = {
    groupKey: "__self__",
    groupLabel: t("knowledgeNetwork.diffSection_basics"),
    groupMember: "",
    raw,
  };

  const indexed = /^([a-z_]+)\[([^\]]+)\](?:\.(.+))?$/.exec(raw);
  if (indexed) {
    const [, section, member, rest] = indexed;
    return {
      fieldLabel: rest
        ? translateSegment(rest.split(".").pop() ?? rest, FIELD_KEYS, t)
        : t("knowledgeNetwork.diffField_whole"),
      groupKey: `${section}[${member}]`,
      groupLabel: translateSegment(section, SECTION_KEYS, t),
      groupMember: member,
      raw,
    };
  }

  const dotted = raw.split(".");
  if (dotted.length > 1 && SECTION_KEYS[dotted[0]]) {
    return {
      fieldLabel: translateSegment(dotted[dotted.length - 1], FIELD_KEYS, t),
      groupKey: dotted[0],
      groupLabel: translateSegment(dotted[0], SECTION_KEYS, t),
      groupMember: "",
      raw,
    };
  }

  return { ...basics, fieldLabel: translateSegment(dotted[dotted.length - 1], FIELD_KEYS, t) };
}
