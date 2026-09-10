/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

import { getSemanticUnderstandingWarnings } from "./semantic-understanding-warnings";

describe("semantic-understanding warnings", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("localizes policy omissions and keeps backend warnings", async () => {
    await i18n.changeLanguage("zh-CN");
    const payload = JSON.stringify({
      warning_details: [{
        code: "sample_omitted_by_policy",
        params: { field_name: "attachment_blob", field_type: "binary" },
      }],
      warnings: [
        "字段 note 确实没有可用样本",
      ],
    });

    expect(getSemanticUnderstandingWarnings(i18n.t, payload)).toEqual([
      "字段 attachment_blob 为二进制类型，样本值已按安全规则省略。系统理解该字段时仅依据字段名称、类型及已有描述等元数据；如生成相关判断，其置信度可能低于有样本值时。",
      "字段 note 确实没有可用样本",
    ]);
  });

  it("renders the structured warning in English", async () => {
    await i18n.changeLanguage("en-US");
    const payload = JSON.stringify({
      warning_details: [{
        code: "sample_omitted_by_policy",
        params: { field_name: "attachment_blob", field_type: "binary" },
      }],
    });

    expect(getSemanticUnderstandingWarnings(i18n.t, payload)).toEqual([
      "The attachment_blob field has the binary type. Its sample values were omitted by the safety policy. When interpreting this field, the system relies only on metadata such as the field name, type, and existing descriptions; any resulting judgment may have lower confidence than one supported by sample values.",
    ]);
  });

  it("keeps free-text warnings from legacy tasks", () => {
    const payload = JSON.stringify({ warnings: ["legacy warning"] });

    expect(getSemanticUnderstandingWarnings(i18n.t, payload)).toEqual(["legacy warning"]);
  });

  it("keeps metadata evidence warnings for policy-omitted fields", () => {
    const warning = "字段 attachment_blob 的样本已按策略省略，但现有元数据证据不足，未生成语义建议";
    const payload = JSON.stringify({
      warning_details: [{
        code: "sample_omitted_by_policy",
        params: { field_name: "attachment_blob", field_type: "binary" },
      }],
      warnings: [warning],
    });

    expect(getSemanticUnderstandingWarnings(i18n.t, payload)).toContain(warning);
  });
});
