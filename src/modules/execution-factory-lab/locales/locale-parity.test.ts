/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { executionFactoryLabEnUS } from "./en-US";
import { executionFactoryLabZhCN } from "./zh-CN";

// Missing keys silently fall back to English and create mixed-language Chinese UI, so key sets must remain aligned.
describe("execution-factory-lab locale parity", () => {
  const enKeys = Object.keys(executionFactoryLabEnUS.executionFactoryLab).sort();
  const zhKeys = Object.keys(executionFactoryLabZhCN.executionFactoryLab).sort();

  it("has a Chinese entry for every English key", () => {
    expect(enKeys.filter((key) => !zhKeys.includes(key))).toEqual([]);
  });

  it("has no Chinese-only keys", () => {
    expect(zhKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});
