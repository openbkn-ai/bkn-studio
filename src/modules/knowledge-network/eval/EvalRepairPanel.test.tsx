/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Modal } from "antd";
import "@ant-design/v5-patch-for-react-19";
import { createRef } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { useAppServices } from "@/framework/context/use-app-services";
import {
  EvalRepairPanel,
  type EvalRepairController,
  type EvalRepairConversationView,
} from "./EvalRepairPanel";
import { evalLocales } from "./locales";
import { runEvalAssistant } from "./eval-case-designer.service";
import {
  applyEvalRepair,
  loadEvalRepairSession,
  validateEvalRepairProposal,
  verifyEvalRepairCases,
  type EvalRepairProposal,
  type EvalRepairSession,
} from "./eval-repair.service";
import {
  createM1Run,
  getM1RunCapabilities,
  previewM1RunSelection,
  type M0Run,
} from "./m0-run.service";
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: vi.fn() }));
vi.mock("./eval-case-designer.service", () => ({ runEvalAssistant: vi.fn() }));
vi.mock("./eval-repair.service", () => ({
  applyEvalRepair: vi.fn(),
  loadEvalRepairSession: vi.fn(),
  validateEvalRepairProposal: vi.fn(),
  verifyEvalRepairCases: vi.fn(),
}));
vi.mock("./m0-run.service", () => ({
  createM1Run: vi.fn(),
  getM0Run: vi.fn(),
  getM1RunCapabilities: vi.fn(),
  previewM1RunSelection: vi.fn(),
}));
const session = {
  request: {
    networkId: "kn-1",
    id: "repair-1",
    target: { kind: "objectType", id: "order", name: "订单" },
    cases: [],
  },
  context: {
    target: { kind: "objectType", id: "order", name: "订单" },
    complete: true,
    failures: [{ caseId: "case-1", runId: "old-run", caseRunId: "cr-1", title: "原始判定" }],
    propertyTypes: [],
    supportedOperations: ["set_property_type"],
  },
  caseDefinitions: {},
} as EvalRepairSession;
const plan: EvalRepairProposal = {
  kind: "eval_repair_plan",
  summary: "修正与独立源定义不一致的 id 类型",
  changes: [
    {
      operation: "set_property_type",
      field: "id",
      before: "string",
      after: "integer",
      reason: "源定义与执行证据一致",
      evidence_case_run_ids: ["cr-1"],
    },
  ],
  manual_steps: [],
};
const completed = {
  id: "retest-1",
  execution_status: "completed",
  quality_outcome: "pass",
  progress: { planned_cases: 1, completed_cases: 1 },
} as M0Run;
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppServices).mockReturnValue({
    runtimeConfig: {
      auth: {
        tokenManager: {
          getAccessToken: () => "token",
          refreshAccessToken: () => Promise.resolve("token"),
        },
      },
    },
  } as unknown as ReturnType<typeof useAppServices>);
  vi.mocked(loadEvalRepairSession).mockResolvedValue(session);
  vi.mocked(runEvalAssistant).mockResolvedValue({ answer: plan.summary, repair: plan });
  vi.mocked(validateEvalRepairProposal).mockReturnValue(plan);
  vi.mocked(applyEvalRepair).mockResolvedValue(undefined);
  vi.mocked(verifyEvalRepairCases).mockResolvedValue(undefined);
  vi.mocked(getM1RunCapabilities).mockResolvedValue(true);
  vi.mocked(previewM1RunSelection).mockResolvedValue({
    case_count: 1,
    eligible: true,
    execution_mode: "platform",
    reasons: [],
  });
  vi.mocked(createM1Run).mockResolvedValue(completed);
});
afterEach(() => vi.restoreAllMocks());
const renderPanel = () => {
  const callbacks = { onUpdated: vi.fn(), onInspectRun: vi.fn() };
  return {
    ...render(<EvalRepairPanel networkId="kn-1" request={session.request} {...callbacks} />),
    ...callbacks,
  };
};

it("analyzes with the Eval assistant and waits for explicit confirmation before any write or retest", async () => {
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  const view = renderPanel();
  const button = await screen.findByRole("button", { name: "确认修复并复测" });
  expect(runEvalAssistant).toHaveBeenCalledWith(
    expect.objectContaining({
      knId: "kn-1",
      workspace: expect.objectContaining({
        activeSection: "repair",
        repairContext: session.context,
      }) as unknown,
    }),
  );
  expect(screen.getByRole("cell", { name: "string" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "integer" })).toBeTruthy();
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledOnce();
  expect(applyEvalRepair).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
  expect(confirm.mock.calls[0][0].title).toBe("确认修复「订单」？");
  await act(async () => {
    await confirm.mock.calls[0][0].onOk?.();
  });
  expect(applyEvalRepair).toHaveBeenCalledWith("kn-1", session, plan);
  expect(createM1Run).toHaveBeenCalledWith(
    "kn-1",
    { kind: "cases", case_ids: ["case-1"] },
    expect.any(String),
  );
  expect(await screen.findByText("本次修复已提交，原失败用例复测通过。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看复测结果" }));
  expect(view.onInspectRun).toHaveBeenCalledWith(completed);
});

