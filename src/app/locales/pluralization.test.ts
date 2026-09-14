/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { enUS } from "@/app/locales/resources/en-US";

const countNounPattern = /\b(?:calls?|candidates?|capabilities?|characters?|connections?|connector types?|endpoints?|facts?|fields?|files?|grants?|interactions?|issues?|mappings?|members?|objects?|object types?|operators?|parameters?|properties?|records?|references?|relation types?|resources?|roles?|rows?|samples?|sources?|subjects?|tables?|tags?|tasks?|tools?)\b/i;

function flattenStrings(value: unknown, prefix = "", result: Record<string, string> = {}) {
  if (typeof value === "string") {
    result[prefix] = value;
    return result;
  }
  if (!value || typeof value !== "object") return result;

  for (const [key, child] of Object.entries(value)) {
    flattenStrings(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function interpolationValues(template: string, count: number) {
  const values: Record<string, string | number> = {
    count,
    formattedCount: String(count),
  };
  for (const match of template.matchAll(/{{\s*(?:-\s*)?([\w]+)\s*}}/g)) {
    const name = match[1];
    if (name && !(name in values)) values[name] = "value";
  }
  return values;
}

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/{{\s*(?:-\s*)?([\w]+)\s*}}/g, (_, name: string) =>
    String(values[name] ?? ""),
  );
}

describe("English count pluralization", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it.each([
    {
      key: "dataCatalog.format.rows",
      one: "1 row",
      other: "2 rows",
      zero: "0 rows",
    },
    {
      key: "executionFactory.toolCountLabel",
      one: "1 tool",
      other: "2 tools",
      zero: "0 tools",
    },
    {
      key: "executionFactory.skillFileCountLabel",
      one: "1 file",
      other: "2 files",
      zero: "0 files",
    },
    {
      key: "bknTrace.businessProvenance.workspace.callCount",
      one: "1 call",
      other: "2 calls",
      zero: "0 calls",
    },
  ])("formats 0/1/2 for $key", async ({ key, one, other, zero }) => {
    await i18n.changeLanguage("en-US");

    expect(i18n.t(key, { count: 0, formattedCount: "0" })).toBe(zero);
    expect(i18n.t(key, { count: 1, formattedCount: "1" })).toBe(one);
    expect(i18n.t(key, { count: 2, formattedCount: "2" })).toBe(other);
  });

  it("selects _one/_other for every English plural resource", async () => {
    const strings = flattenStrings(enUS);
    const pluralKeys = Object.keys(strings)
      .filter((key) => key.endsWith("_one"))
      .map((key) => key.slice(0, -"_one".length));

    await i18n.changeLanguage("en-US");

    for (const key of pluralKeys) {
      const one = strings[`${key}_one`];
      const other = strings[`${key}_other`];
      expect(one, `${key} is missing _one`).toBeTypeOf("string");
      expect(other, `${key} is missing _other`).toBeTypeOf("string");
      if (!one || !other) continue;

      for (const count of [0, 1, 2]) {
        const template = count === 1 ? one : other;
        const values = interpolationValues(template, count);
        expect.soft(i18n.t(key, values), `${key} with count=${count}`).toBe(
          interpolate(template, values),
        );
      }
    }
  });

  it("requires plural resources for user-facing count nouns", () => {
    const strings = flattenStrings(enUS);
    const missingPluralKeys = Object.entries(strings)
      .filter(([key, value]) =>
        !key.endsWith("_one")
        && !key.endsWith("_other")
        && value.includes("{{count}}")
        && countNounPattern.test(value),
      )
      .filter(([key]) => !(strings[`${key}_one`] && strings[`${key}_other`]))
      .map(([key]) => key);

    expect(missingPluralKeys).toEqual([]);
  });

  it("does not use parenthesized pseudo-plurals", () => {
    const pseudoPluralKeys = Object.entries(flattenStrings(enUS))
      .filter(([, value]) =>
        /\b[A-Za-z]+\(s\)/.test(value) && !/https?\(s\)/i.test(value),
      )
      .map(([key]) => key);

    expect(pseudoPluralKeys).toEqual([]);
  });
});
