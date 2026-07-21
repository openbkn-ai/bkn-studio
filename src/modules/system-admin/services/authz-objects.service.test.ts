/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({ currentUser: { businessDomainId: "bd_public" } }),
}));

import { resolveGrantNames } from "@/modules/system-admin/services/authz-objects.service";
import type { ObjectGrant } from "@/modules/system-admin/types/authz";

/** resource 型对象走 vega 旧批量取名接口(逗号拼 id 进 path)。 */
function resourceGrant(id: string): ObjectGrant {
  return { accessorId: "u1", objId: id, objName: id, objType: "resource", operations: ["view"] };
}

/** vega URL 尾段解析出本批请求的 id 列表。 */
function idsInLastCalls(): string[][] {
  return getMock.mock.calls.map((call) => {
    const tail = String(call[0]).split("/").pop() ?? "";
    return tail.split(",").map(decodeURIComponent);
  });
}

describe("authz-objects · resolveGrantNames 取名不再打请求风暴", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("整批 404 只发「分批数」次请求,不再逐个重拉(120 → 3,非 121)", async () => {
    getMock.mockRejectedValue(new Error("404"));

    const grants = Array.from({ length: 120 }, (_, index) => resourceGrant(`storm-${index}`));
    const result = await resolveGrantNames(grants);

    // ceil(120 / 50) = 3 批;修复前是 1(整批)+ 120(逐个)= 121。
    expect(getMock).toHaveBeenCalledTimes(3);
    for (const batch of idsInLastCalls()) {
      expect(batch.length).toBeLessThanOrEqual(50);
    }
    // 解析不到 → 名称保持 id 兜底。
    expect(result.every((grant) => grant.objName === grant.objId)).toBe(true);
  });

  it("批量成功一次拉回,≤50 个 id 只发一条请求", async () => {
    getMock.mockImplementation((url: string) => {
      const tail = String(url).split("/").pop() ?? "";
      const ids = tail.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `name-${id}` })) } });
    });

    const grants = ["ok-a", "ok-b", "ok-c"].map(resourceGrant);
    const result = await resolveGrantNames(grants);

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(result.map((grant) => grant.objName)).toEqual(["name-ok-a", "name-ok-b", "name-ok-c"]);
  });

  it("超过 50 个 id 分批(60 → 2 批)", async () => {
    getMock.mockImplementation((url: string) => {
      const tail = String(url).split("/").pop() ?? "";
      const ids = tail.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `n-${id}` })) } });
    });

    const grants = Array.from({ length: 60 }, (_, index) => resourceGrant(`big-${index}`));
    await resolveGrantNames(grants);

    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("正向缓存:已解析的 id 再次解析不再请求", async () => {
    getMock.mockImplementation((url: string) => {
      const tail = String(url).split("/").pop() ?? "";
      const ids = tail.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `c-${id}` })) } });
    });

    const grants = ["cache-1", "cache-2"].map(resourceGrant);
    await resolveGrantNames(grants);
    const afterFirst = getMock.mock.calls.length;

    const again = await resolveGrantNames(grants);

    // 第二次全部命中缓存,零新请求。
    expect(getMock.mock.calls.length).toBe(afterFirst);
    expect(again.map((grant) => grant.objName)).toEqual(["c-cache-1", "c-cache-2"]);
  });
});
