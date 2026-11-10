/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { evalLocales } from "./locales";
import { EvalTraceEvidence } from "./EvalTraceEvidence";
import { getM0Evidence, getM0OperationAttempt, type M0CaseDetail } from "./m0-run.service";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
vi.mock("./m0-run.service", () => ({ getM0Evidence: vi.fn(), getM0OperationAttempt: vi.fn() }));
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
const detail: M0CaseDetail = {
  id: "case-run-1",
  case_id: "case-1",
  case_title: "检查物料",
  case_version_id: "case-1@1",
  execution_status: "completed",
  quality_outcome: "fail",
  duration_ms: 12,
  assertions: [],
  findings: [],
  observation: {
    evidence_status: "complete",
    normalized_output: { normalized_marker: "evaluation-only" },
  },
  evidence_refs: { operation_id: "op-1", receipt_id: "rcpt-1", interaction_id: "int-1" },
};
const fact = () => ({
  operation_id: "op-1",
  attempt: 2,
  status: "completed",
  input: { mode: "inline", inline: { id: 0, enabled: false, password: "do-not-show" } },
  output: { mode: "inline", inline: { answer: "original-tool-answer" } },
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getM0Evidence).mockImplementation((kind) =>
    Promise.resolve(
      kind === "operation"
        ? {
            operation_id: "op-1",
            attempt: 2,
            attempt_status: "completed",
            tool_name: "query_object_instance",
          }
        : kind === "receipt"
          ? { receipt_id: "rcpt-1", receipt_status: "completed", evidence_durability: "durable" }
          : { interaction_id: "int-1", execution_status: "completed", evidence_status: "complete" },
    ),
  );
  vi.mocked(getM0OperationAttempt).mockResolvedValue(fact());
});
it("reads the exact attempt and displays original input/output with safe redaction", async () => {
  render(<EvalTraceEvidence detail={detail} active />);
  await screen.findByText(/original-tool-answer/, { selector: "pre" });
  expect(getM0OperationAttempt).toHaveBeenCalledExactlyOnceWith("op-1", 2);
  const body = document.body.textContent;
  expect(body).toContain('"id": 0');
  expect(body).toContain('"enabled": false');
  expect(body).not.toContain("do-not-show");
  expect(body).not.toContain("evaluation-only");
  expect(screen.getByText("Trace 证据完整")).toBeVisible();
  expect(screen.queryByText("op-1")).toBeNull();
  fireEvent.focus(screen.getByLabelText("Trace 证据完整性说明"));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("不代表评测通过");
});
it("loads receipts and execution sessions on demand and caches successfully read records", async () => {
  render(<EvalTraceEvidence detail={detail} active />);
  await screen.findByText(/original-tool-answer/, { selector: "pre" });
  expect(getM0Evidence).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("调用回执", { exact: true }));
  await screen.findByText("已持久化", { exact: true });
  expect(getM0Evidence).toHaveBeenLastCalledWith("receipt", "rcpt-1");
  fireEvent.click(screen.getByText("执行会话", { exact: true }));
  await waitFor(() => expect(getM0Evidence).toHaveBeenLastCalledWith("interaction", "int-1"));
  fireEvent.click(screen.getByText("工具调用", { exact: true }));
  expect(await screen.findByText(/original-tool-answer/, { selector: "pre" })).toBeVisible();
  expect(getM0Evidence).toHaveBeenCalledTimes(3);
  expect(getM0OperationAttempt).toHaveBeenCalledTimes(1);
});
it("keeps metadata labels concise while preserving timestamps and false required-evidence values", async () => {
  const read = vi.mocked(getM0Evidence).getMockImplementation()!;
  const stamp = "2026-11-06T18:00:44+08:00";
  vi.mocked(getM0Evidence).mockImplementation(async (kind, id) => ({
    ...((await read(kind, id)) as Record<string, unknown>),
    ...(kind === "receipt" ? { required: false, issued_at: stamp, terminal_at: stamp } : {}),
    ...(kind === "interaction" ? { created_at: stamp, terminal_at: stamp } : {}),
  }));
  render(<EvalTraceEvidence detail={detail} active />);
  await screen.findByText(/original-tool-answer/, { selector: "pre" });
  fireEvent.click(screen.getByText("调用回执", { exact: true }));
  const required = await screen.findByText("必要证据", { exact: true });
  expect(within(required.closest("tr")!).getByText("否", { exact: true })).toBeTruthy();
  const issued = screen.getByText("签发时间", { exact: true }).closest("tr")!;
  expect(issued).toHaveTextContent(
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "medium" }).format(
      new Date(stamp),
    ),
  );
  expect(screen.queryByText("是否为必要证据")).toBeNull();
  fireEvent.click(screen.getByText("执行会话", { exact: true }));
  expect(await screen.findByText("创建时间", { exact: true })).toBeTruthy();
  expect(screen.queryByText("记录创建时间")).toBeNull();
});
it("keeps verified status separate from current read permissions and retries call detail failures", async () => {
  vi.mocked(getM0OperationAttempt).mockRejectedValueOnce(new Error("forbidden"));
  render(<EvalTraceEvidence detail={detail} active />);
  expect(await screen.findByText(/输入、输出明细暂不可读取/)).toBeVisible();
  expect(screen.getByText("Trace 证据完整")).toBeVisible();
  expect(screen.queryByText(/original-tool-answer/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重试读取" }));
  expect(await screen.findByText(/original-tool-answer/, { selector: "pre" })).toBeVisible();
  expect(getM0OperationAttempt).toHaveBeenCalledTimes(2);
});
it("does not show mismatched call facts as evidence for the selected operation", async () => {
  vi.mocked(getM0OperationAttempt).mockResolvedValue({
    ...fact(),
    operation_id: "another-operation",
    output: { mode: "inline", inline: { secret_other_output: "do-not-show" } },
  });
  render(<EvalTraceEvidence detail={detail} active />);
  await screen.findByText(/输入、输出明细暂不可读取/);
  expect(document.body.textContent).not.toContain("do-not-show");
});
it("discards late evidence when the selected Case changes", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(getM0OperationAttempt).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<EvalTraceEvidence detail={detail} active />);
  await waitFor(() => expect(getM0OperationAttempt).toHaveBeenCalledTimes(1));
  view.rerender(
    <EvalTraceEvidence detail={{ ...detail, id: "new-case-run", evidence_refs: {} }} active />,
  );
  await act(() => {
    finish(fact());

    return Promise.resolve();
  });
  expect(screen.getByText("本次没有可读取的 Trace 引用。")).toBeVisible();
  expect(document.body.textContent).not.toContain("original-tool-answer");
});
it("shows external or omitted payloads honestly and preserves large inline numbers", async () => {
  vi.mocked(getM0OperationAttempt).mockResolvedValue({
    ...fact(),
    input: { mode: "referenced", ref: "artifact:input" },
    output: {
      mode: "inline",
      inline: parsePrecisionPreservingJSON('{"id":900719925474099312345}'),
    },
    error: { mode: "omitted", omitted_reason: "serialization_failed" },
  });
  render(<EvalTraceEvidence detail={detail} active />);
  await screen.findByText(/900719925474099312345/, { selector: "pre" });
  expect(screen.getByText(/内容保存在外部证据文件中/)).toBeVisible();
  expect(screen.getByText(/原始内容未保存或未返回/)).toBeVisible();
  expect(getM0OperationAttempt).toHaveBeenCalledTimes(1);
});
it("does not read hidden technical details or fabricate completeness for missing statuses", async () => {
  const view = render(
    <EvalTraceEvidence detail={{ ...detail, observation: undefined }} active={false} />,
  );
  expect(getM0Evidence).not.toHaveBeenCalled();
  expect(screen.getByText("Trace 证据状态未记录")).toBeVisible();
  view.rerender(<EvalTraceEvidence detail={{ ...detail, observation: undefined }} active />);
  await screen.findByText(/original-tool-answer/, { selector: "pre" });
  expect(getM0Evidence).toHaveBeenCalledTimes(1);
});
