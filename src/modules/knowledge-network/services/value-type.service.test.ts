/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock, put: putMock },
}));

const loadService = () => import("@/modules/knowledge-network/services/value-type.service");

const referenced = () => ({
  response: {
    data: {
      error_code: "BknBackend.ValueType.Referenced",
      error_details: {
        reason: "referenced",
        references: [
          {
            object_type_id: "lab_order",
            object_type_name: "Lab order",
            property: "fee",
            property_type: "decimal",
          },
        ],
      },
    },
    status: 409,
  },
});

describe("value-type.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    [getMock, postMock, putMock, deleteMock].forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists every value type of the network by name, without the global toast", async () => {
    getMock.mockResolvedValue({
      data: { entries: [{ base_type: "decimal", id: "amount_cny", name: "Amount" }] },
    });
    const { listKnowledgeNetworkValueTypes } = await loadService();

    const items = await listKnowledgeNetworkValueTypes("kn 1");

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn%201/value-types", {
      params: { direction: "asc", limit: -1, sort: "name" },
      skipErrorToast: true,
    });
    expect(items.map((item) => item.id)).toEqual(["amount_cny"]);
  });

  it("creates a value type and returns the ID the backend gives", async () => {
    postMock.mockResolvedValue({ data: [{ id: "vt_generated" }] });
    const { createKnowledgeNetworkValueType } = await loadService();

    const id = await createKnowledgeNetworkValueType("kn-1", {
      baseType: "decimal",
      description: "",
      name: "Amount",
      range: { min: 0 },
      tags: [],
    });

    expect(id).toBe("vt_generated");
    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/value-types",
      {
        entries: [
          { base_type: "decimal", comment: "", name: "Amount", range: { min: 0 }, tags: [] },
        ],
      },
      { skipErrorToast: true },
    );
  });

  it("replaces a value type whole, with its ID in the body", async () => {
    putMock.mockResolvedValue({ data: undefined });
    const { updateKnowledgeNetworkValueType } = await loadService();

    await updateKnowledgeNetworkValueType("kn-1", "amount_cny", {
      baseType: "decimal",
      description: "",
      name: "Amount",
      tags: [],
      unit: "CNY",
    });

    expect(putMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/value-types/amount_cny",
      {
        base_type: "decimal",
        comment: "",
        id: "amount_cny",
        name: "Amount",
        tags: [],
        unit: "CNY",
      },
      { skipErrorToast: true },
    );
  });

  it.each(["update", "delete"] as const)(
    "turns a refused %s into the properties that name the value type",
    async (action) => {
      putMock.mockRejectedValue(referenced());
      deleteMock.mockRejectedValue(referenced());
      const service = await loadService();

      const request =
        action === "update"
          ? service.updateKnowledgeNetworkValueType("kn-1", "amount_cny", {
              baseType: "integer",
              description: "",
              name: "Amount",
              tags: [],
            })
          : service.deleteKnowledgeNetworkValueType("kn-1", "amount_cny");

      const error: unknown = await request.catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(service.ValueTypeReferencedError);
      expect((error as InstanceType<typeof service.ValueTypeReferencedError>).references).toEqual([
        {
          objectTypeId: "lab_order",
          objectTypeName: "Lab order",
          property: "fee",
          propertyType: "decimal",
        },
      ]);
    },
  );

  it("passes any other refusal on as it came", async () => {
    const forbidden = { response: { data: { error_code: "BknBackend.Forbidden" }, status: 403 } };
    deleteMock.mockRejectedValue(forbidden);
    const { deleteKnowledgeNetworkValueType } = await loadService();

    await expect(deleteKnowledgeNetworkValueType("kn-1", "amount_cny")).rejects.toBe(forbidden);
  });
});
