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
});

describe("isKnowledgeNetworkPackage", () => {
  it("tells a BKN package from a JSON file by its name", async () => {
    const { isKnowledgeNetworkPackage } =
      await import("@/modules/knowledge-network/services/network.service");

    expect(["a.tar", "a.TAR.GZ", "a.tgz", "a.zip"].every(isKnowledgeNetworkPackage)).toBe(true);
    expect(["a.json", "a.gz", "tar"].some(isKnowledgeNetworkPackage)).toBe(false);
  });
});
