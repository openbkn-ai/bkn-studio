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

import { listDomainObjectsPage, resolveGrantNames } from "./authz-objects.service";
import type { ObjectGrant } from "@/modules/system-admin/types/authz";

function resourceGrant(id: string): ObjectGrant {
  return { accessorId: "u1", objId: id, objName: id, objType: "resource", operations: ["view"] };
}

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
    expect(getMock).toHaveBeenCalledTimes(3);
    for (const batch of idsInLastCalls()) expect(batch.length).toBeLessThanOrEqual(50);
    expect(result.every((grant) => grant.objName === grant.objId)).toBe(true);
  });

  it("批量成功一次拉回,≤50 个 id 只发一条请求", async () => {
    getMock.mockImplementation((url: string) => {
      const ids = String(url).split("/").pop()!.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `name-${id}` })) } });
    });
    const result = await resolveGrantNames(["ok-a", "ok-b", "ok-c"].map(resourceGrant));
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(result.map((grant) => grant.objName)).toEqual(["name-ok-a", "name-ok-b", "name-ok-c"]);
  });

  it("超过 50 个 id 分批(60 → 2 批)", async () => {
    getMock.mockImplementation((url: string) => {
      const ids = String(url).split("/").pop()!.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `n-${id}` })) } });
    });
    await resolveGrantNames(Array.from({ length: 60 }, (_, index) => resourceGrant(`big-${index}`)));
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("后端已带真实名(objName ≠ id)则跳过解析,零请求", async () => {
    const named: ObjectGrant = { accessorId: "u1", objId: "res-1", objName: "销售数据集", objType: "resource", operations: ["view"] };
    await expect(resolveGrantNames([named])).resolves.toEqual([named]);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("vega 批量取名带 ignore_missing=true", async () => {
    getMock.mockResolvedValue({ data: { entries: [] } });
    await resolveGrantNames([resourceGrant("im-1")]);
    const call = getMock.mock.calls.at(-1) as [string, { params?: unknown }] | undefined;
    expect(call?.[1]?.params).toEqual({ ignore_missing: true });
  });

  it("部分返回:缺失 id 退回 id 兜底,不牵连其余(按 entry.id 对齐)", async () => {
    getMock.mockImplementation((url: string) => {
      const ids = String(url).split("/").pop()!.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.filter((id) => id !== "part-gone").map((id) => ({ id, name: `n-${id}` })) } });
    });
    const result = await resolveGrantNames(["part-a", "part-gone", "part-c"].map(resourceGrant));
    expect(result.map((grant) => grant.objName)).toEqual(["n-part-a", "part-gone", "n-part-c"]);
  });

  it("正向缓存:已解析的 id 再次解析不再请求", async () => {
    getMock.mockImplementation((url: string) => {
      const ids = String(url).split("/").pop()!.split(",").map(decodeURIComponent);
      return Promise.resolve({ data: { entries: ids.map((id) => ({ id, name: `c-${id}` })) } });
    });
    const grants = ["cache-1", "cache-2"].map(resourceGrant);
    await resolveGrantNames(grants);
    const afterFirst = getMock.mock.calls.length;
    await expect(resolveGrantNames(grants)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ objName: "c-cache-1" }),
    ]));
    expect(getMock.mock.calls.length).toBe(afterFirst);
  });
});

describe("authz object picker domain service", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("keeps the backend total and requests the requested offset page", async () => {
    getMock.mockResolvedValue({
      data: { entries: [{ id: "catalog-101", name: "Beyond first page" }], total_count: 2_018 },
    });

    await expect(listDomainObjectsPage("catalog", { page: 1 })).resolves.toEqual({
      items: [{ id: "catalog-101", name: "Beyond first page", type: "catalog" }], total: 2_018,
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      params: { limit: 100, name: undefined, offset: 100 }, skipErrorToast: true,
    });
  });

  it("passes a keyword to the domain API instead of filtering a loaded page", async () => {
    getMock.mockResolvedValue({
      data: { entries: [{ id: "catalog-2000", name: "Needle" }], total_count: 1 },
    });

    await listDomainObjectsPage("catalog", { keyword: "Needle" });

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      params: { limit: 100, name: "Needle", offset: 0 }, skipErrorToast: true,
    });
  });

  it("requests the final partial page without treating it as another full page", async () => {
    getMock.mockResolvedValue({
      data: { entries: Array.from({ length: 18 }, (_, index) => ({ id: `catalog-${index}`, name: `Catalog ${index}` })), total_count: 2_018 },
    });

    const result = await listDomainObjectsPage("catalog", { page: 20 });

    expect(result.items).toHaveLength(18);
    expect(result.total).toBe(2_018);
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      params: { limit: 100, name: undefined, offset: 2_000 }, skipErrorToast: true,
    });
  });

  it("does not turn an unsupported type into a request", async () => {
    await expect(listDomainObjectsPage("object_type")).resolves.toEqual({ items: [], total: 0 });
    expect(getMock).not.toHaveBeenCalled();
  });
});