it("never writes on cancellation and blocks repair when the original cases cannot run", async () => {
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  await act(async () => {
    await confirm.mock.calls[0][0].onCancel?.();
  });
  expect(applyEvalRepair).not.toHaveBeenCalled();
  vi.mocked(getM1RunCapabilities).mockResolvedValue(false);
  await act(async () => {
    await confirm.mock.calls[0][0].onOk?.();
  });
  expect(applyEvalRepair).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
  expect(await screen.findByText(/原失败用例当前无法复测，未执行修改/)).toBeTruthy();
});

it("retries only the retest with the same idempotency key after repair has been applied", async () => {
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  vi.mocked(createM1Run).mockRejectedValueOnce(new Error("lost response"));
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  await act(async () => {
    await confirm.mock.calls[0][0].onOk?.();
  });
  fireEvent.click(await screen.findByRole("button", { name: "重试复测" }));
  await waitFor(() => expect(createM1Run).toHaveBeenCalledTimes(2));
  expect(applyEvalRepair).toHaveBeenCalledOnce();
  expect(vi.mocked(createM1Run).mock.calls[0][2]).toBe(vi.mocked(createM1Run).mock.calls[1][2]);
});

it("shows manual-only plans without an apply button", async () => {
  vi.mocked(validateEvalRepairProposal).mockReturnValue({
    ...plan,
    changes: [],
    manual_steps: ["核实源数据并在原系统修正"],
  });
  renderPanel();
  expect(await screen.findByText("核实源数据并在原系统修正")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "确认修复并复测" })).toBeNull();
  expect(applyEvalRepair).not.toHaveBeenCalled();
});

it("asks once for a corrected plan after rejecting invalid model output, without applying it", async () => {
  vi.mocked(validateEvalRepairProposal).mockImplementationOnce(() => {
    throw new Error("EVAL_REPAIR_INVALID_PLAN");
  });
  renderPanel();
  await screen.findByRole("button", { name: "确认修复并复测" });
  expect(runEvalAssistant).toHaveBeenCalledTimes(2);
  expect(vi.mocked(runEvalAssistant).mock.calls[1][0].goal).toContain("不要猜测或绕过限制");
  expect(applyEvalRepair).not.toHaveBeenCalled();
});

it("does not label a repair resolved when retesting still fails", async () => {
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  vi.mocked(createM1Run).mockResolvedValue({ ...completed, quality_outcome: "fail" });
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  await act(async () => {
    await confirm.mock.calls[0][0].onOk?.();
  });
  expect(await screen.findByText("复测尚未全部通过，问题仍需处理。")).toBeTruthy();
  expect(screen.queryByText("本次修复已提交，原失败用例复测通过。")).toBeNull();
});

it("supports follow-up discussion and invalidates an old confirmation without executing chat instructions", async () => {
  const destroyed = vi.fn();
  const confirm = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({ destroy: destroyed, update: vi.fn() });
  const controller = createRef<EvalRepairController>();
  const onViewChange = vi.fn<(view: EvalRepairConversationView) => void>();
  render(
    <EvalRepairPanel
      networkId="kn-1"
      request={session.request}
      controllerRef={controller}
      onViewChange={onViewChange}
      onUpdated={vi.fn()}
      onInspectRun={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  const oldConfirmation = confirm.mock.calls[0][0];
  const next = { ...plan, answer: "本次仅处理 id，其他字段保持不变。", summary: "仅修正 id" };
  vi.mocked(runEvalAssistant).mockResolvedValue({
    answer: next.answer,
    repair: next,
    threadId: "thread-1",
  });
  vi.mocked(validateEvalRepairProposal).mockReturnValue(next);
  await act(() => {
    controller.current?.submit("只处理 id，其他字段不要修改");

    return Promise.resolve();
  });
  expect(await screen.findByText("仅修正 id")).toBeTruthy();
  expect(destroyed).toHaveBeenCalled();
  expect(vi.mocked(runEvalAssistant).mock.calls[1][0].workspace).toEqual(
    expect.objectContaining({
      repairPlan: plan,
      repairInstructions: expect.arrayContaining(["只处理 id，其他字段不要修改"]) as unknown,
    }),
  );
  expect(onViewChange.mock.calls.at(-1)?.[0].messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "只处理 id，其他字段不要修改" }),
      expect.objectContaining({ role: "assistant", content: next.answer }),
    ]),
  );
  await act(async () => {
    await oldConfirmation.onOk?.();
  });
  expect(applyEvalRepair).not.toHaveBeenCalled();
  await act(() => {
    controller.current?.submit("开始修复");

    return Promise.resolve();
  });
  expect(applyEvalRepair).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "确认修复并复测" }));
  expect(confirm).toHaveBeenCalledTimes(2);
  await act(async () => {
    await confirm.mock.calls[1][0].onOk?.();
  });
  expect(applyEvalRepair).toHaveBeenCalledWith("kn-1", session, next);
});

