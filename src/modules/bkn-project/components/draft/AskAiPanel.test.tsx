/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { DraftObjectType } from "@/modules/bkn-project/types/draft";

const askMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  askAboutObjectType: askMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { AskAiPanel } from "./AskAiPanel";

const objectType = { id: "purchase_order", name: "采购订单" } as DraftObjectType;

const refusal = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

function renderPanel(canAdopt = true, adopted = true) {
  const onAdopt = vi.fn().mockResolvedValue(adopted);
  renderWithoutAntdStyles(
    <AskAiPanel canAdopt={canAdopt} objectType={objectType} onAdopt={onAdopt} projectId="p1" />,
  );
  return { onAdopt };
}

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("你的问题"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: /^提\s*问$/ }));
}

describe("AskAiPanel", () => {
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

  it("answers, and adopts the one change it suggests through the edit", async () => {
    askMock.mockResolvedValue({
      answer: "采购订单按 id 与 entry_id 识别每一行明细。",
      suggestion: {
        field: "identity",
        properties: ["id", "entry_id"],
        reason: "单独的 id 会重复。",
        value: "",
      },
    });
    const { onAdopt } = renderPanel();

    expect(screen.getByRole("button", { name: /^提\s*问$/ })).toBeDisabled();
    ask("  唯一标识选得对吗？ ");
    await waitFor(() =>
      expect(askMock).toHaveBeenCalledWith("p1", "purchase_order", "唯一标识选得对吗？"),
    );
    expect(
      await screen.findByText("采购订单按 id 与 entry_id 识别每一行明细。"),
    ).toBeInTheDocument();
    expect(screen.getByText("建议把唯一标识改为 id + entry_id")).toBeInTheDocument();
    expect(screen.getByText("单独的 id 会重复。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^采\s*纳$/ }));
    await waitFor(() =>
      expect(onAdopt).toHaveBeenCalledWith(expect.objectContaining({ field: "identity" })),
    );
    expect(await screen.findByRole("button", { name: "已采纳" })).toBeDisabled();
  });

  it("offers nothing to adopt without a suggestion, or where nothing may change", async () => {
    askMock.mockResolvedValueOnce({ answer: "描述已经写清楚了。", suggestion: null });
    renderPanel(false);
    ask("描述写得清楚吗？");
    expect(await screen.findByText("描述已经写清楚了。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^采\s*纳$/ })).toBeNull();
  });

  it("says why it could not answer, never by its code", async () => {
    askMock.mockRejectedValueOnce(refusal(504, "Draft.AskTimeout"));
    renderPanel();
    ask("这个对象类和供应商是什么关系？");
    expect(
      await screen.findByText("AI 回答超时，请稍后再试，或把问题问得具体一些。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AskTimeout|504/)).toBeNull();
  });

  it("says it in English", async () => {
    await i18n.changeLanguage("en-US");
    askMock.mockResolvedValueOnce({
      answer: "The name reads well.",
      suggestion: { field: "name", properties: [], reason: "", value: "Purchase order line" },
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Name?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(
      await screen.findByText('Suggests renaming it to "Purchase order line"'),
    ).toBeInTheDocument();
    await i18n.changeLanguage("zh-CN");
  });
});
