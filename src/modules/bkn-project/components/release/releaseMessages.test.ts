/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError } from "axios";
import { beforeAll, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  answerErrorText,
  checkReasonText,
  releaseFailureText,
  releaseNotes,
  reviewRelinkPath,
} from "@/modules/bkn-project/components/release/releaseMessages";

describe("release notes", () => {
  it("words the note bkn-project writes when it turns on versioning, in either language", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(releaseNotes(i18n.t, "Turned on by BKN-project for its projects").text).toBe(
      "在这个知识网络上新建项目时开启了版本管理",
    );
    await i18n.changeLanguage("en-US");
    expect(releaseNotes(i18n.t, "Turned on by BKN-project for its projects").text).toBe(
      "Versioning turned on when a project was created on this knowledge network",
    );
    // A person's note stays as written, even one that quotes it.
    expect(releaseNotes(i18n.t, "Turned on by BKN-project for its projects, then fixed").text).toBe(
      "Turned on by BKN-project for its projects, then fixed",
    );
    await i18n.changeLanguage("zh-CN");
  });
});

describe("knowledge-base review items in the release review", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  const reason = (details?: unknown) =>
    checkReasonText(i18n.t, {
      accept: "knowledge_base_review_items",
      code: "knowledge_base",
      details,
      passed: false,
      reason: "knowledge_base_review_items",
    });

  it("names only the kinds counted with items, and makes up no count", () => {
    expect(reason({ review_conflicts: 0, review_links: 3, review_values: "2" })).toBe(
      "知识库还有未处理的待核实条目：关联待核查 3 条。可以在构建页逐条处理，或确认后带着它们发布。",
    );
    for (const details of [undefined, {}, { review_links: 0, review_values: 1.5 }]) {
      expect(reason(details)).toBe(
        "知识库还有未处理的待核实条目。可以在构建页逐条处理，或确认后带着它们发布。",
      );
    }
  });
});

describe("relinking what the release review cannot read", () => {
  const code = "Lineage.CapabilityRequestFailed";
  it("leads to the first definition using a gone toolbox, else to the network's functions or Skills", () => {
    const network = "/knowledge-network/workspace/kn%2F1";
    expect(
      reviewRelinkPath(code, 404, {
        kind: "function",
        network_id: "kn/1",
        used_by: [{ kind: "capability" }, { kind: "logic_property", id: "part", name: "物料" }],
      }),
    ).toBe(`${network}/object-types/part/edit`);
    expect(
      reviewRelinkPath(code, 404, {
        kind: "skill",
        network_id: "kn/1",
        used_by: [{ kind: "capability" }],
      }),
    ).toBe(`${network}/skills`);
    expect(reviewRelinkPath(code, 404, { kind: "function", network_id: "kn/1" })).toBe(
      `${network}/functions`,
    );
  });
  it("offers nothing for a read that only failed, or without its network", () => {
    expect(reviewRelinkPath(code, 502, { kind: "function", network_id: "kn" })).toBeNull();
    expect(reviewRelinkPath(code, 404, { kind: "function" })).toBeNull();
    expect(reviewRelinkPath("Release.Other", 404, { network_id: "kn" })).toBeNull();
  });
});

describe("a release request the page stopped waiting for", () => {
  it("says to refresh and check instead of the generic failure, in either language", async () => {
    const timedOut = new AxiosError("timeout of 300000ms exceeded", "ECONNABORTED");
    const refused = new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
      data: {},
      status: 500,
      statusText: "",
      headers: {},
      config: {} as never,
    });
    await i18n.changeLanguage("zh-CN");
    expect(releaseFailureText(i18n.t, timedOut, undefined, "prepare")).toBe(
      "写入网络超过 5 分钟还没完成，页面已停止等待。模型较大时会更久：请刷新页面看是否已写入，没有的话再试一次。",
    );
    expect(releaseFailureText(i18n.t, timedOut, undefined, "publish")).toContain(
      "刷新页面看是否已发布",
    );
    // A server that answered keeps its own reason.
    expect(releaseFailureText(i18n.t, refused, undefined, "prepare")).toBe(
      "没能发布，请稍后重试。",
    );
    await i18n.changeLanguage("en-US");
    expect(releaseFailureText(i18n.t, timedOut, undefined, "prepare")).toContain(
      "more than 5 minutes",
    );
    await i18n.changeLanguage("zh-CN");
  });
});

describe("a regression question that could not be asked", () => {
  it("says a sign-in that expired while asking, and to run again", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(answerErrorText(i18n.t, "BknAgent.Auth.TokenRequired")).toBe(
      "提问时你的登录已过期，没能提问。重新运行回归即可。",
    );
    expect(answerErrorText(i18n.t, "something.else")).toBe("没能完成这次提问。");
    await i18n.changeLanguage("en-US");
    expect(answerErrorText(i18n.t, "BknAgent.Auth.TokenRequired")).toBe(
      "Your sign-in expired while asking, so nothing was asked. Run the regression again.",
    );
  });
});
