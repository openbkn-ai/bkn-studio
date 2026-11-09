/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { post: postMock },
}));

describe("importKnowledgeNetwork", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves bindings by default", async () => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" });

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders" },
      {
        params: {
          binding_policy: "preserve",
          import_mode: "normal",
          strict_mode: false,
        },
        skipErrorToast: true,
        timeout: 60_000,
      },
    );
  });

  it("requests detached bindings for cross-environment import", async () => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" }, "overwrite", "detach");

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders" },
      {
        params: {
          binding_policy: "detach",
          import_mode: "overwrite",
          strict_mode: false,
        },
        skipErrorToast: true,
        timeout: 60_000,
      },
    );
  });

  it.each([
    ["normal", false],
    ["normal", true],
    ["ignore", false],
    ["ignore", true],
    ["overwrite", false],
    ["overwrite", true],
  ] as const)("serializes import_mode=%s with strict_mode=%s", async (importMode, strictMode) => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" }, importMode, "preserve", strictMode);

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders" },
      expect.objectContaining({
        params: {
          binding_policy: "preserve",
          import_mode: importMode,
          strict_mode: strictMode,
        },
      }),
    );
  });

  it("uses the configured import timeout without changing the shared client", async () => {
    vi.stubEnv("VITE_KNOWLEDGE_NETWORK_IMPORT_TIMEOUT_MS", "75000");
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" });

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      expect.any(Object),
      expect.objectContaining({ timeout: 75_000 }),
    );
  });

  it.each([
    "BknBackend.KnowledgeNetwork.KNIDExisted",
    "BknBackend.KnowledgeNetwork.KNNameExisted",
    "OntologyManager.KnowledgeNetwork.KNIDExisted",
    "OntologyManager.KnowledgeNetwork.KNNameExisted",
  ])("turns %s into an import conflict", async (errorCode) => {
    postMock.mockRejectedValue({
      response: {
        data: {
          description: "The knowledge network already exists.",
          error_code: errorCode,
        },
      },
    });
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(importKnowledgeNetwork({ id: "orders" })).rejects.toMatchObject({
      isConflict: true,
    });
  });

  it("turns an incomplete preserved binding into an actionable import error", async () => {
    postMock.mockRejectedValue({
      response: {
        data: {
          description: "The knowledge network has incomplete tool bindings",
          error_code: "BknBackend.KnowledgeNetwork.Proxy.TargetInvalid",
          error_details: "toolbox orders-api is missing bound tools: get-order",
          solution: "Restore the missing tool or import with detached bindings.",
        },
      },
    });
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    const error = await importKnowledgeNetwork({ id: "orders" }).catch((reason: unknown) => reason);
    expect(error).toMatchObject({
      isBindingError: true,
      message: "The knowledge network has incomplete tool bindings",
      details: "toolbox orders-api is missing bound tools: get-order",
    });
    expect(error).not.toHaveProperty("solution");
  });
  it("adds the confirmation only on the resend the user confirmed", async () => {
    const { importKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await importKnowledgeNetwork({ id: "orders" }, "overwrite", "detach", true, true);

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks",
      { id: "orders" },
      {
        params: {
          binding_policy: "detach",
          confirm_clear_declarations: true,
          import_mode: "overwrite",
          strict_mode: true,
        },
        skipErrorToast: true,
        timeout: 60_000,
      },
    );
  });

  it.each([
    "BknBackend.ObjectType.DeclarationsWouldBeCleared",
    "BknBackend.RelationType.DeclarationsWouldBeCleared",
    "BknBackend.ActionType.DeclarationsWouldBeCleared",
  ])("lists what %s would clear instead of reporting a conflict", async (errorCode) => {
    postMock.mockRejectedValue({
      response: {
        data: {
          description: "The overwrite would clear declarations",
          error_code: errorCode,
          error_details: {
            cleared: [
              { fields: ["aliases"], object_type_id: "lab_order" },
              { fields: ["semantic", "required"], object_type_id: "lab_order", property: "at" },
              { fields: ["cardinality"], relation_type_id: "order_for_patient" },
              { action_type_id: "revoke", fields: ["lifecycle"] },
            ],
            confirm_with: "confirm_clear_declarations=true",
          },
        },
        status: 409,
      },
    });
    const { importKnowledgeNetwork, DeclarationsWouldBeClearedError } =
      await import("@/modules/knowledge-network/services/knowledge-network.service");

    const error = await importKnowledgeNetwork({ id: "orders" }, "overwrite").catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(DeclarationsWouldBeClearedError);
    expect(error).not.toHaveProperty("isConflict");
    expect(error).toMatchObject({
      cleared: [
        { fields: ["aliases"], id: "lab_order", kind: "object_type" },
        { fields: ["semantic", "required"], id: "lab_order", kind: "object_type", property: "at" },
        { fields: ["cardinality"], id: "order_for_patient", kind: "relation_type" },
        { fields: ["lifecycle"], id: "revoke", kind: "action_type" },
      ],
      message: "The overwrite would clear declarations",
    });
  });

  it.each([undefined, "", "  "])(
    "preserves the code when an import error description is %j",
    async (description) => {
      const errorCode = "BknBackend.KnowledgeNetwork.Proxy.TargetInvalid";
      postMock.mockRejectedValue({ response: { data: { description, error_code: errorCode } } });
      const { importKnowledgeNetwork } =
        await import("@/modules/knowledge-network/services/network.service");
      await expect(importKnowledgeNetwork({ id: "orders" })).rejects.toMatchObject({
        message: errorCode,
      });
    },
  );
});

