/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const VEGA_TAG_MAX_LENGTH = 40;
export const VEGA_TAGS_MAX_NUMBER = 5;

const INVALID_CHARACTERS = new Set([
  "/",
  ":",
  "?",
  "\\",
  '"',
  "<",
  ">",
  "|",
  "：",
  "？",
  "‘",
  "’",
  "“",
  "”",
  "！",
  "《",
  "》",
  ",",
  "#",
  "[",
  "]",
  "{",
  "}",
  "%",
  "&",
  "*",
  "$",
  "^",
  "!",
  "=",
  ".",
  "'",
]);

export type VegaTagError = "count" | "empty" | "length" | "characters";

export function normalizeVegaTag(tag: string): string {
  return tag.trim();
}

export function validateVegaTag(tag: string): Exclude<VegaTagError, "count"> | null {
  const normalized = normalizeVegaTag(tag);
  if (!normalized) return "empty";
  if (Array.from(normalized).length > VEGA_TAG_MAX_LENGTH) return "length";
  if (Array.from(normalized).some((character) => INVALID_CHARACTERS.has(character))) {
    return "characters";
  }
  return null;
}

export function validateVegaTags(tags: string[]): VegaTagError | null {
  if (tags.length > VEGA_TAGS_MAX_NUMBER) return "count";
  for (const tag of tags) {
    const error = validateVegaTag(tag);
    if (error) return error;
  }
  return null;
}