it("stops a revised analysis without reviving the previous executable plan", async () => {
  const controller = createRef<EvalRepairController>();
  render(
    <EvalRepairPanel
      networkId="kn-1"
      request={session.request}
      controllerRef={controller}
      onUpdated={vi.fn()}
      onInspectRun={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: "确认修复并复测" });
  let finish: ((value: Awaited<ReturnType<typeof runEvalAssistant>>) => void) | undefined;
  vi.mocked(runEvalAssistant).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(() => {
    controller.current?.submit("为什么要改 id？");

    return Promise.resolve();
  });
  expect(screen.queryByRole("button", { name: "确认修复并复测" })).toBeNull();
  act(() => controller.current?.stop());
  expect(vi.mocked(runEvalAssistant).mock.calls[1][0].signal?.aborted).toBe(true);
  await act(() => {
    finish?.({ answer: plan.summary, repair: plan });

    return Promise.resolve();
  });
  expect(screen.queryByRole("button", { name: "确认修复并复测" })).toBeNull();
  expect(applyEvalRepair).not.toHaveBeenCalled();
  expect(screen.getByText("已停止分析，尚未提交修改。可继续补充要求。")).toBeTruthy();
});

it("closes the confirmation immediately while preflight is pending and reports progress in the assistant", async () => {
  let release!: (available: boolean) => void;
  vi.mocked(getM1RunCapabilities).mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  const dialog = await screen.findByRole("dialog", { name: "确认修复「订单」？" });
  fireEvent.click(within(dialog).getByRole("button", { name: "开始修复" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "确认修复「订单」？" })).toBeNull(),
  );
  expect(screen.getByRole("status")).toHaveTextContent("正在提交已确认的修改");
  expect(applyEvalRepair).not.toHaveBeenCalled();
  expect(createM1Run).not.toHaveBeenCalled();
  await act(() => {
    release(false);

    return Promise.resolve();
  });
  expect(await screen.findByText(/原失败用例当前无法复测，未执行修改/)).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "确认修复「订单」？" })).toBeNull();
  expect(applyEvalRepair).not.toHaveBeenCalled();
});

it("returns immediately while work is pending and ignores repeated confirmation callbacks", async () => {
  const destroy = vi.fn();
  const confirm = vi.spyOn(Modal, "confirm").mockReturnValue({ destroy, update: vi.fn() });
  let release!: (available: boolean) => void;
  vi.mocked(getM1RunCapabilities).mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "确认修复并复测" }));
  const onOk = confirm.mock.calls[0][0].onOk;
  let operation: unknown;
  act(() => {
    operation = onOk?.();
  });
  expect(operation).toBeUndefined();
  expect(getM1RunCapabilities).toHaveBeenCalledOnce();
  await act(async () => {
    await onOk?.();
  });
  expect(getM1RunCapabilities).toHaveBeenCalledOnce();
  await act(async () => {
    release(true);
    await operation;
  });
  expect(applyEvalRepair).toHaveBeenCalledOnce();
  expect(createM1Run).toHaveBeenCalledOnce();
});

it("renders named execution references in repair prose while preserving machine IDs for verification", async () => {
  const named = {
    ...plan,
    answer: "请使用 caseRunId cr-1 复测。",
    summary: "依据 caseRunId cr-1 的失败修复。",
    manual_steps: ["确认 caseRunId cr-1 对应的原失败用例。"],
    changes: plan.changes.map((change) => ({
      ...change,
      reason: "依据 caseRunId cr-1 的类型证据。",
    })),
  };
  vi.mocked(validateEvalRepairProposal).mockReturnValue(named);
  renderPanel();
  await screen.findByRole("button", { name: "确认修复并复测" });
  expect(screen.getByText("依据 用例「原始判定」的执行记录 的失败修复。")).toBeTruthy();
  expect(screen.getByText("确认 用例「原始判定」的执行记录 对应的原失败用例。")).toBeTruthy();
  expect(screen.queryByText(/caseRunId cr-1/)).toBeNull();
  expect(named.changes[0].evidence_case_run_ids).toEqual(["cr-1"]);
});
