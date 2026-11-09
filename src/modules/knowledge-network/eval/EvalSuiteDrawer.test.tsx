/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";

import { EvalSuiteDrawer } from "./EvalSuiteDrawer";
import {
  createEvalSuite,
  getEvalSuite,
  listEvalCases,
  listEvalCaseResourceSummary,
  replaceEvalSuite,
  type EvalCaseSummary,
  type EvalSuiteVersion,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  CASE_LIST_BATCH_SIZE: 50,
  createEvalSuite: vi.fn(),
  getEvalSuite: vi.fn(),
  listEvalCases: vi.fn(),
  listEvalCaseResourceSummary: vi.fn(),
  replaceEvalSuite: vi.fn(),
}));

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "zh-CN", fallbackLng: "zh-CN", resources: evalLocales });
});

const draft: EvalSuiteVersion = {
  id: "suite-v1",
  suite_id: "suite-1",
  name: "供应链回归",
  description: "验证供应链核心流程",
  tags: ["核心", "回归"],
  version: 1,
  status: "draft",
  members: ["case-1"],
  member_summaries: [
    {
      case_id: "case-1",
      title: "标准交期",
    },
  ],
  checksum: "a".repeat(64),
};

const published: EvalSuiteVersion = { ...draft, status: "published" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [{ name: "标准交期", kinds: ["function"], case_count: 1 }],
    total: 1,
    case_total: 1,
    page: 1,
    limit: 10,
  });
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-1",
        title: "标准交期",
        enabled: true,
        created_at: "2026-11-01T00:00:00Z",
      },
    ],
    total: 1,
    next_cursor: null,
  });
  vi.mocked(createEvalSuite).mockResolvedValue(published);
  vi.mocked(getEvalSuite).mockResolvedValue(published);
  vi.mocked(replaceEvalSuite).mockResolvedValue(published);
});

it("updates and freezes the test set in one request", async () => {
  const onSaved = vi.fn();
  render(
    <EvalSuiteDrawer networkId="kn-1" open suite={published} onClose={vi.fn()} onSaved={onSaved} />,
  );

  fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));

  await waitFor(() =>
    expect(replaceEvalSuite).toHaveBeenCalledWith(
      "kn-1",
      published,
      "供应链回归",
      "验证供应链核心流程",
      ["核心", "回归"],
      ["case-1"],
    ),
  );
  expect(onSaved).toHaveBeenCalledWith(published);
});

it("allows the test set name to be changed without a publish step", async () => {
  const onSaved = vi.fn();
  render(
    <EvalSuiteDrawer networkId="kn-1" open suite={published} onClose={vi.fn()} onSaved={onSaved} />,
  );

  expect(screen.queryByRole("button", { name: /发布/ })).toBeNull();
  expect(screen.getByRole("textbox", { name: "测试集描述" })).toHaveValue("验证供应链核心流程");
  fireEvent.change(screen.getByRole("textbox", { name: "测试集名称" }), {
    target: { value: "供应链核心回归" },
  });
  fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(published));
  expect(replaceEvalSuite).toHaveBeenCalledWith(
    "kn-1",
    published,
    "供应链核心回归",
    "验证供应链核心流程",
    ["核心", "回归"],
    ["case-1"],
  );
});

it("selects cases from a searchable table when creating a test set", async () => {
  const onSaved = vi.fn();
  render(<EvalSuiteDrawer networkId="kn-1" open onClose={vi.fn()} onSaved={onSaved} />);

  fireEvent.change(screen.getByRole("textbox", { name: "测试集名称" }), {
    target: { value: "供应链回归" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "测试集描述" }), {
    target: { value: "验证核心供应链场景" },
  });
  expect(screen.getByText("当前测试集还没有用例，请新增用例")).toBeTruthy();
  expect(listEvalCases).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /新增用例/ }));
  const selector = await screen.findByRole("dialog", { name: "新增用例" });
  expect(await within(selector).findByRole("columnheader", { name: "评测对象" })).toBeTruthy();
  expect(within(selector).getByRole("columnheader", { name: "资源类型" })).toBeTruthy();
  fireEvent.click(await within(selector).findByRole("checkbox", { name: "选择用例：标准交期" }));
  fireEvent.click(within(selector).getByRole("button", { name: "添加 1 条" }));

  expect(await screen.findByText("标准交期")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "已选用例（1）" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));

  await waitFor(() =>
    expect(createEvalSuite).toHaveBeenCalledWith(
      "kn-1",
      "供应链回归",
      "验证核心供应链场景",
      [],
      ["case-1"],
    ),
  );
  expect(replaceEvalSuite).not.toHaveBeenCalled();
  expect(onSaved).toHaveBeenCalledWith(published);
}, 20_000);

