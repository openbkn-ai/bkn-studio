/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { LlmMonitorDrawer } from "@/modules/model-resources/components/models/ModelModals";
import { modelResourcesEnUS } from "@/modules/model-resources/locales/en-US";
import { modelResourcesZhCN } from "@/modules/model-resources/locales/zh-CN";
import { getLlmModelMonitor } from "@/modules/model-resources/services/llm.service";
import type { LlmModel, LlmMonitorData } from "@/modules/model-resources/types/llm";

vi.mock("@/modules/model-resources/services/llm.service", () => ({
  getLlmModelMonitor: vi.fn(),
}));

const record: LlmModel = {
  modelId: "monitor-model",
  modelName: "Monitor model",
  modelType: "llm",
  modelSeries: "tome",
};

async function renderMonitor(locale: string, data: LlmMonitorData) {
  vi.mocked(getLlmModelMonitor).mockResolvedValue(data);
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    showSupportNotice: false,
    resources: {
      "en-US": { translation: modelResourcesEnUS },
      "zh-CN": { translation: modelResourcesZhCN },
    },
    interpolation: { escapeValue: false },
  });

  render(
    <I18nextProvider i18n={i18n}>
      <LlmMonitorDrawer onClose={vi.fn()} open record={record} />
    </I18nextProvider>,
  );
}

describe("LlmMonitorDrawer metric units", () => {
  it.each([
    ["en-US", "Time to first token", "Time from request to the first generated token, in seconds"],
    ["zh-CN", "首 Token 耗时", "从发送请求到生成首个 Token 的耗时，单位：秒"],
  ])("shows seconds and token rates in %s", async (locale, title, description) => {
    await renderMonitor(locale, {
      averageFirstTokenTime: [
        { time: "10/23 15:34", value: 0.25 },
        { time: "10/23 15:35", value: 0 },
      ],
      outputTokenSpeed: [{ time: "10/23 15:34", value: 12.5 }],
      totalTokenSpeed: [{ time: "10/23 15:34", value: 30 }],
    });

    expect(await screen.findByText("10/23 15:34: 0.25 s")).toBeInTheDocument();
    expect(screen.getByText("10/23 15:35: 0 s")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByText("10/23 15:34: 12.5 tokens/s")).toBeInTheDocument();
    expect(screen.getByText("10/23 15:34: 30 tokens/s")).toBeInTheDocument();
    expect(getLlmModelMonitor).toHaveBeenCalledWith(record.modelId);
  });

  it("keeps empty metrics as placeholders without units", async () => {
    await renderMonitor("en-US", {
      averageFirstTokenTime: [],
      outputTokenSpeed: [],
      totalTokenSpeed: [],
    });

    const heading = await screen.findByRole("heading", { name: "Time to first token" });
    expect(within(heading.parentElement!).getByText("--")).toBeInTheDocument();
    expect(screen.getAllByText("--")).toHaveLength(3);
    expect(screen.queryByText(/--\s+(s|tokens\/s)/)).not.toBeInTheDocument();
  });
});
