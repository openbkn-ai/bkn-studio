/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/*
 * Aliases are an item's other names, which agents search and understand it by: abbreviations,
 * former names, names in another language. They are checked as BKN checks them, here before
 * saving and again by bkn-project, which also checks them against the other items' names.
 */

export const ALIASES_PREFIX = "bknProject.aliases";
const PREFIX = ALIASES_PREFIX;

export const ALIASES_MAX = 10;
export const ALIAS_MAX_LENGTH = 40;

/** The reasons bkn-project gives for refusing an alias, each said in business words. */
const REASONS = new Set([
  "too_many",
  "too_long",
  "comma",
  "repeated",
  "own_name",
  "other_name",
  "alias_of_other",
  "document_item",
]);

/** Aliases as saving sends them: trimmed, without empty ones. */
export function cleanAliases(aliases: readonly string[] | undefined): string[] {
  return (aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
}

/** What is wrong with the aliases of an item named `own`, or null when nothing is. */
export function aliasProblem(
  t: TFunction,
  aliases: readonly string[] | undefined,
  own: readonly string[],
): string | null {
  const cleaned = cleanAliases(aliases);
  if (cleaned.length > ALIASES_MAX) {
    return t(`${PREFIX}.too_many`, { max: ALIASES_MAX });
  }
  const seen = new Set<string>();
  for (const alias of cleaned) {
    if ([...alias].length > ALIAS_MAX_LENGTH) {
      return t(`${PREFIX}.too_long`, { alias, max: ALIAS_MAX_LENGTH });
    }
    if (/[,，]/.test(alias)) {
      return t(`${PREFIX}.comma`, { alias });
    }
    if (seen.has(alias)) {
      return t(`${PREFIX}.repeated`, { alias });
    }
    if (own.map((name) => name.trim()).includes(alias)) {
      return t(`${PREFIX}.own_name`, { alias });
    }
    seen.add(alias);
  }
  return null;
}

/** What bkn-project's refusal of an alias says, from its error details. */
export function aliasRefusalText(t: TFunction, details: unknown): string {
  const { alias, other, reason } = (details ?? {}) as {
    alias?: string;
    other?: string;
    reason?: string;
  };
  return reason && REASONS.has(reason)
    ? t(`${PREFIX}.${reason}`, { alias: alias ?? "", max: ALIASES_MAX, other: other ?? "" })
    : t(`${PREFIX}.other`);
}
