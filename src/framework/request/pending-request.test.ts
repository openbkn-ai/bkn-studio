/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPendingRequest } from "./pending-request";

const config = vi.hoisted(() => ({
  apiBaseUrl: "/api",
  locale: "zh-CN",
  token: "first-session",
}));
vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({
    ...config,
    auth: { tokenManager: { getAccessToken: () => config.token } },
  }),
}));

beforeEach(() => {
  config.apiBaseUrl = "/api";
  config.locale = "zh-CN";
  config.token = "first-session";
});

describe("pending reads", () => {
  it("shares concurrent reads but reloads after settlement", async () => {
    const run = createPendingRequest<number>();
    const read = vi.fn().mockResolvedValue(1);
    const first = run("kn", read);
    expect(run("kn", read)).toBe(first);
    await first;
    expect(read).toHaveBeenCalledTimes(1);
    await run("kn", read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not combine different resource queries", async () => {
    const run = createPendingRequest<number>();
    const read = vi.fn().mockResolvedValue(1);
    await Promise.all([run("kn/page1", read), run("kn/page2", read)]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["token", "locale", "apiBaseUrl"] as const)(
    "does not share requests after a %s change",
    async (field) => {
      const run = createPendingRequest<number>();
      let finishFirst!: (value: number) => void;
      const first = run(
        "kn",
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      );
      await Promise.resolve();
      config[field] = "changed";
      const next = run("kn", () => Promise.resolve(2));
      expect(next).not.toBe(first);
      finishFirst(1);
      expect(await first).toBe(1);
      expect(await next).toBe(2);
    },
  );

  it("allows a failed request to be retried", async () => {
    const run = createPendingRequest<number>();
    const read = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(2);
    await expect(run("kn", read)).rejects.toThrow("unavailable");
    expect(await run("kn", read)).toBe(2);
  });

  it("an older session finishing cannot remove a newer pending request", async () => {
    const run = createPendingRequest<number>();
    let finishFirst!: (value: number) => void;
    let finishNext!: (value: number) => void;
    const first = run(
      "kn",
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    await Promise.resolve();
    config.token = "next-session";
    const next = run(
      "kn",
      () =>
        new Promise((resolve) => {
          finishNext = resolve;
        }),
    );
    await Promise.resolve();
    finishFirst(1);
    await first;
    expect(run("kn", () => Promise.resolve(3))).toBe(next);
    finishNext(2);
    await next;
  });
});
