/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/framework/request/http", () => ({ http: { get, post } }));
const raw = {
  available: true,
  network_id: "network",
  state: "attention",
  revision: 7,
  can_manage: true,
  can_release: true,
  can_discard: true,
  files: 5,
  changed: 2,
  removed: 1,
  reused: 3,
  completed: 0,
  pending_links: 0,
  pending_fields: 0,
  pending_facts: 0,
  update_time: 1,
  estimate: { reasons: ["duration_unknown"] },
  limits: { max_changed_percent: 20, max_removed_percent: 10, max_duration_millis: 600000 },
};
async function service(mock = "false") {
  vi.stubEnv("VITE_USE_MOCK", mock);
  vi.resetModules();
  return import("./kb-refresh.service");
}
describe("knowledge refresh transport", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());
  it("keeps unknown estimates unknown and excludes private backend fields", async () => {
    const api = await service();
    get.mockResolvedValue({ data: { ...raw, private_hold: "secret" } });
    const status = await api.getKnowledgeRefresh("lineage/1");
    expect(get).toHaveBeenCalledWith("/bkn-project/v1/lineages/lineage%2F1/kb-refresh", {
      skipErrorToast: true,
    });
    expect(status).toMatchObject({
      estimatedMillis: null,
      reviewReasons: ["duration_unknown"],
      canManage: true,
    });
    expect(status).not.toHaveProperty("private_hold");
  });
  it("binds every command to the exact observed version and revision", async () => {
    const api = await service();
    post.mockResolvedValue({ data: raw });
    for (const action of ["check", "release", "discard"] as const) {
      await api.commandKnowledgeRefresh("lineage", action, { networkId: "network", revision: 7 });
      expect(post).toHaveBeenLastCalledWith(
        "/bkn-project/v1/lineages/lineage/kb-refresh",
        { action, network_id: "network", revision: 7 },
        { skipErrorToast: true },
      );
    }
  });
  it("does not mask permission or source failures as an absent feature", async () => {
    const api = await service();
    for (const code of [403, 503]) {
      const error = new AxiosError("private backend detail", undefined, undefined, undefined, {
        status: code,
      } as AxiosResponse);
      get.mockRejectedValue(error);
      await expect(api.getKnowledgeRefresh("lineage")).rejects.toBe(error);
    }
    for (const code of [404, 409]) {
      get.mockRejectedValue(
        new AxiosError("absent", undefined, undefined, undefined, {
          status: code,
        } as AxiosResponse),
      );
      await expect(api.getKnowledgeRefresh("lineage")).resolves.toBeNull();
    }
  });
  it("does not invent mock progress or access the backend", async () => {
    const api = await service("true");
    await expect(api.getKnowledgeRefresh("lineage")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
