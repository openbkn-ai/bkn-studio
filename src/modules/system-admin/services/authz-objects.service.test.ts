/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const listActionTypesMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));
vi.mock("@/modules/knowledge-network/services/action-type.service", () => ({
  listKnowledgeNetworkActionTypes: listActionTypesMock,
}));

import {
  listDomainObjectsPage,
  listTopResourceChildCategories,
  listTopResourceChildren,
  listTopLevelAuthzObjects,
  resolveGrantNames,
} from "@/modules/system-admin/services/authz-objects.service";
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

  it("知识网络子对象显示业务名称和所属知识网络，而不是 opaque 复合 ID", async () => {
    postMock.mockResolvedValue({
      data: { entries: [{ id: "ecommerce-ops", name: "电商经营决策知识网络" }] },
    });
    listActionTypesMock.mockResolvedValue([{ id: "simulate-fulfillment", name: "模拟履约" }]);

    const [resolved] = await resolveGrantNames([{
      accessorId: "u1",
      objId: "ecommerce-ops/simulate-fulfillment",
      objName: "ecommerce-ops/simulate-fulfillment",
      objType: "action_type",
      operations: ["execute"],
    }]);

    expect(resolved.objName).toBe("模拟履约");
    expect(resolved.objSub).toBe("电商经营决策知识网络");
    expect(listActionTypesMock).toHaveBeenCalledWith("ecommerce-ops");
  });

  it("数据资源显示业务名称和所属数据目录", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.startsWith("/vega-backend/v1/resources/")) {
        return Promise.resolve({
          data: { entries: [{ catalog_id: "catalog-sales", id: "resource-orders", name: "销售订单" }] },
        });
      }
      if (url.startsWith("/vega-backend/v1/catalogs/")) {
        return Promise.resolve({
          data: { entries: [{ id: "catalog-sales", name: "销售数据目录" }] },
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const [resolved] = await resolveGrantNames([resourceGrant("resource-orders")]);

    expect(resolved.objName).toBe("销售订单");
    expect(resolved.objSub).toBe("销售数据目录");
  });

  it("顶级资源按领域接口的 offset/limit 分页，不拉取完整资源集", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ id: "kn-21", name: "第 21 个知识网络" }],
        total_count: 53,
      },
    });

    const result = await listTopLevelAuthzObjects("knowledge_network", "电商", {
      limit: 20,
      offset: 20,
    });

    expect(result).toEqual({
      objects: [{ id: "kn-21", name: "第 21 个知识网络", type: "knowledge_network" }],
      total: 53,
    });
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks", {
      params: { limit: 20, name_pattern: "电商", offset: 20 },
      skipErrorToast: true,
    });
  });

  it("清空顶级资源类型时聚合各类型总数，仍按全局页码取资源", async () => {
    getMock.mockImplementation((path: string, options: { params: Record<string, number> }) => {
      const { limit, offset } = options.params;
      if (path === "/vega-backend/v1/catalogs") {
        return Promise.resolve({
          data: {
            entries: offset === 2 ? [{ id: "catalog-3", name: "第三个目录" }] : [],
            total_count: 3,
          },
        });
      }
      if (path === "/bkn-backend/v1/knowledge-networks") {
        return Promise.resolve({
          data: {
            entries: limit === 3 ? [
              { id: "kn-1", name: "第一个知识网络" },
              { id: "kn-2", name: "第二个知识网络" },
              { id: "kn-3", name: "第三个知识网络" },
            ] : [],
            total_count: 5,
          },
        });
      }
      return Promise.resolve({ data: { data: [], total: 0 } });
    });

    await expect(listTopLevelAuthzObjects(undefined, "", { limit: 4, offset: 2 })).resolves.toEqual({
      objects: [
        { id: "catalog-3", name: "第三个目录", type: "catalog" },
        { id: "kn-1", name: "第一个知识网络", type: "knowledge_network" },
        { id: "kn-2", name: "第二个知识网络", type: "knowledge_network" },
        { id: "kn-3", name: "第三个知识网络", type: "knowledge_network" },
      ],
      total: 8,
    });
  });

  it("跨类型聚合页不会把页内偏移错误换算为 page/page_size 页码", async () => {
    const catalogs = Array.from({ length: 3 }, (_, index) => ({ id: `catalog-${index + 1}`, name: `目录 ${index + 1}` }));
    const functionSets = Array.from({ length: 20 }, (_, index) => ({ box_id: `function-${index + 1}`, box_name: `函数集 ${index + 1}` }));
    getMock.mockImplementation((path: string, config?: { params?: { metadata_type?: string } }) => {
      if (path === "/vega-backend/v1/catalogs") return Promise.resolve({ data: { entries: catalogs, total_count: 3 } });
      if (path === "/agent-operator-integration/v1/tool-box/list" && config?.params?.metadata_type === "function") {
        return Promise.resolve({ data: { data: functionSets, total: 20 } });
      }
      return Promise.resolve({ data: { data: [], total: 0 } });
    });

    const firstPage = await listTopLevelAuthzObjects(undefined, "", { limit: 10, offset: 0 });
    const secondPage = await listTopLevelAuthzObjects(undefined, "", { limit: 10, offset: 10 });

    expect(firstPage.objects.map((item) => item.id)).toEqual([
      "catalog-1", "catalog-2", "catalog-3",
      "function-1", "function-2", "function-3", "function-4", "function-5", "function-6", "function-7",
    ]);
    expect(secondPage.objects.map((item) => item.id)).toEqual([
      "function-8", "function-9", "function-10", "function-11", "function-12",
      "function-13", "function-14", "function-15", "function-16", "function-17",
    ]);
  });

  it("数据目录的子资源按所属目录分页，并保留后端总数", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ id: "resource-11", name: "第 11 个资源" }],
        total_count: 37,
      },
    });
    const catalog = { id: "catalog-1", name: "销售目录", type: "catalog" } as const;

    expect(listTopResourceChildCategories(catalog)).toEqual(["resource"]);
    await expect(listTopResourceChildren(catalog, "resource", { limit: 10, offset: 10 })).resolves.toEqual({
      category: "resource",
      children: [{
        category: "resource",
        id: "resource-11",
        name: "第 11 个资源",
        sub: "销售目录",
        type: "resource",
      }],
      total: 37,
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources", {
      params: { catalog_id: "catalog-1", limit: 10, offset: 10 },
      skipErrorToast: true,
    });
  });
});
