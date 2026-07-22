/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: {
    get: getMock,
  },
}));

import { getResourceOperations } from "@/modules/model-resources/services/authorization.service";

/** 完整 bkn-safe 词表 —— `"*"` / is_admin 的展开目标。与被测常量同步。 */
const FULL_VOCAB = new Set([
  "create",
  "delete",
  "modify",
  "view",
  "view_detail",
  "execute",
  "authorize",
  "publish",
  "unpublish",
  "public_access",
  "task_manage",
]);

type Row = { resource?: { type?: string; id?: string }; operations?: string[] };

/** 折叠形态响应:每型一行类型级(id:"*"),可选实例例外行(仅增量)。 */
function foldedResponse(is_admin: boolean, permissions: Row[]) {
  return { data: { is_admin, permissions } };
}

/** 末次 http.get 调用携带的 query 参数。 */
function lastParams(): Record<string, string> {
  const call = getMock.mock.calls.at(-1) as
    | [string, { params?: Record<string, string> }]
    | undefined;
  return call?.[1]?.params ?? {};
}

describe("authorization.service · getResourceOperations", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("空 resources 直接返回,不打接口", async () => {
    const result = await getResourceOperations([]);

    expect(result).toEqual([]);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("is_admin 响应 → 每个资源拿到全量词表", async () => {
    getMock.mockResolvedValue(foldedResponse(true, []));

    const [item] = await getResourceOperations([{ id: "m1", type: "large_model" }]);

    expect(new Set(item.operation)).toEqual(FULL_VOCAB);
    // 幽灵操作 display 已剔除。
    expect(item.operation).not.toContain("display");
  });

  it("通配行 *:* 的非超管 → 全量词表(超管等价短路)", async () => {
    getMock.mockResolvedValue(
      foldedResponse(false, [{ resource: { type: "*", id: "*" }, operations: ["*"] }]),
    );

    const [item] = await getResourceOperations([{ id: "m1", type: "large_model" }]);

    expect(new Set(item.operation)).toEqual(FULL_VOCAB);
  });

  it("类型级 * 操作 → 该类型全量词表", async () => {
    getMock.mockResolvedValue(
      foldedResponse(false, [{ resource: { type: "large_model", id: "*" }, operations: ["*"] }]),
    );

    const [item] = await getResourceOperations([{ id: "m1", type: "large_model" }]);

    expect(new Set(item.operation)).toEqual(FULL_VOCAB);
  });

  it("类型级行与实例例外行 union —— 实例只带增量", async () => {
    getMock.mockResolvedValue(
      foldedResponse(false, [
        { resource: { type: "large_model", id: "*" }, operations: ["view"] },
        { resource: { type: "large_model", id: "m1" }, operations: ["modify"] },
      ]),
    );

    const result = await getResourceOperations([
      { id: "m1", type: "large_model" },
      { id: "m2", type: "large_model" },
    ]);

    // m1 = 类型级 view ∪ 实例增量 modify
    expect(new Set(result[0].operation)).toEqual(new Set(["view", "modify"]));
    // m2 无例外行,只吃类型级
    expect(result[1].operation).toEqual(["view"]);
  });

  it("无命中授权 → 空操作(fail-closed)", async () => {
    getMock.mockResolvedValue(foldedResponse(false, []));

    const [item] = await getResourceOperations([{ id: "m1", type: "large_model" }]);

    expect(item.operation).toEqual([]);
  });

  it("scoped query 带 resource_type,resource_id 拼实例且排除 * 与重复", async () => {
    getMock.mockResolvedValue(foldedResponse(false, []));

    await getResourceOperations([
      { id: "m1", type: "large_model" },
      { id: "m1", type: "large_model" },
      { id: "*", type: "large_model" },
      { id: "m2", type: "large_model" },
    ]);

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(lastParams()).toEqual({ resource_type: "large_model", resource_id: "m1,m2" });
  });

  it("大列表按 50 分批,单条 URL 不超限", async () => {
    getMock.mockResolvedValue(
      foldedResponse(false, [{ resource: { type: "large_model", id: "*" }, operations: ["view"] }]),
    );

    const resources = Array.from({ length: 120 }, (_, i) => ({
      id: `m${i}`,
      type: "large_model",
    }));

    const result = await getResourceOperations(resources);

    // 120 / 50 → 3 批
    expect(getMock).toHaveBeenCalledTimes(3);
    for (const call of getMock.mock.calls as [string, { params: { resource_id: string } }][]) {
      const ids = call[1].params.resource_id.split(",");
      expect(ids.length).toBeLessThanOrEqual(50);
    }
    // 合并后每个资源都拿到类型级 view
    expect(result).toHaveLength(120);
    expect(result.every((item) => item.operation?.includes("view"))).toBe(true);
  });

  it("多类型分组:每型一次 scoped 查询,互不串权", async () => {
    getMock.mockImplementation((_url: string, config: { params: { resource_type: string } }) =>
      Promise.resolve(
        foldedResponse(false, [
          {
            resource: { type: config.params.resource_type, id: "*" },
            operations: [config.params.resource_type === "large_model" ? "modify" : "view"],
          },
        ]),
      ),
    );

    const result = await getResourceOperations([
      { id: "m1", type: "large_model" },
      { id: "s1", type: "small_model" },
    ]);

    const byType = new Set(
      (getMock.mock.calls as [string, { params: { resource_type: string } }][]).map(
        (call) => call[1].params.resource_type,
      ),
    );
    expect(byType).toEqual(new Set(["large_model", "small_model"]));
    expect(result[0].operation).toEqual(["modify"]);
    expect(result[1].operation).toEqual(["view"]);
  });
});
