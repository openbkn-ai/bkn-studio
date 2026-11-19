/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  conceptsRunErrorText,
  draftErrorText,
  requirementErrorText,
  runningWork,
  testCheckReasonText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import { citedDocumentName } from "@/modules/bkn-project/components/requirements/citing";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

const zh = i18n.getFixedT("zh-CN");
const en = i18n.getFixedT("en-US");

describe("testCheckReasonText", () => {
  it("tells a deleted table from a failed query, never by its code", () => {
    expect(testCheckReasonText(zh, "table_missing")).toBe("测试所问的数据表已被删除");
    expect(testCheckReasonText(en, "table_missing")).toBe(
      "The table this test asks about was deleted",
    );
    expect(testCheckReasonText(zh, "query_failed: vega-backend 500")).toBe("查询数据没有成功");
    expect(testCheckReasonText(zh, "something_new")).toBe("没有通过核对");
    expect(testCheckReasonText(zh, "data_not_built")).toBe("文档数据还没构建，构建完成后再核对");
    expect(testCheckReasonText(en, "data_not_built")).toBe(
      "The document data is not built yet; check again after the build",
    );
  });
});

describe("conceptsRunErrorText", () => {
  it("says why extracting failed and what to do, never the code", () => {
    expect(conceptsRunErrorText(zh, "output_too_long")).toContain("拆成几份");
    expect(conceptsRunErrorText(en, "agent_timeout")).toBe("The AI took too long. Extract again.");
    expect(conceptsRunErrorText(zh, "something_new")).toBe("请重新抽取。");
  });

  it("words a part still to extract, singular and plural", () => {
    expect(zh("bknProject.concepts.run.partial", { count: 2 })).toContain("2 段");
    expect(en("bknProject.concepts.run.partial", { count: 1 })).toContain("1 part ");
  });
});

describe("requirementErrorText", () => {
  it("says what to do when there are no requirements to write into", () => {
    expect(requirementErrorText(zh, "Requirement.NotFound")).toContain("先生成业务场景");
    expect(draftErrorText(en, "output_too_long")).toContain("Trim the requirement documents");
  });
});

describe("runningWork", () => {
  const requirements = (status: string, concepts?: string, kinetic?: string) =>
    ({
      spec: {
        runs: {
          concepts: concepts ? { status: concepts } : null,
          kinetic: kinetic ? { status: kinetic } : null,
        },
      },
      status,
    }) as unknown as Requirements;

  it("names the work holding the requirements", () => {
    expect(runningWork(requirements("drafting"))).toBe("scenarios");
    expect(runningWork(requirements("ready", "running"))).toBe("concepts");
    expect(runningWork(requirements("ready", "failed", "running"))).toBe("kinetic");
    expect(runningWork(requirements("ready", "ready"))).toBeNull();
    expect(runningWork(null)).toBeNull();
  });
});

describe("citedDocumentName", () => {
  it("names the network's background and the knowledge base's rules by what they are", () => {
    const documents = [{ id: "d1", name: "采购制度.md" }];
    expect(citedDocumentName(zh, "knowledge", documents, "已删除的文档")).toBe(
      "知识库中的规则和概念",
    );
    expect(citedDocumentName(en, "knowledge", documents, "gone")).toBe(
      "Rules and concepts of the knowledge base",
    );
    expect(citedDocumentName(zh, "network", documents, "已删除的文档")).not.toBe("已删除的文档");
    expect(citedDocumentName(zh, "d1", documents, "已删除的文档")).toBe("采购制度.md");
    expect(citedDocumentName(zh, "d9", documents, "已删除的文档")).toBe("已删除的文档");
  });
});

describe("the kinetic left-out note", () => {
  it("says one suggestion in the singular in English", () => {
    expect(en("bknProject.requirements.rejectedByRun.kinetic", { count: 1 })).toBe(
      "The analysis left out 1 suggestion",
    );
    expect(en("bknProject.requirements.rejectedByRun.kinetic", { count: 3 })).toBe(
      "The analysis left out 3 suggestions",
    );
  });
});
