/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeAll, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  checkReasonText,
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
