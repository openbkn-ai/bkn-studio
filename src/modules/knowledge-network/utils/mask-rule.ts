/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeMaskRule,
} from "@/modules/knowledge-network/types/knowledge-network";

export type ObjectTypeMaskRuleKind = ObjectTypeMaskRule["kind"];

const TYPE_ALIASES: Record<string, string> = {
  bigint: "integer",
  char: "string",
  double: "float",
  int: "integer",
  number: "float",
  numeric: "decimal",
  real: "float",
  smallint: "integer",
  tinyint: "integer",
  varchar: "string",
};

const STRING_TYPES = new Set(["string", "text", "keyword"]);
const NUMBER_TYPES = new Set(["integer", "unsigned integer", "float", "decimal"]);

const GRANULARITIES_BY_TYPE: Record<string, Array<"year" | "month" | "day" | "hour">> = {
  date: ["year", "month"],
  time: ["hour"],
  datetime: ["year", "month", "day", "hour"],
  timestamp: ["year", "month", "day", "hour"],
};

function normalizePropertyType(type?: string) {
  const normalized = type?.trim().toLowerCase() ?? "";
  return TYPE_ALIASES[normalized] ?? normalized;
}

export function maskRuleKindsForPropertyType(type?: string): ObjectTypeMaskRuleKind[] {
  const normalizedType = normalizePropertyType(type);
  if (STRING_TYPES.has(normalizedType)) {
    return ["fixed", "partial", "email"];
  }
  if (NUMBER_TYPES.has(normalizedType)) {
    return ["round"];
  }
  if (GRANULARITIES_BY_TYPE[normalizedType]) {
    return ["date_granularity"];
  }
  return [];
}

export function maskGranularitiesForPropertyType(
  type?: string,
): Array<"year" | "month" | "day" | "hour"> {
  return GRANULARITIES_BY_TYPE[normalizePropertyType(type)] ?? [];
}

export function createDefaultMaskRule(kind: ObjectTypeMaskRuleKind): ObjectTypeMaskRule {
  switch (kind) {
    case "fixed":
      return { kind, replacement: "******" };
    case "partial":
      return { keepEnd: 4, keepStart: 3, kind, replacement: "*" };
    case "email":
      return { kind, localKeepStart: 1, preserveDomain: true, replacement: "*" };
    case "round":
      return { kind, step: 1000 };
    case "date_granularity":
      return { granularity: "year", kind };
  }
}

function validReplacement(value: string) {
  const codePoints = Array.from(value);
  return (
    codePoints.length >= 1 &&
    codePoints.length <= 8 &&
    codePoints.every((character) => !/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u.test(character))
  );
}

function validKeep(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 64;
}

export function isMaskRuleValid(type: string | undefined, rule?: ObjectTypeMaskRule): boolean {
  if (!type || !rule || !maskRuleKindsForPropertyType(type).includes(rule.kind)) {
    return false;
  }
  switch (rule.kind) {
    case "fixed":
      return validReplacement(rule.replacement);
    case "partial":
      return (
        validReplacement(rule.replacement) &&
        validKeep(rule.keepStart) &&
        validKeep(rule.keepEnd)
      );
    case "email":
      return validReplacement(rule.replacement) && validKeep(rule.localKeepStart);
    case "round":
      return Number.isFinite(rule.step) && rule.step > 0;
    case "date_granularity":
      return maskGranularitiesForPropertyType(type).includes(rule.granularity);
  }
}

export function defaultMaskPreviewInput(
  type?: string,
  ruleKind?: ObjectTypeMaskRuleKind,
): string {
  const normalizedType = normalizePropertyType(type);
  if (ruleKind === "email") {
    return "zhangsan@example.com";
  }
  if (NUMBER_TYPES.has(normalizedType)) {
    return "123456";
  }
  if (normalizedType === "date") {
    return "1990-03-18";
  }
  if (normalizedType === "time") {
    return "14:36:48";
  }
  if (normalizedType === "datetime" || normalizedType === "timestamp") {
    return "1990-03-18T14:36:48+08:00";
  }
  return "13812345678";
}

function partialMask(input: string, keepStart: number, keepEnd: number, replacement: string) {
  const codePoints = Array.from(input);
  if (!codePoints.length) {
    return replacement;
  }
  const start = Math.min(keepStart, codePoints.length - 1);
  const end = Math.min(keepEnd, codePoints.length - start - 1);
  const maskedCount = codePoints.length - start - end;
  return `${codePoints.slice(0, start).join("")}${replacement.repeat(maskedCount)}${
    end ? codePoints.slice(-end).join("") : ""
  }`;
}

function emailMask(
  input: string,
  keepStart: number,
  preserveDomain: boolean,
  replacement: string,
) {
  const at = input.lastIndexOf("@");
  if (
    at <= 0 ||
    at === input.length - 1 ||
    input.slice(0, at).includes("@") ||
    /\s/.test(input)
  ) {
    return replacement;
  }
  const local = Array.from(input.slice(0, at));
  const start = Math.min(keepStart, local.length - 1);
  const masked = `${local.slice(0, start).join("")}${replacement.repeat(local.length - start)}`;
  return preserveDomain ? `${masked}${input.slice(at)}` : masked;
}

function dateMask(input: string, granularity: "year" | "month" | "day" | "hour") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month] = input.split("-");
    if (granularity === "year") {
      return `${year}-01-01`;
    }
    if (granularity === "month") {
      return `${year}-${month}-01`;
    }
    return input;
  }
  if (/^\d{2}:\d{2}:\d{2}/.test(input) && granularity === "hour") {
    return `${input.slice(0, 2)}:00:00${input.slice(8)}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})([T ])(\d{2})(.*)$/.exec(input);
  if (!match) {
    return "—";
  }
  const [, year, month, day, separator, hour, suffix] = match;
  const nextMonth = granularity === "year" ? "01" : month;
  const nextDay = granularity === "year" || granularity === "month" ? "01" : day;
  const nextHour = granularity === "hour" ? hour : "00";
  return `${year}-${nextMonth}-${nextDay}${separator}${nextHour}${suffix.replace(/^:\d{2}:\d{2}/, ":00:00")}`;
}

export function previewMaskRule(
  type: string | undefined,
  rule: ObjectTypeMaskRule | undefined,
  input: string,
): string {
  if (!isMaskRuleValid(type, rule) || !rule) {
    return "—";
  }
  switch (rule.kind) {
    case "fixed":
      return rule.replacement;
    case "partial":
      return partialMask(input, rule.keepStart, rule.keepEnd, rule.replacement);
    case "email":
      return emailMask(input, rule.localKeepStart, rule.preserveDomain, rule.replacement);
    case "round": {
      const value = Number(input);
      return Number.isFinite(value) ? String(Math.floor(value / rule.step) * rule.step) : "—";
    }
    case "date_granularity":
      return dateMask(input, rule.granularity);
  }
}
