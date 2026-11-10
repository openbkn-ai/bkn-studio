/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { evalLocales } from "./locales";

import { beforeEach, describe, expect, it, vi } from "vitest";

type ExecutionModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-execution.service");

const { startExecution } = vi.hoisted(() => ({
  startExecution: vi.fn<ExecutionModule["startExecution"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-execution.service",
  async (importOriginal) => ({ ...(await importOriginal<ExecutionModule>()), startExecution }),
);

import {
  parseEvalAssistantActions,
  parseEvalCaseDesignProposal,
  runEvalAssistant,
} from "./eval-case-designer.service";

const resources = [{ id: "order", name: "订单", kind: "objectType", metadata: {} }];
const rules = [
  {
    id: "object-definition",
    kind: "objectType" as const,
    group: "对象定义",
    title: "对象结构",
    description: "检查对象结构",
    appliesWhen: "所有对象类",
    evidence: "声明",
    planDimensions: [],
    enabled: true,
  },
];

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.init({
    lng: "zh-CN",
    resources: evalLocales,
    showSupportNotice: false,
    interpolation: { escapeValue: false },
  });
});

it.each([
  { language: "zh-CN", readOnly: "此阶段只读", noExpectationChanges: "禁止修改预期" },
  {
    language: "en-US",
    readOnly: "This stage is read-only",
    noExpectationChanges: "Do not change expectations",
  },
])(
  "uses a read-only repair proposal contract in $language",
  async ({ language, readOnly, noExpectationChanges }) => {
    await i18n.changeLanguage(language);
    const plan = {
      kind: "eval_repair_plan",
      summary: "需要核实源数据",
      changes: [],
      manual_steps: ["核实业务口径"],
    };
    startExecution.mockImplementationOnce((params) => {
      params.onEvent?.({
        type: "result",
        answer: JSON.stringify(plan),
        content: { trace_id: "trace-1" },
      });
      return Promise.resolve({ status: "succeeded" } as Awaited<
        ReturnType<ExecutionModule["startExecution"]>
      >);
    });
    const result = await runEvalAssistant({
      base: "https://example.test",
      tokenProvider: { getToken: () => "token", refresh: () => Promise.resolve("token") },
      knId: "network-1",
      goal: "修复当前失败",
      resources,
      rules,
      workspace: {
        activeSection: "repair",
        repairContext: {
          target: { id: "order", kind: "objectType", name: "订单" },
          complete: true,
          failures: [],
          propertyTypes: [],
          supportedOperations: [],
        },
      },
    });
    expect(startExecution.mock.calls[0][0].agentId).toBe("eval_assistant");
    expect(startExecution.mock.calls[0][0].context).toEqual({ purpose: "eval_root_cause" });
    expect(startExecution.mock.calls[0][0].message).toContain(readOnly);
    expect(startExecution.mock.calls[0][0].message).toContain(noExpectationChanges);
    const prompt = startExecution.mock.calls[0][0].message;
    for (const field of [
      "eval_repair_plan",
      "set_property_type",
      "evidence_case_run_ids",
      "sourceType",
      "supportedOperations",
      "analysisOnlyReason",
      "masked",
      "incrementalKey",
    ])
      expect(prompt).toContain(field);
    expect(prompt).not.toContain("knowledgeNetwork.eval.foundation");
    expect(prompt).toContain(language === "en-US" ? "Use English" : "使用中文");
    expect(result.repair).toEqual(plan);
    expect(result.proposal).toBeUndefined();
    expect(result.actions).toBeUndefined();
  },
);

it("uses the dedicated Eval Agent for workspace conversations", async () => {
  startExecution.mockResolvedValue({ status: "succeeded" } as Awaited<
    ReturnType<ExecutionModule["startExecution"]>
  >);
  await runEvalAssistant({
    base: "https://example.test",
    tokenProvider: { getToken: () => "token", refresh: () => Promise.resolve("token") },
    knId: "network-1",
    goal: "分析最近一次运行",
    resources,
    rules,
    workspace: { activeSection: "runs", runCount: 3 },
  });
  expect(startExecution).toHaveBeenCalledWith(
    expect.objectContaining({ agentId: "eval_assistant", knId: "network-1" }),
  );
  expect(startExecution.mock.calls[0]?.[0]).not.toHaveProperty("context");
  expect(startExecution.mock.calls[0]?.[0].message).toContain("不要拒绝设计");
  expect(startExecution.mock.calls[0]?.[0].message).toContain(
    "评测对象是被测资源，执行函数是调用能力，不得混淆",
  );
  expect(startExecution.mock.calls[0]?.[0].message).toContain(
    "质量结果为通过、未通过、无法判定、需人工判断",
  );
  expect(startExecution.mock.calls[0]?.[0].message).toContain("suggestions 必须恰好包含 N 条");
});

it("uses a valid proposal from answer text when result metadata is unrelated", async () => {
  startExecution.mockImplementationOnce((params) => {
    params.onEvent?.({
      type: "result",
      answer:
        '{"kind":"eval_case_recommendation","summary":"检查订单","suggestions":[{"resource_key":"objectType:order","rule_id":"object-definition","reason":"订单是核心对象","confidence":"high"}]}',
      content: { trace_id: "trace-1" },
    });
    return Promise.resolve({ status: "succeeded" } as Awaited<
      ReturnType<ExecutionModule["startExecution"]>
    >);
  });

  const result = await runEvalAssistant({
    base: "https://example.test",
    tokenProvider: { getToken: () => "token", refresh: () => Promise.resolve("token") },
    knId: "network-1",
    goal: "为订单生成用例",
    resources,
    rules,
    workspace: { activeSection: "测试集管理" },
  });

  expect(result.proposal?.suggestions).toEqual([
    expect.objectContaining({ resource_key: "objectType:order", rule_id: "object-definition" }),
  ]);
});

it.each([
  { language: "zh-CN", goal: "请生成 2 条跨资源场景用例", summary: "2 条不可运行的场景骨架" },
  {
    language: "en-US",
    goal: "Generate exactly 2 cross-resource scenarios",
    summary: "2 non-runnable scenario skeletons",
  },
  {
    language: "en-US",
    goal: "Please design 2 test cases",
    summary: "2 non-runnable scenario skeletons",
  },
])("retries and merges exact scenario counts for $goal", async ({ language, goal, summary }) => {
  await i18n.changeLanguage(language);
  const twoResources = [
    ...resources,
    { id: "item", name: "订单明细", kind: "objectType", metadata: {} },
  ];
  startExecution
    .mockImplementationOnce((params) => {
      params.onEvent?.({
        type: "result",
        answer: "只生成了一条",
        content: {
          kind: "eval_case_recommendation",
          summary: "第一版",
          suggestions: [
            {
              resource_key: "objectType:order",
              rule_id: "object-definition",
              reason: "订单场景",
              confidence: "high",
            },
          ],
        },
      });
      return Promise.resolve({ status: "succeeded" } as Awaited<
        ReturnType<ExecutionModule["startExecution"]>
      >);
    })
    .mockImplementationOnce((params) => {
      params.onEvent?.({
        type: "result",
        answer: "补充第二条",
        content: {
          kind: "eval_case_recommendation",
          summary: "第二版",
          suggestions: [
            {
              resource_key: "objectType:item",
              rule_id: "object-definition",
              reason: "明细场景",
              confidence: "medium",
            },
          ],
        },
      });
      return Promise.resolve({ status: "succeeded" } as Awaited<
        ReturnType<ExecutionModule["startExecution"]>
      >);
    });

  const result = await runEvalAssistant({
    base: "https://example.test",
    tokenProvider: { getToken: () => "token", refresh: () => Promise.resolve("token") },
    knId: "network-1",
    goal,
    resources: twoResources,
    rules,
    workspace: { activeSection: "测试集管理" },
  });

  expect(startExecution).toHaveBeenCalledTimes(2);
  expect(result.proposal?.suggestions).toHaveLength(2);
  expect(result.answer).toContain(summary);
  const initialPrompt = startExecution.mock.calls[0][0].message;
  expect(initialPrompt).toContain(
    language === "en-US" ? "For case generation return JSON only:" : "生成用例时只返回 JSON",
  );
  expect(initialPrompt).toContain("eval_case_recommendation");
  expect(initialPrompt).toContain("objectType:order");
  expect(initialPrompt).not.toContain("knowledgeNetwork.eval.foundation");
  expect(startExecution.mock.calls[1][0].message).toContain(
    language === "en-US" ? "exactly 2" : "恰好 2",
  );
});

describe("parseEvalCaseDesignProposal", () => {
  it("accepts fenced JSON and keeps only allowlisted resource-rule pairs", () => {
    const proposal = parseEvalCaseDesignProposal(
      '```json\n{"kind":"eval_case_recommendation","summary":"检查订单","suggestions":[{"resource_key":"objectType:order","rule_id":"object-definition","reason":"订单是核心对象","confidence":"high"},{"resource_key":"objectType:missing","rule_id":"object-definition","reason":"不存在","confidence":"high"}]}\n```',
      resources,
      rules,
    );
    expect(proposal.suggestions).toEqual([
      {
        resource_key: "objectType:order",
        rule_id: "object-definition",
        reason: "订单是核心对象",
        confidence: "high",
      },
    ]);
  });

  it("rejects a response without any valid recommendation", () => {
    expect(() =>
      parseEvalCaseDesignProposal(
        {
          kind: "eval_case_recommendation",
          summary: "无有效组合",
          suggestions: [
            {
              resource_key: "objectType:missing",
              rule_id: "invented-rule",
              reason: "不存在",
              confidence: "high",
            },
          ],
        },
        resources,
        rules,
      ),
    ).toThrow("未推荐可由当前规则验证");
  });
});

describe("parseEvalAssistantActions", () => {
  it("keeps only allowlisted and unique workspace actions", () => {
    expect(
      parseEvalAssistantActions({
        kind: "eval_assistant_actions",
        summary: "先打开用例库，再新建用例。",
        actions: [
          { type: "case_library" },
          { type: "invented_action" },
          { type: "create_case" },
          { type: "case_library" },
        ],
      }),
    ).toEqual({
      summary: "先打开用例库，再新建用例。",
      actions: [{ type: "case_library" }, { type: "create_case" }],
    });
  });

  it("rejects an action response without supported actions", () => {
    expect(() =>
      parseEvalAssistantActions({
        kind: "eval_assistant_actions",
        summary: "执行未知操作",
        actions: [{ type: "delete_everything" }],
      }),
    ).toThrow("未返回可执行的操作建议");
  });
});

it("uses case and resource names in assistant prose while preserving structured identities", async () => {
  startExecution.mockImplementationOnce((params) => {
    params.onEvent?.({
      type: "result",
      answer: "请复查 caseRunId case-run-1，再查看 resource_id=order。",
      content: {},
    });
    return Promise.resolve({ status: "succeeded" } as Awaited<
      ReturnType<ExecutionModule["startExecution"]>
    >);
  });
  const result = await runEvalAssistant({
    base: "https://example.test",
    tokenProvider: { getToken: () => "token", refresh: () => Promise.resolve("token") },
    knId: "network-1",
    goal: "分析运行情况",
    resources,
    rules,
    workspace: {
      activeSection: "运行与诊断",
      runDetails: {
        id: "run-1",
        complete: true,
        totalCases: 1,
        cases: [{ id: "case-run-1", title: "订单主键非空检查" }],
      },
    },
  });
  expect(result.answer).toContain("用例「订单主键非空检查」的执行记录");
  expect(result.answer).not.toContain("case-run-1");
  expect(startExecution.mock.calls[0][0].message).toContain("不用 UUID");
  expect(startExecution.mock.calls[0][0].message).toContain("case-run-1");
});
