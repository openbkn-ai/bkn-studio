/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DataConnectDiscoverTaskDrawer } from "./DataConnectDiscoverTaskDrawer";
import { dataConnectEnUS } from "../locales/en-US";
import { dataConnectZhCN } from "../locales/zh-CN";

const getTask = vi.hoisted(() => vi.fn());
vi.mock("@/modules/data-connect/services/discover.service", () => ({
  getDataConnectDiscoverTask: getTask,
}));

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

async function showTask(language: string, overrides: Record<string, unknown> = {}) {
  const result = {
    catalogId: "c1",
    failedCount: 1,
    skippedCount: 0,
    newCount: 0,
    restoredCount: 0,
    staleCount: 0,
    unchangedCount: 0,
    updatedCount: 0,
    message: "Exact count finished: 0 counted, 1 failed, 0 skipped",
    failures: [
      {
        resourceId: "r1",
        resourceName: "Orders",
        code: "source_memory_limit",
        message: "Safe source failure",
      },
    ],
  };
  getTask.mockResolvedValue({
    id: "t1",
    catalogId: "c1",
    strategy: "count_only",
    status: "failed",
    progress: 100,
    queuePriority: 20,
    triggerType: "manual",
    creatorName: "User",
    createTime: 0,
    result,
    ...overrides,
  });
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: {
      "en-US": { translation: dataConnectEnUS },
      "zh-CN": { translation: dataConnectZhCN },
    },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <DataConnectDiscoverTaskDrawer
        catalogs={[]}
        schedules={[]}
        onClose={vi.fn()}
        open
        taskId="t1"
      />
    </I18nextProvider>,
  );
}

describe("DataConnectDiscoverTaskDrawer exact count failures", () => {
  it.each(["en-US", "zh-CN"])(
    "explains resource counts and shows localized failures in %s",
    async (language) => {
      await showTask(language);
      const locale = language === "zh-CN" ? dataConnectZhCN : dataConnectEnUS;
      expect(await screen.findByText("Orders")).toBeInTheDocument();
      expect(screen.getByText("r1")).toBeInTheDocument();
      expect(screen.getByText(locale.dataConnect.discoverResultCounted)).toBeInTheDocument();
      expect(screen.getByText(locale.dataConnect.discoverCountExplanation)).toBeInTheDocument();
      expect(
        screen.getByText(locale.dataConnect.discoverFailureReasons.source_memory_limit),
      ).toBeInTheDocument();
    },
  );

  it("shows failures even when a batch is partially completed and supports future categories", async () => {
    await showTask("en-US", {
      status: "completed",
      result: {
        catalogId: "c1",
        newCount: 0,
        staleCount: 0,
        unchangedCount: 0,
        restoredCount: 0,
        updatedCount: 1,
        failedCount: 1,
        skippedCount: 0,
        message: "partial",
        failures: [
          {
            resourceId: "r2",
            resourceName: "Items",
            code: "future_code",
            message: "Safe future failure",
          },
        ],
      },
    });
    expect(await screen.findByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Safe future failure")).toBeInTheDocument();
    expect(
      screen.getByText(dataConnectEnUS.dataConnect.discoverPartialCompletion),
    ).toBeInTheDocument();
  });

  it("renders historical results without failure details", async () => {
    await showTask("en-US", {
      result: {
        catalogId: "c1",
        newCount: 0,
        staleCount: 0,
        unchangedCount: 0,
        restoredCount: 0,
        updatedCount: 0,
        failedCount: 1,
        message: "Historical result",
      },
    });
    expect(await screen.findByText(/Historical result/)).toBeInTheDocument();
    expect(
      screen.queryByText(dataConnectEnUS.dataConnect.discoverFailureResource),
    ).not.toBeInTheDocument();
  });
});
