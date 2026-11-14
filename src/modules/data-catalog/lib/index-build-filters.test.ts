/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applyIndexBuildListFilters,
  applyResourceIndexView,
  isExplicitResourceIndexView,
  readIndexBuildListFilters,
  readResourceIndexView,
} from "@/modules/data-catalog/lib/index-build-filters";

describe("index build list filters", () => {
  it("restores a schedule task link without losing existing list filters", () => {
    const params = new URLSearchParams(
      "tab=index-build&schedule_id=deleted-plan&trigger_type=scheduled&mode=batch&execute_type=incremental&status=failed,completed&catalogId=old&resourceId=old",
    );
    const filters = readIndexBuildListFilters(params);
    expect(filters).toMatchObject({
      scheduleId: "deleted-plan",
      triggerType: "scheduled",
      mode: "batch",
      executeType: "incremental",
      statuses: ["failed", "completed"],
    });
    const updated = applyIndexBuildListFilters(params, { ...filters, executeType: "full" });
    expect(updated.get("schedule_id")).toBe("deleted-plan");
    expect(updated.get("trigger_type")).toBe("scheduled");
    expect(updated.get("execute_type")).toBe("full");
    expect(updated.get("mode")).toBe("batch");
    expect(updated.get("status")).toBe("failed,completed");
    expect(updated.get("tab")).toBe("index-build");
    expect(updated.has("catalogId")).toBe(false);
    expect(updated.has("resourceId")).toBe(false);
  });

  it.each(["manual", "scheduled"])("accepts %s origins and trims schedule IDs", (triggerType) => {
    const filters = readIndexBuildListFilters(
      new URLSearchParams({ schedule_id: " plan-1 ", trigger_type: triggerType }),
    );
    expect(filters.scheduleId).toBe("plan-1");
    expect(filters.triggerType).toBe(triggerType);
  });

  it("ignores invalid or empty origin filters and clears them without dropping other filters", () => {
    const invalid = readIndexBuildListFilters(
      new URLSearchParams("trigger_type=automatic&schedule_id=%20%20"),
    );
    expect(invalid.triggerType).toBeUndefined();
    expect(invalid.scheduleId).toBeUndefined();
    const params = new URLSearchParams(
      "tab=index-build&schedule_id=old-plan&trigger_type=scheduled&mode=streaming&status=running",
    );
    const cleared = applyIndexBuildListFilters(params, {
      ...readIndexBuildListFilters(params),
      scheduleId: undefined,
      triggerType: undefined,
    });
    expect(cleared.has("schedule_id")).toBe(false);
    expect(cleared.has("trigger_type")).toBe(false);
    expect(cleared.get("mode")).toBe("streaming");
    expect(cleared.get("status")).toBe("running");
    expect(cleared.get("tab")).toBe("index-build");
  });

  it("ignores and clears retired catalog and resource filters", () => {
    const filters = readIndexBuildListFilters(
      new URLSearchParams("catalogId=cat-001&resourceId=res-001&mode=batch"),
    );

    expect(filters).toEqual({ executeType: undefined, mode: "batch", statuses: [] });
    expect(
      applyIndexBuildListFilters(
        new URLSearchParams("catalogId=cat-001&resourceId=res-001"),
        filters,
      ).toString(),
    ).toBe("mode=batch");
  });

  it("persists a valid execution-type filter and ignores an invalid value", () => {
    expect(readIndexBuildListFilters(new URLSearchParams("execute_type=incremental"))).toEqual({
      executeType: "incremental",
      mode: undefined,
      statuses: [],
    });
    expect(readIndexBuildListFilters(new URLSearchParams("execute_type=streaming"))).toEqual({
      executeType: undefined,
      mode: undefined,
      statuses: [],
    });
    expect(
      applyIndexBuildListFilters(new URLSearchParams(), {
        executeType: "full",
        mode: undefined,
        statuses: [],
      }).toString(),
    ).toBe("execute_type=full");
  });
});

describe("readResourceIndexView", () => {
  it("preserves schedule deep links and removes obsolete actions when switching index views", () => {
    expect(readResourceIndexView("index", "schedules")).toBe("schedules");
    expect(isExplicitResourceIndexView("schedules")).toBe(true);
    const next = applyResourceIndexView(
      new URLSearchParams("tab=index&view=tasks&action=start&keep=1"),
      "schedules",
    );
    expect(next.get("view")).toBe("schedules");
    expect(next.get("tab")).toBe("index");
    expect(next.get("keep")).toBe("1");
    expect(next.has("action")).toBe(false);
    expect(readResourceIndexView("index", "unknown")).toBe("config");
    expect(readResourceIndexView("index", "configure")).toBe("config");
    expect(readResourceIndexView("index", "overview")).toBe("tasks");
  });
  it("opens configuration when the data-index sub-tab is not specified", () => {
    expect(readResourceIndexView("index", null)).toBe("config");
  });

  it("preserves an explicitly requested task view", () => {
    expect(readResourceIndexView("index", "tasks")).toBe("tasks");
  });
});
