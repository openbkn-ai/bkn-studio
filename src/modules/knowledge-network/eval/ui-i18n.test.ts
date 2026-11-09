/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { beforeEach, expect, it } from "vitest";
import { caseUiResources } from "./locales/case-ui";
import { workspaceUiResources } from "./locales/workspace-ui";
import { caseUiText } from "./case-ui-text";
import { workspaceUi } from "./workspace-ui-text";

beforeEach(async () => {
  await i18n.init({ lng: "zh-CN", resources: {}, interpolation: { escapeValue: false } });
});

it("keeps both UI catalogues and their interpolation fields in parity", () => {
  for (const resources of [caseUiResources, workspaceUiResources]) {
    const zh: Record<string, string> = resources["zh-CN"];
    const en: Record<string, string> = resources["en-US"];
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const key of Object.keys(zh)) {
      const tokens = (value: string) => [...value.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
      expect(tokens(en[key]), key).toEqual(tokens(zh[key]));
    }
  }
});

it("switches mounted form and workspace copy and recovers from a host resource reset", async () => {
  expect(caseUiText("enterAJsonObject")).toBe("请输入 JSON 对象");
  expect(workspaceUi("runNumber", { number: 2 })).toBe("运行 2");
  await i18n.changeLanguage("en-US");
  expect(caseUiText("enterAJsonObject")).toBe("Enter a JSON object");
  expect(workspaceUi("runNumber", { number: 2 })).toBe("Run 2");
  await i18n.init({ lng: "en-US", resources: {} });
  expect(caseUiText("enterAJsonObject")).toBe("Enter a JSON object");
  expect(workspaceUi("runNumber", { number: 3 })).toBe("Run 3");
});

it("formats zero, one and multiple cases without relying on host namespace state", async () => {
  await i18n.changeLanguage("en-US");
  for (const count of [0, 1, 2]) {
    expect(workspaceUi("cases", { count })).toBe(count === 1 ? "case" : "cases");
    expect(caseUiText("unreadableTargetDeclarations", { count })).toBe(
      count === 1
        ? "1 target declaration could not be parsed."
        : `${count} target declarations could not be parsed.`,
    );
  }
  i18n.removeResourceBundle("en-US", "evalCaseUi");
  expect(caseUiText("unreadableTargetDeclarations", { count: 1 })).toBe(
    "1 target declaration could not be parsed.",
  );
});

it("leaves React-rendered schedule values readable when the host escapes interpolation", async () => {
  await i18n.init({ lng: "zh-CN", resources: {}, interpolation: { escapeValue: true } });
  const value = "09:00（Asia/Shanghai）";
  expect(workspaceUi("everyDayAt", { value0: value })).toBe(`每天 ${value}`);
  await i18n.changeLanguage("en-US");
  expect(workspaceUi("everyDayAt", { value0: value })).toBe(`Every day at ${value}`);
});
