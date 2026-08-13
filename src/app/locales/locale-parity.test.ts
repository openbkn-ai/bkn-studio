/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { enUS } from "@/app/locales/resources/en-US";
import { zhCN } from "@/app/locales/resources/zh-CN";

describe("app locale parity", () => {
  const enKeys = flattenLocaleKeys(enUS);
  const zhKeys = flattenLocaleKeys(zhCN);

  it("has a Chinese translation entry for every English key", () => {
    expect(difference(enKeys, zhKeys)).toEqual([]);
  });

  it("has no Chinese-only translation keys", () => {
    expect(difference(zhKeys, enKeys)).toEqual([]);
  });

  it("names the system management entry as audit logs", () => {
    expect(zhCN.shell.items.logManagement).toBe("审计日志");
    expect(enUS.shell.items.logManagement).toBe("Audit Logs");
  });
});

function flattenLocaleKeys(value: unknown, prefix = ""): string[] {
  if (!isRecord(value)) {
    return [prefix];
  }

  return Object.keys(value)
    .sort()
    .flatMap((key) => flattenLocaleKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

function difference(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((key) => !rightSet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
