/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  resolveStatusChangeOkTextKey,
  resolveToolStatusOkTextKey,
} from "@/modules/execution-factory/utils/status-confirm-ok-text";

const en = i18n.getFixedT("en-US");
const zh = i18n.getFixedT("zh-CN");

describe("status-change confirmation OK labels (#491)", () => {
  it.each([
    ["published", "Publish", "发布"],
    ["offline", "Unpublish", "取消发布"],
    // No single action fits these, so the button falls back to a generic Confirm.
    ["unpublish", "Confirm", "确认"],
    ["editing", "Confirm", "确认"],
  ])("labels a change to %s as %s / %s", (status, enLabel, zhLabel) => {
    const key = resolveStatusChangeOkTextKey(status);

    expect(en(key)).toBe(enLabel);
    expect(zh(key)).toBe(zhLabel);
  });

  it.each([
    ["enabled", "Enable", "启用"],
    ["disabled", "Disable", "禁用"],
  ] as const)("labels a tool change to %s as %s / %s", (status, enLabel, zhLabel) => {
    const key = resolveToolStatusOkTextKey(status);

    expect(en(key)).toBe(enLabel);
    expect(zh(key)).toBe(zhLabel);
  });

  it("never falls back to Save, which these dialogs do not do", () => {
    const keys = [
      ...["published", "offline", "unpublish", "editing", ""].map(resolveStatusChangeOkTextKey),
      ...(["enabled", "disabled"] as const).map(resolveToolStatusOkTextKey),
    ];

    for (const key of keys) {
      expect(en(key)).not.toBe(en("common.save"));
      expect(zh(key)).not.toBe(zh("common.save"));
    }
  });
});
