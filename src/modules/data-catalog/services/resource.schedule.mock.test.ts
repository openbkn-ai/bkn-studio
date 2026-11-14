/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_USE_MOCK", "true");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function seedDeletionFixture() {
  const db = await import("./mock-db");
  const resource = {
    ...db.mockResources.find((item) => item.id === "res-customers")!,
    id: "schedule-delete-resource",
  };
  const plan = { ...db.mockBuildSchedules[0], id: "schedule-delete-plan", resourceId: resource.id };
  const task = {
    ...db.mockBuildTasks[0],
    id: "schedule-delete-task",
    resourceId: resource.id,
    catalogId: resource.catalogId,
    scheduleId: plan.id,
    triggerType: "scheduled" as const,
    status: "completed" as const,
  };
  db.mockResources.push(resource);
  db.mockBuildSchedules.push(plan);
  db.mockBuildTasks.push(task);
  return { db, resource, plan, task };
}

describe("Resource deletion with build schedules", () => {
  it("deletes only bound plans and retains Task history and source filtering after deleting Resource", async () => {
    const { db, resource, plan, task } = await seedDeletionFixture();
    const otherPlan = db.mockBuildSchedules[0];
    const { deleteCatalogResource } = await import("./resource.service");
    const deleting = deleteCatalogResource(resource.id);
    await vi.runAllTimersAsync();
    await deleting;
    expect(db.mockResources.some((item) => item.id === resource.id)).toBe(false);
    expect(db.mockBuildSchedules.some((item) => item.id === plan.id)).toBe(false);
    expect(db.mockBuildSchedules).toContain(otherPlan);
    expect(db.mockBuildTasks).toContain(task);
    expect(task.scheduleId).toBe(plan.id);
    const { listBuildTaskPage } = await import("./build-task.service");
    const listing = listBuildTaskPage({
      catalogId: resource.catalogId,
      scheduleId: plan.id,
      triggerType: "scheduled",
    });
    await vi.runAllTimersAsync();
    expect(await listing).toMatchObject({
      total: 1,
      items: [{ id: task.id, scheduleId: plan.id }],
    });
  });

  it("keeps resources, schedules and Tasks when the state condition no longer holds", async () => {
    const { db, resource, plan, task } = await seedDeletionFixture();
    const { deleteCatalogResource } = await import("./resource.service");
    await expect(deleteCatalogResource(resource.id, { onlyIfStale: true })).rejects.toMatchObject({
      response: { status: 409 },
    });
    expect(db.mockResources).toContain(resource);
    expect(db.mockBuildSchedules).toContain(plan);
    expect(db.mockBuildTasks).toContain(task);
  });

  it("does not remove plans if the Resource no longer exists", async () => {
    const { db, resource, plan } = await seedDeletionFixture();
    db.mockResources.splice(db.mockResources.indexOf(resource), 1);
    const { deleteCatalogResource } = await import("./resource.service");
    await expect(deleteCatalogResource(resource.id)).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(db.mockBuildSchedules).toContain(plan);
  });
});
