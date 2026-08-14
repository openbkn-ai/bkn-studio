/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("discover.service · task status contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves cancelled tasks returned by Vega", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            catalog_id: "catalog-1",
            create_time: 100,
            finish_time: 300,
            id: "task-1",
            last_progress_time: 250,
            start_time: 200,
            status: "cancelled",
          },
        ],
        total_count: 1,
      },
    });
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({
      page: 1,
      pageSize: 20,
      status: "cancelled",
    });

    expect(result.items[0]?.status).toBe("cancelled");
    expect(result.items[0]?.createTime).toBe(100);
    expect(result.items[0]?.startTime).toBe(200);
    expect(result.items[0]?.finishTime).toBe(300);
    expect(result.items[0]?.lastProgressTime).toBe(250);
    expect(result.items[0]).not.toHaveProperty("startTimeValue");
    expect(result.items[0]).not.toHaveProperty("finishTimeValue");
    expect(getMock).toHaveBeenCalledOnce();
    expect(getMock.mock.calls[0]?.[0]).toBe("/vega-backend/v1/discover-tasks");
    const config = getMock.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(config.params.status).toBe("cancelled");
  });
});

describe("discover.service · mock task sorting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sorts by the selected lifecycle timestamp", async () => {
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({
      direction: "asc",
      page: 1,
      pageSize: 20,
      sort: "last_progress_time",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "discover-task-1003",
      "discover-task-1001",
      "discover-task-1002",
    ]);
  });
});
