/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { propertyAuthorizationPart as enUS } from "./en-US/property-authorization";
import { propertyAuthorizationPart as zhCN } from "./zh-CN/property-authorization";

describe("property authorization terminology", () => {
  it("uses Column Masking consistently in the permission selector and rule editor", () => {
    expect(zhCN.propertyAuthorizationLevel.masked).toBe("列掩码");
    expect(zhCN.objectTypeMaskRuleTitle).toBe("列掩码规则");
    expect(zhCN.propertyAuthorizationMaskedMissing).toContain("列掩码");
    expect(JSON.stringify(zhCN)).not.toContain("脱敏");

    expect(enUS.propertyAuthorizationLevel.masked).toBe("Column Masking");
    expect(enUS.objectTypeMaskRuleTitle).toBe("Column Masking Rule");
    expect(enUS.propertyAuthorizationMaskedMissing).toContain("Column Masking");
  });

  it("uses the same subject boundary on property access and row filtering", () => {
    expect(zhCN.propertyAuthorizationSubjectDescription).toBe("选择要配置的用户或角色。");
    expect(zhCN.rowFilterSubjectDescription).toBe("选择要配置的用户或角色。");
    expect(zhCN.propertyAuthorizationSubjectHelp).toContain("组织仅用于筛选用户列表");
    expect(zhCN.rowFilterSubjectHelp).toContain("组织仅用于筛选用户列表");
    expect(zhCN.rowFilterSourcesTitle).toBe("生效策略");

    expect(enUS.propertyAuthorizationSubjectDescription).toBe(
      "Choose the user or role to configure.",
    );
    expect(enUS.rowFilterSubjectDescription).toBe("Choose the user or role to configure.");
    expect(enUS.rowFilterSourcesTitle).toBe("Effective policy");
  });
});
