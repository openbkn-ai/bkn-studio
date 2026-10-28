/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ModelQuota, UserQuotaRecord } from "../types/quota";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  quotas: [] as ModelQuota[],
  users: [] as UserQuotaRecord[],
}));
vi.mock("@/framework/request/http", () => ({ http: { get: mocks.get, post: mocks.post } }));
vi.mock("./mock/fixtures", () => ({
  mockAssignableUsers: [],
  mockModelQuotas: mocks.quotas,
  mockUserQuotas: mocks.users,
}));
vi.mock("@/modules/system-admin/services/admin.service", () => ({ listUsersPage: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_USE_MOCK", "false");
  mocks.quotas.length = 0;
  mocks.users.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

const quota: ModelQuota = {
  id: "q1",
  confId: "q1",
  modelId: "m1",
  modelName: "Test model",
  model: "test",
  inputTokens: 10,
  outputTokens: 2,
  billingType: 1,
  numType: [1, 4],
  priceType: ["thousand", "thousand"],
};
const user: UserQuotaRecord = {
  userId: "u1",
  userName: "Test user",
  modelQuotaId: "q1",
  inputTokens: 1,
  outputTokens: 100,
  numType: [1, 1],
  inputsLeft: 992,
};

describe("user quota token contracts", () => {
  it("keeps raw remaining tokens separate from configured quotas and consumed balances", async () => {
    mocks.get.mockResolvedValue({
      data: {
        input_tokens_remain: 9000,
        output_tokens_remain: 1900000,
        res: [
          {
            user_id: "u1",
            user_name: "Test user",
            model_quota_id: "q1",
            input_tokens: 1,
            output_tokens: 100,
            num_type: [1, 1],
            inputs_left: 992,
          },
        ],
      },
    });
    const { listUserQuotas, saveUserQuotas } = await import("./quota.service");
    const result = await listUserQuotas("q1");
    expect(result.inputTokensRemain).toBe(9000);
    expect(result.outputTokensRemain).toBe(1900000);
    expect(result.items[0]).toMatchObject({ inputTokens: 1, inputsLeft: 992, numType: [1, 1] });
    mocks.post.mockResolvedValue({ data: { res: true } });
    await saveUserQuotas([{ ...user, inputTokens: 1 }]);
    expect(mocks.post).toHaveBeenCalledWith("/mf-model-manager/v1/user-quota", {
      list: [
        {
          user_id: "u1",
          user_name: "Test user",
          model_quota_id: "q1",
          input_tokens: 1,
          output_tokens: 100,
          num_type: [1, 1],
        },
      ],
    });
  });

  it("returns raw tokens in mock mode, accounting for independently selected units", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    mocks.quotas.push({ ...quota });
    mocks.users.push({ ...user });
    const { listUserQuotas } = await import("./quota.service");
    const result = await listUserQuotas("q1");
    expect(result.inputTokensRemain).toBe(9000);
    expect(result.outputTokensRemain).toBe(1900000);
    expect(result.items[0].inputsLeft).toBe(992);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("keeps unified output at zero and preserves unconfigured mock quotas", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    mocks.quotas.push({ ...quota, billingType: 0, inputTokens: -1 });
    const { listUserQuotas } = await import("./quota.service");
    expect(await listUserQuotas("q1")).toMatchObject({
      inputTokensRemain: -1,
      outputTokensRemain: 0,
    });
    expect(await listUserQuotas("missing")).toMatchObject({
      inputTokensRemain: 0,
      outputTokensRemain: 0,
    });
  });
});
