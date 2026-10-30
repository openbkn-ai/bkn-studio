/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { Editing, type SpecEditing } from "@/modules/bkn-project/components/requirements/citing";
import type { QuestionDev } from "@/modules/bkn-project/types/requirements";

const getQuestionDevMock = vi.hoisted(() => vi.fn());
const generateQuestionDevMock = vi.hoisted(() => vi.fn());
const editTestMock = vi.hoisted(() => vi.fn());
const deleteTestMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  deleteTest: deleteTestMock,
  editTest: editTestMock,
  generateQuestionDev: generateQuestionDevMock,
  getQuestionDev: getQuestionDevMock,
}));

import { GUIDANCE_POLL_MS } from "@/modules/bkn-project/services/requirements.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { QuestionDevPanel } from "./QuestionDevPanel";

/** As q1 of the sample project replied on 8081. */
function dev(extra: Partial<QuestionDev> = {}): QuestionDev {
  return {
    current: true,
    deletedTests: 0,
    error: "",
    guidance: "先以**客户编码**定位客户，再查销售订单。",
    leftOutTests: 0,
    noTestsReason: "",
    ontologyChanged: false,
    outOfScope: ["哪些销售订单需要升级处理？需要升级规则，文档未规定。"],
    status: "ready",
    tests: [
      {
        check: { outcome: "passed", reason: "" },
        edited: false,
        expect: "exists",
        id: "t1",
        kind: "paraphrase",
        text: "客户编码为 CUST-10001 的客户最近 30 天签订了哪些销售订单？",
      },
      {
        check: { outcome: "not_checked", reason: "same_record_needs_two_values" },
        edited: false,
        expect: "same_record",
        id: "t2",
        kind: "variant",
        text: "客户ID为 10001 的客户最近 30 天下了哪些销售订单？",
      },
      {
        check: { outcome: "failed", reason: "query_failed: vega-backend 500" },
        edited: true,
        expect: "not_exists",
        id: "t4",
        kind: "not_exist",
        text: "客户编码为 CUST-99999 的客户最近 30 天下了哪些销售订单？",
      },
    ],
    updateTime: 5,
    ...extra,
  };
}

const editing = {} as SpecEditing;

function renderPanel(owner = true) {
  return renderWithoutAntdStyles(
    <Editing.Provider value={owner ? editing : null}>
      <QuestionDevPanel projectId="p1" questionId="q1" />
    </Editing.Provider>,
  );
}

describe("QuestionDevPanel", () => {
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
    getQuestionDevMock.mockResolvedValue(dev());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each test with its check in plain words, the guidance and what lies beyond", async () => {
    renderPanel();

    expect(
      await screen.findByText("3 条，其中 1 条通过数据核对，发布后回归会问"),
    ).toBeInTheDocument();
    expect(screen.getByText("同义改写")).toBeInTheDocument();
    expect(screen.getByText("应查到记录")).toBeInTheDocument();
    expect(screen.getByText("通过")).toBeInTheDocument();
    expect(screen.getByText("未核对")).toBeInTheDocument();
    expect(screen.getByText("要核对是否为同一条记录，需要两个值")).toBeInTheDocument();
    expect(screen.getByText("不通过")).toBeInTheDocument();
    expect(screen.getByText("查询数据没有成功")).toBeInTheDocument();
    expect(screen.getByText("你改过")).toBeInTheDocument();
    expect(
      screen.getByText("哪些销售订单需要升级处理？需要升级规则，文档未规定。"),
    ).toBeInTheDocument();
    expect(screen.getByText("客户编码")).toBeInTheDocument();
    expect(screen.queryByText(/same_record|query_failed|vega|paraphrase/)).toBeNull();
  });

  it("says when the tests are no longer asked, or what they rest on changed", async () => {
    getQuestionDevMock.mockResolvedValueOnce(dev({ current: false, ontologyChanged: true }));
    const view = renderPanel();
    expect(
      await screen.findByText(
        "需求规格已重新起草或问题已改，回归不会问这些测试问法，建议重新生成。",
      ),
    ).toBeInTheDocument();
    view.unmount();

    getQuestionDevMock.mockResolvedValueOnce(dev({ ontologyChanged: true }));
    renderPanel();
    expect(
      await screen.findByText("问题用到的本体在生成之后有变化，建议重新生成。"),
    ).toBeInTheDocument();
  });

  it("generates the first time, and follows it until it is ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getQuestionDevMock.mockResolvedValueOnce(null).mockResolvedValue(dev());
    generateQuestionDevMock.mockResolvedValue(
      dev({ guidance: "", status: "generating", tests: [] }),
    );
    renderPanel();

    expect(await screen.findByText("还没有测试问法和开发指导。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成测试问法与开发指导" }));
    await waitFor(() => expect(generateQuestionDevMock).toHaveBeenCalledWith("p1", "q1"));
    expect(
      await screen.findByText("正在生成测试问法与开发指导，通常需要一两分钟。"),
    ).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(GUIDANCE_POLL_MS));
    expect(await screen.findByText("同义改写")).toBeInTheDocument();
  });

  it("edits a test's expectation, and removes one after asking", async () => {
    editTestMock.mockResolvedValue(dev({ updateTime: 6 }));
    deleteTestMock.mockResolvedValue(dev({ deletedTests: 1, updateTime: 7 }));
    renderPanel();
    await screen.findByText("同义改写");

    fireEvent.click(screen.getAllByRole("button", { name: /编\s*辑/ })[0]);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "期望结果" }));
    fireEvent.click(await screen.findByTitle("应查不到记录"));
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));
    await waitFor(() =>
      expect(editTestMock).toHaveBeenCalledWith("p1", "q1", "t1", { expect: "not_exists" }, 5),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /删\s*除/ })[1]);
    const [{ onOk }] = confirmMock.mock.calls[0] as [{ onOk: () => Promise<unknown> }];
    await onOk();
    // The edit moved the guidance on: the removal sends the version it replied.
    expect(deleteTestMock).toHaveBeenCalledWith("p1", "q1", "t2", 6);
    expect(await screen.findByText("你删除了 1 条")).toBeInTheDocument();
  });

  it("reads again when the tests changed since, and offers nothing to others", async () => {
    editTestMock.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Requirement.Stale" },
        status: 409,
      } as AxiosResponse),
    );
    const view = renderPanel();
    await screen.findByText("同义改写");
    fireEvent.click(screen.getAllByRole("button", { name: /编\s*辑/ })[0]);
    fireEvent.change(screen.getByLabelText("问法"), { target: { value: "改过的问法" } });
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));
    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "测试问法刚被修改过，已重新读取，请再改一次。",
      ),
    );
    await waitFor(() => expect(getQuestionDevMock).toHaveBeenCalledTimes(2));
    // The stale edit is not kept to be sent again.
    expect(screen.queryByLabelText("问法")).toBeNull();
    view.unmount();

    renderPanel(false);
    await screen.findAllByText("同义改写");
    expect(screen.queryByRole("button", { name: /编\s*辑/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "重新生成" })).toBeNull();
  });
});
