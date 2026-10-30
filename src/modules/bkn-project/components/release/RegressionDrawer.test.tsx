/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { Regression } from "@/modules/bkn-project/types/release";

const getRegressionMock = vi.hoisted(() => vi.fn());
const runRegressionMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => new Map(),
}));

vi.mock("@/modules/bkn-project/services/release.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/release.service")>()),
  getRegression: getRegressionMock,
  runRegression: runRegressionMock,
}));

import { REGRESSION_POLL_MS } from "@/modules/bkn-project/services/release.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RegressionDrawer } from "./RegressionDrawer";

/** As v1.0.2 of the sample project ran: the tests of q1 pass, q7 cannot be answered. */
function regression(extra: Partial<Regression> = {}): Regression {
  return {
    attempt: 1,
    error: "",
    finishTime: 2,
    networkId: "n_v1_0_2",
    questions: [
      {
        id: "q1",
        tests: [
          { expect: "exists", id: "t1", text: "客户 CUST-10001 最近 30 天下了哪些订单？" },
          { expect: "not_exists", id: "t3", text: "客户 CUST-99999 最近 30 天下了哪些订单？" },
        ],
        text: "某个客户最近 30 天下了哪些销售订单？",
      },
      { id: "q7", tests: [], text: "哪些采购订单需要采购经理审批？" },
      { id: "q8", tests: [], text: "哪些产品用到了 P-100？" },
    ],
    results: [
      {
        answer: "共 **6** 条订单。",
        errorCode: "",
        missing: [],
        outcome: "passed",
        questionId: "q1",
        reason: "回答列出了该客户在时间窗内的订单。",
        testId: "t1",
        toolStatuses: ["succeeded", "succeeded", "failed"],
      },
      {
        answer: "没有这个客户。",
        errorCode: "",
        missing: [],
        outcome: "passed",
        questionId: "q1",
        reason: "确认不存在该客户。",
        testId: "t3",
        toolStatuses: ["succeeded"],
      },
      {
        answer: "知识网络里没有审批规则。",
        errorCode: "",
        missing: [],
        outcome: "not_answered",
        questionId: "q7",
        reason: "网络缺少审批规则和采购经理角色，无法判定哪些订单需要审批。",
        testId: "",
        toolStatuses: [],
      },
      {
        answer: "",
        errorCode: "BknAgent.NotFound",
        missing: [{ id: "bom", kind: "object_type", name: "物料BOM" }],
        outcome: "missing",
        questionId: "q8",
        reason: "",
        testId: "",
        toolStatuses: [],
      },
    ],
    runnerId: "me",
    startTime: Date.parse("2026-10-29T17:00:00"),
    status: "not_passed",
    version: "1.0.2",
    ...extra,
  };
}

function renderDrawer(canRun = true) {
  return renderWithoutAntdStyles(
    <RegressionDrawer
      canRun={canRun}
      networkId="n_v1_0_2"
      onClose={vi.fn()}
      projectId="p1"
      version="1.0.2"
    />,
  );
}

describe("RegressionDrawer", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each question's tests and verdicts in business words, never codes", async () => {
    getRegressionMock.mockResolvedValue(regression());
    renderDrawer();

    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("未通过")).toBeInTheDocument();
    expect(drawer.getByText("2 / 4 次提问通过")).toBeInTheDocument();
    expect(drawer.getByText("2026/10/29 17:00 开始，由你运行")).toBeInTheDocument();

    expect(drawer.getByText("客户 CUST-10001 最近 30 天下了哪些订单？")).toBeInTheDocument();
    expect(drawer.getByText("应查到记录")).toBeInTheDocument();
    expect(drawer.getByText("应查不到记录")).toBeInTheDocument();
    expect(drawer.getAllByText("通过")).toHaveLength(2);

    // A question that cannot be answered says why, as the judge put it.
    expect(drawer.getByText("哪些采购订单需要采购经理审批？")).toBeInTheDocument();
    expect(drawer.getByText("回答不了")).toBeInTheDocument();
    expect(
      drawer.getByText("网络缺少审批规则和采购经理角色，无法判定哪些订单需要审批。"),
    ).toBeInTheDocument();
    expect(drawer.getByText("本体中缺少：物料BOM")).toBeInTheDocument();
    expect(drawer.getAllByText("按原问题提问")).toHaveLength(2);
    expect(drawer.queryByText(/not_answered|BknAgent|cannot_answer|q7/)).toBeNull();

    fireEvent.click(drawer.getAllByText("查看回答")[0]);
    expect(await drawer.findByText("6")).toBeInTheDocument();
    expect(drawer.getByText("回答时查询了 3 次，其中 1 次没有成功")).toBeInTheDocument();
  });

  it("follows a running regression the owner started again until it ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getRegressionMock.mockResolvedValueOnce(regression()).mockResolvedValue(regression());
    runRegressionMock.mockResolvedValue(regression({ results: [], status: "running" }));
    renderDrawer();

    const drawer = within(await screen.findByRole("dialog"));
    await drawer.findByText("未通过");
    fireEvent.click(screen.getByRole("button", { name: "重新运行" }));
    await waitFor(() => expect(runRegressionMock).toHaveBeenCalledWith("p1", "n_v1_0_2"));
    expect(await drawer.findByText("运行中")).toBeInTheDocument();
    expect(drawer.getAllByText("提问中").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "重新运行" })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(REGRESSION_POLL_MS));
    expect(await drawer.findByText("未通过")).toBeInTheDocument();
    const reads = getRegressionMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(REGRESSION_POLL_MS * 2));
    expect(getRegressionMock.mock.calls.length).toBe(reads);
  });

  it("says when there is none yet or a run failed as a whole, and offers no run to others", async () => {
    getRegressionMock.mockResolvedValueOnce(null);
    const view = renderDrawer(false);
    expect(await screen.findByText("这个版本还没有回归结果。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新运行" })).toBeNull();
    view.unmount();

    getRegressionMock.mockResolvedValueOnce(
      regression({ error: "interrupted", results: [], status: "failed" }),
    );
    renderDrawer();
    expect(await screen.findByText("回归被中断了，可以重新运行。")).toBeInTheDocument();
    expect(screen.getByText("没能跑完")).toBeInTheDocument();
  });

  it("says only when a run started on its own began, naming no one", async () => {
    getRegressionMock.mockResolvedValue(regression({ runnerId: "" }));
    renderDrawer();
    expect(await screen.findByText("2026/10/29 17:00 开始")).toBeInTheDocument();
    expect(screen.queryByText(/其他成员/)).toBeNull();
  });
});
