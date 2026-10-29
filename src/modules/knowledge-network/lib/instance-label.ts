/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * How an instance is named and identified wherever instances are drawn: the id ontology-query
 * gives it, a stable key for its identity, and the label shown for it. The graph overview and
 * the enterprise graph explorer both use these, so an instance handed from one to the other is
 * the same instance under the same name.
 */

const SYSTEM_PREFIX = "_";
const DISPLAY = "_display";

export type Rec = Record<string, unknown>;

/** Renders any property value as text without ever falling back to "[object Object]". */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return String(value);
  if (typeof value === "symbol") return value.description ?? "";
  if (typeof value === "function") return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return Object.prototype.toString.call(value);
  }
}

const asString = stringifyValue;

function nonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && asString(value).trim() !== "";
}

/**
 * Mirrors ontology-query `logics.GetObjectID`: `<ot_id>-<pk values joined by "_">`,
 * a missing key written as `__NULL__`. Returns null when the object type has no primary key,
 * because there is then no identity the backend would recognise either.
 */
export function buildInstanceId(otId: string, primaryKeys: string[], identity: Rec): string | null {
  if (!otId || primaryKeys.length === 0) return null;
  const parts = primaryKeys.map((pk) =>
    pk in identity && identity[pk] !== undefined ? asString(identity[pk]) : "__NULL__",
  );
  return `${otId}-${parts.join("_")}`;
}

/**
 * A stable key for an instance's identity, or null when a primary key value is missing: such an
 * instance cannot be named in a query. Unlike an instance id it does not misread a composite key:
 * ids join the values with "_", which a value may contain too, while this uses a control character.
 * Seeds are matched back to their rows through this key rather than through a rebuilt id, so a
 * seed keeps the id it already has on the canvas.
 */
export function identityKey(primaryKeys: readonly string[], identity: Rec): string | null {
  if (primaryKeys.length === 0) return null;
  const parts: string[] = [];
  for (const pk of primaryKeys) {
    const value = identity[pk];
    if (value === null || value === undefined) return null;
    parts.push(stringifyValue(value));
  }
  return parts.join("\u001f");
}

/**
 * Label resolution chain: an explicit label property first, then
 * `_display` → `display_name` → `name` → `title` → `topic` → `description` → `text_clean`
 * → `text` → `id` → first non-system property → node id.
 *
 * `topic` sits with the titles: rows such as benchmark items carry no name, and their topic is
 * the short heading while the description is a sentence or more.
 *
 * `text_clean` comes before `text` because a network that carries both keeps the tidied wording
 * in the former and the raw extraction, markup and all, in the latter. Names are matched without
 * regard to case, since one network writes `Title` where another writes `title`.
 */
export const LABEL_CHAIN = [
  DISPLAY,
  "display_name",
  "name",
  "title",
  "topic",
  "description",
  "text_clean",
  "text",
  "id",
];

const TEMPLATE_SLOT = /\{([^{}]+)\}/g;
/** Separators left dangling at either end once empty slots drop out. */
const DANGLING_EDGE = /^[ \t,，;；、:：·|/-]+|[ \t,，;；、:：·|/-]+$/g;

/** A label setting is a template when it holds at least one `{property}` slot. */
export function isLabelTemplate(labelKey: string): boolean {
  return /\{[^{}]+\}/.test(labelKey);
}

/** Brackets a filled slot while the template text around it is tidied. */
const MARK = "\uE000";
const MARKER = /\uE000(\d+)\uE000/g;

/** The slot that stands for the node's object type name rather than a property. */
export const TYPE_SLOT = "$type";

/** The property names a label template refers to, in order; the type slot is left out. */
export function templateProperties(template: string): string[] {
  return [...template.matchAll(TEMPLATE_SLOT)]
    .map((match) => match[1].trim())
    .filter((name) => name !== TYPE_SLOT);
}

/** Tidies one line once empty slots dropped out: empty brackets, doubled and dangling separators. */
function tidyLine(line: string): string {
  return line
    .replace(/[(（[]\s*[)）\]]/g, "")
    .replace(/([,，;；、|/·])(\s*[,，;；、|/·])+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(DANGLING_EDGE, "");
}

/**
 * Fills a label template such as `{family_name}, {given_name}` from a node's properties.
 * `{$type}` is the object type name. Names match exactly first, then case-insensitively.
 * Line breaks are kept; a line left empty is dropped. Returns null when every property slot is
 * empty, so the caller can fall back to the default label. A template with no property slot
 * (text and `{$type}` only) always fills.
 */
export function renderLabelTemplate(template: string, props: Rec, otName = ""): string | null {
  let filled = false;
  const values: string[] = [];
  // Slots become private-use markers while the template text is tidied, so a value that
  // starts or ends with a separator ("-5", "A/") is never trimmed.
  const marked = template.replace(TEMPLATE_SLOT, (_, raw: string) => {
    const name = raw.trim();
    let value: unknown;
    if (name === TYPE_SLOT) value = otName;
    else {
      value = props[name];
      if (!nonEmpty(value)) {
        const lower = name.toLowerCase();
        const key = Object.keys(props).find((candidate) => candidate.toLowerCase() === lower);
        value = key === undefined ? undefined : props[key];
      }
      if (nonEmpty(value)) filled = true;
    }
    if (!nonEmpty(value)) return "";
    values.push(asString(value));
    return `${MARK}${values.length - 1}${MARK}`;
  });
  if (!filled && templateProperties(template).length > 0) return null;
  const lines = marked
    .split(/\r?\n/)
    .map(tidyLine)
    .filter((line) => line !== "")
    .map((line) => line.replace(MARKER, (_, index: string) => values[Number(index)]));
  return lines.length === 0 ? null : lines.join("\n");
}

export function pickDisplay(
  props: Rec,
  nodeId: string,
  labelKey?: string,
  otName?: string,
): string {
  if (labelKey && isLabelTemplate(labelKey)) {
    const rendered = renderLabelTemplate(labelKey, props, otName);
    if (rendered !== null) return rendered;
    labelKey = undefined;
  }
  if (labelKey && nonEmpty(props[labelKey])) return asString(props[labelKey]);
  // Property name in lower case → its value, keeping the first spelling the row happens to carry.
  const byLowerName = new Map<string, unknown>();
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (!byLowerName.has(lower) || !nonEmpty(byLowerName.get(lower))) byLowerName.set(lower, value);
  }
  if (labelKey && nonEmpty(byLowerName.get(labelKey.toLowerCase())))
    return asString(byLowerName.get(labelKey.toLowerCase()));
  for (const key of LABEL_CHAIN) {
    const value = byLowerName.get(key);
    if (nonEmpty(value)) return asString(value);
  }
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith(SYSTEM_PREFIX) && nonEmpty(value)) return asString(value);
  }
  return nodeId;
}