it("shows only current members while editing and supports adding and removing cases", async () => {
  vi.mocked(listEvalCases).mockResolvedValue({
    entries: [
      {
        id: "case-1",
        title: "标准交期",
        enabled: true,
        created_at: "2026-11-01T00:00:00Z",
      },
      {
        id: "case-2",
        title: "安全库存",
        enabled: true,
        created_at: "2026-11-01T00:00:00Z",
      },
    ],
    total: 2,
    next_cursor: null,
  });

  render(
    <EvalSuiteDrawer networkId="kn-1" open suite={published} onClose={vi.fn()} onSaved={vi.fn()} />,
  );

  expect(screen.getByText("标准交期")).toBeTruthy();
  expect(screen.queryByText("安全库存")).toBeNull();
  expect(listEvalCases).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /新增用例/ }));
  const selector = await screen.findByRole("dialog", { name: "新增用例" });
  expect(await within(selector).findByText("安全库存")).toBeTruthy();
  expect(within(selector).getByRole("checkbox", { name: "已添加用例：标准交期" })).toBeDisabled();
  fireEvent.click(within(selector).getByRole("checkbox", { name: "选择用例：安全库存" }));
  fireEvent.click(within(selector).getByRole("button", { name: "添加 1 条" }));

  expect(await screen.findByText("安全库存")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "移除用例：标准交期" }));
  expect(screen.queryByText("标准交期")).toBeNull();
  expect(screen.getByRole("heading", { name: "已选用例（1）" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));
  await waitFor(() =>
    expect(replaceEvalSuite).toHaveBeenCalledWith(
      "kn-1",
      published,
      "供应链回归",
      "验证供应链核心流程",
      ["核心", "回归"],
      ["case-2"],
    ),
  );
}, 20_000);

it("loads member summaries from the exact suite version without scanning all cases", async () => {
  const suiteWithoutSummaries = { ...published, member_summaries: undefined };

  render(
    <EvalSuiteDrawer
      networkId="kn-1"
      open
      suite={suiteWithoutSummaries}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );

  expect(await screen.findByText("标准交期")).toBeTruthy();
  expect(getEvalSuite).toHaveBeenCalledWith("kn-1", "suite-1", 1);
  expect(listEvalCases).not.toHaveBeenCalled();
});

it("separates the description counter and selected-case toolbar and puts actions second", () => {
  render(
    <EvalSuiteDrawer networkId="kn-1" open suite={published} onClose={vi.fn()} onSaved={vi.fn()} />,
  );
  expect(screen.getByLabelText("描述字数")).toHaveTextContent(
    `${published.description.length} / 1000`,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "测试集描述" }), {
    target: { value: "新的描述" },
  });
  expect(screen.getByLabelText("描述字数")).toHaveTextContent("4 / 1000");
  const members = screen.getByRole("region", { name: "已选用例" });
  expect(within(members).getByRole("heading", { name: "已选用例（1）" })).toBeTruthy();
  expect(within(members).getByRole("searchbox", { name: "搜索已选用例" })).toBeTruthy();
  expect(within(members).getByRole("button", { name: /新增用例/ })).toBeTruthy();
  expect(within(members).queryByText(/共.*条/)).toBeNull();
  expect(
    within(members)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["用例名称", "操作"]);
});

it("reuses resource navigation and retains selected cases across resource filters", async () => {
  const first: EvalCaseSummary = {
    id: "case-1",
    title: "物料检查",
    enabled: true,
    created_at: "2026-11-05T00:00:00Z",
    execution_spec: { target: { name: "物料", capability_type: "objectType" } },
  };
  const second: EvalCaseSummary = {
    id: "case-2",
    title: "供应商检查",
    enabled: true,
    created_at: first.created_at,
    execution_spec: { target: { name: "供应商", capability_type: "objectType" } },
  };
  vi.mocked(listEvalCaseResourceSummary).mockResolvedValue({
    entries: [
      { name: "物料", kinds: ["objectType"], case_count: 1 },
      { name: "供应商", kinds: ["objectType"], case_count: 1 },
    ],
    total: 2,
    case_total: 2,
    page: 1,
    limit: 10,
  });
  vi.mocked(listEvalCases).mockImplementation((_kn, _query, _cursor, _status, filter) =>
    Promise.resolve({
      entries:
        filter?.name === "物料" ? [first] : filter?.name === "供应商" ? [second] : [first, second],
      total: filter?.name ? 1 : 2,
      next_cursor: null,
    }),
  );
  render(<EvalSuiteDrawer networkId="kn-1" open onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /新增用例/ }));
  const selector = await screen.findByRole("dialog", { name: "新增用例" });
  const resources = within(selector).getByRole("navigation", { name: "资源列表" });
  await waitFor(() =>
    expect(within(resources).getByLabelText("全部资源", { selector: "button" })).toHaveTextContent(
      "全部资源2",
    ),
  );
  fireEvent.click(await within(resources).findByTitle("物料"));
  fireEvent.click(
    await within(selector).findByLabelText(
      "选择用例：物料检查",
      { selector: 'input[type="checkbox"]' },
      { timeout: 5000 },
    ),
  );
  fireEvent.click(within(resources).getByTitle("供应商"));
  fireEvent.click(
    await within(selector).findByLabelText(
      "选择用例：供应商检查",
      { selector: 'input[type="checkbox"]' },
      { timeout: 5000 },
    ),
  );
  expect(within(selector).getByText("待添加 2 条")).toBeTruthy();
  expect(listEvalCaseResourceSummary).toHaveBeenCalledWith(
    "kn-1",
    undefined,
    1,
    10,
    expect.any(AbortSignal),
    "enabled",
  );
  expect(listEvalCases).toHaveBeenLastCalledWith("kn-1", "", undefined, "enabled", {
    name: "供应商",
    type: undefined,
  });
  fireEvent.click(
    within(selector.querySelector<HTMLElement>(".ant-drawer-footer")!).getByRole("button", {
      name: "添加 2 条",
    }),
  );
  expect(screen.getByRole("heading", { name: "已选用例（2）" })).toBeTruthy();
  expect(screen.getByText("物料检查")).toBeTruthy();
  expect(screen.getByText("供应商检查")).toBeTruthy();
});
