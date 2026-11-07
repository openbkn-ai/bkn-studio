/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

type DownloadedFile = { name: string; blob: Blob };

// jsdom's Blob exposes no text(), so downloaded bytes are read the way the
// platform still supports everywhere.
function readBlob(blob: Blob | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject(new Error("no blob was downloaded"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("blob read failed"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(blob);
  });
}

// jsdom ships no object-URL implementation, so the download path is observed by
// standing in for it rather than by spying on a method that does not exist.
function captureDownloads(): DownloadedFile[] {
  const downloads: DownloadedFile[] = [];
  const blobsByUrl = new Map<string, Blob>();
  let counter = 0;

  URL.createObjectURL = (blob: Blob | MediaSource) => {
    const url = `blob:test-${(counter += 1)}`;
    blobsByUrl.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({
      blob: blobsByUrl.get(this.href) ?? new Blob(),
      name: this.download,
    });
  });

  return downloads;
}

describe("exportKnowledgeNetwork", () => {
  const objectUrlMembers = ["createObjectURL", "revokeObjectURL"] as const;
  const originalObjectUrlMembers = objectUrlMembers.map((member) =>
    Object.getOwnPropertyDescriptor(URL, member),
  );

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    objectUrlMembers.forEach((member, index) => {
      const descriptor = originalObjectUrlMembers[index];

      if (descriptor) {
        Object.defineProperty(URL, member, descriptor);
        return;
      }

      Reflect.deleteProperty(URL, member);
    });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("downloads the export view as JSON by default", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({
      data: new Blob(['{"name":"orders-network"}'], { type: "application/json" }),
      headers: { "content-disposition": "attachment; filename=orders-network.json" },
    });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await exportKnowledgeNetwork("kn-1");

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1", {
      params: { mode: "export" },
      responseType: "blob",
      skipErrorToast: true,
      timeout: 60_000,
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe("orders-network.json");
    expect(await readBlob(downloads[0]?.blob)).toContain("orders-network");
  });

  it("falls back to the network ID when the JSON response has no filename", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({
      data: new Blob(["{}"], { type: "application/json" }),
      headers: {},
    });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await exportKnowledgeNetwork("kn-1");

    expect(downloads[0]?.name).toBe("kn-1.json");
  });

  it("downloads the BKN package from the tar endpoint and keeps the backend filename", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({
      data: new Blob(["tar-bytes"], { type: "application/octet-stream" }),
      headers: { "content-disposition": "attachment; filename=kn-1-main.tar" },
    });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await exportKnowledgeNetwork("kn-1", "bkn");

    // No bkn_spec: the backend picks 3.0 or 2.x from what the network holds.
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/kn-1", {
      responseType: "blob",
      skipErrorToast: true,
      timeout: 60_000,
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe("kn-1-main.tar");
    expect(await readBlob(downloads[0]?.blob)).toBe("tar-bytes");
  });

  it("names the BKN package after the network when the response carries no filename", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({ data: new Blob(["tar-bytes"]), headers: {} });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await exportKnowledgeNetwork("kn-1", "bkn");

    expect(downloads[0]?.name).toBe("kn-1.tar");
  });

  it("asks for a 2.x package when the user chose it after a refusal", async () => {
    captureDownloads();
    getMock.mockResolvedValue({ data: new Blob(["tar-bytes"]), headers: {} });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await exportKnowledgeNetwork("kn-1", "bkn", { bknSpec: "2.0" });

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/kn-1", {
      params: { bkn_spec: "2.0" },
      responseType: "blob",
      skipErrorToast: true,
      timeout: 60_000,
    });
  });

  it("reads a network-check refusal into the check result", async () => {
    const downloads = captureDownloads();
    getMock.mockRejectedValue({
      response: {
        data: {
          description: "The network check found parameters to fix",
          error_code: "BknBackend.KnowledgeNetwork.ExportNeedsNetworkCheck",
          error_details: {
            invalid_parameters: [
              { action_type_id: "urge", current: { value_from: "context" }, parameter: "who" },
            ],
            misplaced_parameters: [
              {
                action_type_id: "urge",
                conflict: false,
                current: { source: "property", value: "order_no" },
                parameter: "order_no",
                suggested: { value: "order_no", value_from: "property" },
              },
              {
                conflict: true,
                current: { source: "input" },
                logic_property: "turnaround",
                object_type_id: "lab_order",
                parameter: "dept",
                suggested: { value_from: "input" },
              },
            ],
          },
        },
        status: 400,
      },
    });
    const { exportKnowledgeNetwork, KnowledgeNetworkExportRefusedError } =
      await import("@/modules/knowledge-network/services/knowledge-network.service");

    const error = await exportKnowledgeNetwork("kn-1", "bkn").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(KnowledgeNetworkExportRefusedError);
    expect((error as InstanceType<typeof KnowledgeNetworkExportRefusedError>).refusal).toEqual({
      check: {
        invalidParameters: [
          {
            actionTypeId: "urge",
            current: { source: undefined, value: undefined, valueFrom: "context" },
            logicProperty: undefined,
            objectTypeId: undefined,
            parameter: "who",
          },
        ],
        misplacedParameters: [
          {
            actionTypeId: "urge",
            conflict: false,
            current: { source: "property", value: "order_no", valueFrom: undefined },
            logicProperty: undefined,
            objectTypeId: undefined,
            parameter: "order_no",
            suggested: { source: undefined, value: "order_no", valueFrom: "property" },
          },
          {
            actionTypeId: undefined,
            conflict: true,
            current: { source: "input", value: undefined, valueFrom: undefined },
            logicProperty: "turnaround",
            objectTypeId: "lab_order",
            parameter: "dept",
            suggested: { source: undefined, value: undefined, valueFrom: "input" },
          },
        ],
      },
      kind: "network_check",
    });
    // Studio never falls back to 2.x by itself.
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(0);
  });

  it("reads a 3.0 read-back refusal with its reason", async () => {
    getMock.mockRejectedValue({
      response: {
        data: {
          error_code: "BknBackend.KnowledgeNetwork.ExportNotReadableAsV3",
          error_details: "object type lab_order: semantic end_time needs event_time",
        },
      },
    });
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/knowledge-network.service");

    await expect(exportKnowledgeNetwork("kn-1", "bkn")).rejects.toMatchObject({
      message: "BknBackend.KnowledgeNetwork.ExportNotReadableAsV3",
      refusal: {
        kind: "not_readable_as_v3",
        reason: "object type lab_order: semantic end_time needs event_time",
      },
    });
  });

  it("rethrows any other export failure as it came", async () => {
    const failure = {
      response: { data: { error_code: "BknBackend.KnowledgeNetwork.NotFound" }, status: 404 },
    };
    getMock.mockRejectedValue(failure);
    const { exportKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(exportKnowledgeNetwork("kn-1", "bkn")).rejects.toBe(failure);
  });
});

describe("listKnowledgeNetworkTags", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("collects tags from every knowledge-network page", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          entries: Array.from({ length: 200 }, (_, index) => ({ tags: [`tag-${index}`] })),
          total_count: 201,
        },
      })
      .mockResolvedValueOnce({ data: { entries: [{ tags: ["last-tag"] }], total_count: 201 } });
    const { listKnowledgeNetworkTags } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(listKnowledgeNetworkTags()).resolves.toContain("last-tag");
    expect(getMock).toHaveBeenNthCalledWith(2, "/bkn-backend/v1/knowledge-networks", {
      params: { direction: "desc", limit: 200, offset: 200, sort: "update_time" },
    });
  });
});
