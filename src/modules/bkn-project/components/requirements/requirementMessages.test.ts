/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { testCheckReasonText } from "@/modules/bkn-project/components/requirements/requirementMessages";

const zh = i18n.getFixedT("zh-CN");
const en = i18n.getFixedT("en-US");

describe("testCheckReasonText", () => {
  it("tells a deleted table from a failed query, never by its code", () => {
    expect(testCheckReasonText(zh, "table_missing")).toBe("要读的数据表已被删除，没能核对");
    expect(testCheckReasonText(en, "table_missing")).toBe(
      "A table it reads has been deleted, so it was not checked",
    );
    expect(testCheckReasonText(zh, "query_failed: vega-backend 500")).toBe("查询数据没有成功");
    expect(testCheckReasonText(zh, "something_new")).toBe("没有通过核对");
  });
});
