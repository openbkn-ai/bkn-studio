/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  blockedText,
  buildOutcomeText,
  CHECK_STATUSES,
  checkReasonText,
  definitionIds,
  indexStateText,
  KNOWN_REFUSALS,
  listText,
  missingFieldsText,
  pendingBecauseText,
  refusalText,
  understandingMinutesLeft,
} from "@/modules/bkn-project/components/publish/messages";
import type { IndexItem } from "@/modules/bkn-project/types/publish";

const zh = i18n.getFixedT("zh-CN");
const en = i18n.getFixedT("en-US");

function refusal(code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: `raw ${code}`, error_code: code, error_details: details },
    status: 409,
  } as AxiosResponse);
}

const indexItem = (overrides: Partial<IndexItem>): IndexItem => ({
  build: null,
  id: "orders",
  missing: [],
  name: "Orders",
  state: "ready",
  table: { catalogId: "c", name: "orders", resourceId: "r" },
  task: null,
  ...overrides,
});

// A key i18next could not find comes back as itself; a translated text never starts with the module.
const translated = (text: string) => !text.startsWith("bknProject.") && text.trim() !== "";
// A key missing in zh-CN falls back to en-US, so a Chinese text must hold Chinese.
const chinese = (text: string) => /[\u4e00-\u9fff]/.test(text);

describe("publish messages", () => {
  it("explains every known refusal in both languages, never with bkn-project's own text", () => {
    for (const code of KNOWN_REFUSALS) {
      for (const t of [zh, en]) {
        const text = refusalText(t, refusal(`BknProject.${code}`), "bknProject.confirm.failed");
        expect.soft(translated(text), `${code}: ${text}`).toBe(true);
        expect.soft(text).not.toContain("raw");
      }
      const zhText = refusalText(zh, refusal(`BknProject.${code}`), "bknProject.confirm.failed");
      expect.soft(chinese(zhText), `${code} in zh-CN: ${zhText}`).toBe(true);
    }
  });

  it("falls back for an unknown refusal or a failure without a code", () => {
    expect(refusalText(zh, refusal("BknProject.Draft.Unknown"), "bknProject.confirm.failed")).toBe(
      "没能确认，请稍后重试",
    );
    expect(refusalText(en, new Error("network"))).toBe("That did not go through. Try again later.");
  });

  it("names the definitions the project already has, by the item's name when known", () => {
    const error = refusal("BknProject.Lineage.DefinitionsExist", [
      "object_types/customers.bkn",
      "relation_types/orders_to_customers.bkn",
    ]);
    expect(definitionIds(["object_types/customers.bkn", 3, "x"])).toEqual(["customers", "x"]);
    expect(refusalText(zh, error, "bknProject.confirm.failed", { customers: "客户" })).toBe(
      "项目中已有同名的定义，不能覆盖：客户、orders_to_customers",
    );
    expect(refusalText(en, refusal("BknProject.Lineage.DefinitionsExist"))).toBe(
      "The project already has definitions with the same names",
    );
  });

  it("says why confirming is not allowed, with the blocker's count", () => {
    const blockers = [{ code: "needs_identity", count: 2, waitingFor: "editor" as const }];
    expect(blockedText(zh, "needs_identity", blockers)).toBe(
      "2 个已采纳的对象类还需要选定唯一标识",
    );
    expect(blockedText(en, "needs_identity", [{ ...blockers[0], count: 1 }])).toBe(
      "1 adopted object type still needs an identity",
    );
    // Without a count, the reason is not said as "0 object types".
    expect(blockedText(zh, "unadopted_ends", [])).toBe("现在还不能确认");
    for (const reason of [
      "not_owner",
      "running",
      "archived",
      "unadopted_ends",
      "nothing_adopted",
      "no_catalogs",
      "branch_not_v3",
      "lineage_not_v3",
      "definitions_exist",
      "something_new",
      undefined,
    ]) {
      expect.soft(translated(blockedText(en, reason, [])), String(reason)).toBe(true);
    }
  });

  it("explains why an item was left out and why a count was not made", () => {
    for (const because of [
      "needs_identity",
      "not_adopted",
      "not_counted",
      "below_suggest_hit_rate",
      "below_adopt_hit_rate",
      "few_values",
      "end_not_adopted",
      "new_reason",
      undefined,
    ]) {
      expect.soft(translated(pendingBecauseText(zh, because)), String(because)).toBe(true);
    }
    expect(checkReasonText(zh, "cross_catalog")).toBe("两张表在不同的数据目录，无法核对");
    expect(checkReasonText(en, "new_reason")).toBe("Not checked");
    for (const status of CHECK_STATUSES) {
      expect.soft(translated(zh(`bknProject.release.check.status.${status}`))).toBe(true);
    }
  });

  it("names each index state, a ready index being rebuilt apart", () => {
    expect(indexStateText(zh, indexItem({}))).toBe("可用");
    expect(indexStateText(zh, indexItem({ task: { id: "t", status: "running" } }))).toBe(
      "可用，正在重建",
    );
    expect(indexStateText(en, indexItem({ state: "not_configured" }))).toBe(
      "Build settings missing",
    );
    expect(indexStateText(zh, indexItem({ state: "queued" as IndexItem["state"] }))).toBe(
      "状态未知",
    );
    expect(missingFieldsText(zh, ["primary_key_fields", "incremental_fields"])).toBe(
      "缺少：唯一标识字段、更新字段",
    );
    expect(missingFieldsText(zh, ["something_new"])).toBe("这张表缺少构建所需的设置。");
  });

  it("explains each build outcome without the raw reason", () => {
    const time = 1;
    expect(buildOutcomeText(zh, { outcome: "created", time })).toBe("已开始构建");
    expect(
      buildOutcomeText(zh, { outcome: "not_configurable", reason: "primary_key_fields", time }),
    ).toBe("唯一标识字段的类型不能用来建索引（需要是数字或文字）。");
    expect(
      buildOutcomeText(en, {
        outcome: "not_configurable",
        reason: "primary_key_fields,incremental_fields",
        time,
      }),
    ).toBe(
      "The identity field's type cannot be used for an index (it must be a number or text). No update field can be used. You can choose one for the object type in ontology modeling.",
    );
    expect(buildOutcomeText(en, { outcome: "failed", reason: "vega said 500", time })).toBe(
      "The build could not start. You can build again later.",
    );
    for (const outcome of ["existing", "no_permission", "no_config_permission"] as const) {
      expect.soft(translated(buildOutcomeText(en, { outcome, time }))).toBe(true);
    }
  });

  it("estimates the minutes left only for two tables or more", () => {
    expect(understandingMinutesLeft(0)).toBeNull();
    expect(understandingMinutesLeft(1)).toBeNull();
    expect(understandingMinutesLeft(2)).toBe(1);
    expect(understandingMinutesLeft(5)).toBe(3);
  });

  it("joins a list with the language's separator", () => {
    expect(listText(zh, ["a", "b"])).toBe("a、b");
    expect(listText(en, ["a", "b"])).toBe("a, b");
  });
});