describe("importKnowledgeNetworkPackage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uploads the package as a file with the chosen options, and reads what it skipped", async () => {
    postMock.mockResolvedValue({
      data: {
        capabilities: {
          bound: 2,
          skipped: [
            {
              capability_type: "knowledge_base",
              declared_id: "7",
              detail: "two knowledge bases are called Contracts",
              name: "Contracts",
              reason: "ambiguous_name",
            },
            {
              box_name: "orders-api",
              capability_type: "function",
              name: "get-order",
              reason: "not_found",
            },
          ],
        },
        kn_id: "orders",
      },
    });
    const { importKnowledgeNetworkPackage } =
      await import("@/modules/knowledge-network/services/network.service");
    const file = new File(["tar"], "orders.tar");

    const report = await importKnowledgeNetworkPackage(file, "overwrite", "preserve", true);

    const [url, body, config] = postMock.mock.calls[0] as [string, FormData, unknown];
    expect(url).toBe("/bkn-backend/v1/bkns");
    expect(body.get("file")).toBe(file);
    expect(config).toEqual({
      params: { binding_policy: "preserve", import_mode: "overwrite", strict_mode: true },
      skipErrorToast: true,
      timeout: 60_000,
    });
    // Ids and free-text details belong to the environment the package came from: not kept.
    expect(report).toEqual({
      bound: 2,
      skipped: [
        {
          boxName: "",
          capabilityType: "knowledge_base",
          name: "Contracts",
          reason: "ambiguous_name",
        },
        {
          boxName: "orders-api",
          capabilityType: "function",
          name: "get-order",
          reason: "not_found",
        },
      ],
    });
  });

  it("reads a reply without a capability report as nothing bound or skipped", async () => {
    postMock.mockResolvedValue({ data: { kn_id: "orders" } });
    const { importKnowledgeNetworkPackage } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(importKnowledgeNetworkPackage(new File(["tar"], "orders.tar"))).resolves.toEqual({
      bound: 0,
      skipped: [],
    });
  });

  it("reads a name already in use as a conflict, as for a JSON import", async () => {
    postMock.mockRejectedValue({
      response: {
        data: {
          description: "A knowledge network called Orders exists",
          error_code: "BknBackend.KnowledgeNetwork.KNNameExisted",
        },
      },
    });
    const { importKnowledgeNetworkPackage } =
      await import("@/modules/knowledge-network/services/network.service");
    const { KnowledgeNetworkImportConflictError } =
      await import("@/modules/knowledge-network/services/shared/runtime");

    await expect(
      importKnowledgeNetworkPackage(new File(["tar"], "orders.tar")),
    ).rejects.toBeInstanceOf(KnowledgeNetworkImportConflictError);
  });

  it("lists what an overwrite would clear, and resends the same package once confirmed", async () => {
    postMock.mockRejectedValueOnce({
      response: {
        data: {
          error_code: "BknBackend.ObjectType.DeclarationsWouldBeCleared",
          error_details: { cleared: [{ fields: ["aliases"], object_type_id: "lab_order" }] },
        },
      },
    });
    postMock.mockResolvedValueOnce({ data: { kn_id: "orders" } });
    const { importKnowledgeNetworkPackage, DeclarationsWouldBeClearedError } =
      await import("@/modules/knowledge-network/services/knowledge-network.service");
    const file = new File(["tar"], "orders.tar");

    await expect(
      importKnowledgeNetworkPackage(file, "overwrite", "preserve", false),
    ).rejects.toBeInstanceOf(DeclarationsWouldBeClearedError);
    await importKnowledgeNetworkPackage(file, "overwrite", "preserve", false, true);

    const configs = postMock.mock.calls.map((call) => call[2] as { params: unknown });
    expect(configs[0]?.params).toEqual({
      binding_policy: "preserve",
      import_mode: "overwrite",
      strict_mode: false,
    });
    expect(configs[1]?.params).toEqual({
      binding_policy: "preserve",
      confirm_clear_declarations: true,
      import_mode: "overwrite",
      strict_mode: false,
    });
    expect((postMock.mock.calls[1]?.[1] as FormData).get("file")).toBe(file);
  });
});

describe("isKnowledgeNetworkPackage", () => {
  it("tells a BKN package from a JSON file by its name", async () => {
    const { isKnowledgeNetworkPackage } =
      await import("@/modules/knowledge-network/services/network.service");

    expect(["a.tar", "a.TAR.GZ", "a.tgz", "a.zip"].every(isKnowledgeNetworkPackage)).toBe(true);
    expect(["a.json", "a.gz", "tar"].some(isKnowledgeNetworkPackage)).toBe(false);
  });
});
