/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { EvalResultValue } from "./EvalResultValue";
import { evalLocales } from "./locales";

const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("./useEvalFeedback", () => ({ useEvalFeedback: () => ({ message: feedback }) }));
vi.mock("@/framework/compat/clipboard", () => ({ writeTextToClipboard: vi.fn() }));
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(writeTextToClipboard).mockResolvedValue(undefined);
});

it("starts at two levels and expands and collapses without altering the copied JSON", async () => {
  const value = { available: true, result: { query: "关键词", results: [{ title: "完整标题" }] } };
  render(<EvalResultValue value={value} label="实际结果" />);
  expect(screen.getByText('"available":')).toBeTruthy();
  expect(screen.getByText('"query":')).toBeTruthy();
  expect(screen.queryByText('"title":')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "展开全部" }));
  expect(screen.getByText('"title":')).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "收起全部" }));
  expect(screen.queryByText('"query":')).toBeNull();
  await act(() =>
    Promise.resolve(fireEvent.click(screen.getByRole("button", { name: "复制完整内容" }))),
  );
  expect(writeTextToClipboard).toHaveBeenCalledWith(JSON.stringify(value, null, 2));
});

it("keeps large numeric literals, strings, false, zero and null distinct", async () => {
  const raw =
    '{"id":9007199254740993123,"code":"9007199254740993123","enabled":false,"count":0,"empty":null}';
  render(<EvalResultValue value={parsePrecisionPreservingJSON(raw)} label="实际结果" />);
  expect(screen.getByText("9007199254740993123")).toBeTruthy();
  expect(screen.getByText('"9007199254740993123"')).toBeTruthy();
  for (const text of ["false", "0", "null"]) expect(screen.getByText(text)).toBeTruthy();
  await act(() =>
    Promise.resolve(fireEvent.click(screen.getByRole("button", { name: "复制完整内容" }))),
  );
  const copied = vi.mocked(writeTextToClipboard).mock.calls[0][0];
  expect(copied).toContain('"id": 9007199254740993123');
  expect(copied).toContain('"code": "9007199254740993123"');
});

it("truncates long strings only for display and expands their complete text", async () => {
  const long = "业务正文".repeat(100) + "结束标记";
  render(<EvalResultValue value={{ content: long }} label="实际结果" />);
  expect(screen.queryByText(JSON.stringify(long))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "展开全文" }));
  expect(screen.getByText(JSON.stringify(long))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "收起全文" }));
  expect(screen.queryByText(JSON.stringify(long))).toBeNull();
  await act(() =>
    Promise.resolve(fireEvent.click(screen.getByRole("button", { name: "复制完整内容" }))),
  );
  expect(writeTextToClipboard).toHaveBeenCalledWith(JSON.stringify({ content: long }, null, 2));
});

it("renders large arrays in batches while keeping every remaining item reachable", () => {
  const value = Array.from({ length: 53 }, (_, index) => `结果-${index}`);
  render(<EvalResultValue value={value} label="实际结果" />);
  expect(screen.getByText('"结果-49"')).toBeTruthy();
  expect(screen.queryByText('"结果-52"')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "继续显示（剩余 3 项）" }));
  expect(screen.getByText('"结果-52"')).toBeTruthy();
});

it("renders returned content as text and preserves special field names", async () => {
  const value = { constructor: "业务字段", content: "<script>window.bad=true</script>" };
  const { container } = render(<EvalResultValue value={value} label="实际结果" />);
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText('"constructor":')).toBeTruthy();
  await act(() =>
    Promise.resolve(fireEvent.click(screen.getByRole("button", { name: "复制完整内容" }))),
  );
  expect(writeTextToClipboard).toHaveBeenCalledWith(JSON.stringify(value, null, 2));
});

it("reports clipboard failures and does not show a false success", async () => {
  vi.mocked(writeTextToClipboard).mockRejectedValue(new Error("denied"));
  render(<EvalResultValue value={"普通文本"} label="实际结果" />);
  expect(
    within(screen.getByRole("region", { name: "实际结果" })).queryByText("展开全部"),
  ).toBeNull();
  await act(() =>
    Promise.resolve(fireEvent.click(screen.getByRole("button", { name: "复制完整内容" }))),
  );
  expect(feedback.error).toHaveBeenCalledWith("复制失败，请重试。");
  expect(feedback.success).not.toHaveBeenCalled();
});
