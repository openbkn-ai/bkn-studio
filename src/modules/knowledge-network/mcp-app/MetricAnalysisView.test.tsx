/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ObjectMetricDataV1 } from "@/modules/knowledge-network/types/object-metric";

import { MetricAnalysisView } from "./MetricAnalysisView";
import { metricCell } from "./metric-cell";

vi.mock("@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel", () => ({
  ObjectMetricAnalysisPanel: ({ resultTable }: { resultTable: React.ReactNode }) => (
    <section>{resultTable}</section>
  ),
}));

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => vi.unstubAllGlobals());
afterEach(async () => {
  await i18n.changeLanguage("zh-CN");
});

const result: ObjectMetricDataV1 = {
  model: {
    metric_id: "inventory_available",
    version: 1,
    name: "库存可用量",
    owner_object_type_id: "stock",
    output_shape: "grouped",
    value: {
      physical_type: "decimal",
      semantic_type: "measure",
      unit: { system: "registered", quantity_kind: "count", code: "piece", scale_factor: 1 },
    },
  },
  entries: [
    {
      dimensions: { warehouse: "苏州仓" },
      value: "53156928.920000000000000001",
      status: "ok",
      bucket_key: "opaque-key",
      available_actions: ["participants"],
    },
  ],
  status: "partial",
  total_count: 29,
  next_cursor: "opaque-next-page",
  warnings: ["结果被截断"],
  overall_ms: 42,
};

describe("MetricAnalysisView", () => {
  it("updates result labels when the MCP host changes locale", async () => {
    render(<MetricAnalysisView onNextPage={vi.fn()} result={result} />);
    expect(screen.getByRole("button", { name: "加载下一页" })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    expect(screen.getByRole("button", { name: "Load next page" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Metric value" })).toBeInTheDocument();
    expect(screen.getByText(/Total 29/)).toBeInTheDocument();
  });

  it("preserves exact decimal values and exposes status, unit, warnings and pagination", () => {
    const onNextPage = vi.fn();
    const exactResult = structuredClone(result);
    exactResult.entries[0].value = 53156928.92;
    exactResult.entries[0].display_value = "53156928.920000000000000001";
    render(<MetricAnalysisView onNextPage={onNextPage} result={exactResult} />);

    expect(screen.getByText("53156928.920000000000000001")).toBeInTheDocument();
    expect(screen.getByText("结果被截断")).toBeInTheDocument();
    expect(screen.getByText(/总数 29/)).toBeInTheDocument();
    expect(screen.getByText(/单位 piece/)).toBeInTheDocument();
    expect(screen.getAllByText("partial").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "加载下一页" }));
    expect(onNextPage).toHaveBeenCalledOnce();
  });

  it("uses the selected server bucket key for participant drill-through", async () => {
    const onParticipants = vi.fn().mockResolvedValue({
      participants: [{ instance_identity: { stock_id: "s-1" }, role: "owner" }],
      evaluated_at: 1,
      status: "ok",
    });
    render(<MetricAnalysisView onParticipants={onParticipants} result={result} />);

    fireEvent.click(screen.getByRole("button", { name: "查看参与实例" }));
    await waitFor(() =>
      expect(onParticipants).toHaveBeenCalledWith(
        expect.objectContaining({ bucket_key: "opaque-key" }),
        undefined,
      ),
    );
    expect(await screen.findByText('{"stock_id":"s-1"}')).toBeInTheDocument();
  });

  it("ignores a participant response after the modal closes and opens for another row", async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const onParticipants = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockRejectedValueOnce(new Error("second row failed"));
    const twoRows = structuredClone(result);
    twoRows.entries.push({ ...twoRows.entries[0], bucket_key: "second-row" });
    render(<MetricAnalysisView onParticipants={onParticipants} result={twoRows} />);

    fireEvent.click(screen.getAllByRole("button", { name: "查看参与实例" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(async () => {
      resolveFirst({
        participants: [{ instance_identity: { stock_id: "stale" }, role: "owner" }],
        status: "ok",
      });
      await first;
    });
    fireEvent.click(screen.getAllByRole("button", { name: "查看参与实例" })[1]);
    expect(await screen.findByText("second row failed")).toBeInTheDocument();
    expect(screen.queryByText('{"stock_id":"stale"}')).not.toBeInTheDocument();
  });
});

describe("metricCell", () => {
  it("does not round string decimals", () => {
    expect(metricCell("100508026.490000000000000001")).toBe("100508026.490000000000000001");
  });
});
