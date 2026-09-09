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
    getMock.mockResolvedValue({ data: { name: "orders-network" }, headers: {} });
    const { exportKnowledgeNetwork } = await import(
      "@/modules/knowledge-network/services/network.service"
    );

    await exportKnowledgeNetwork("kn-1");

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1", {
      params: { mode: "export" },
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe("orders-network.json");
    expect(await readBlob(downloads[0]?.blob)).toContain("orders-network");
  });

  it("downloads the BKN package from the tar endpoint and keeps the backend filename", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({
      data: new Blob(["tar-bytes"], { type: "application/octet-stream" }),
      headers: { "content-disposition": "attachment; filename=kn-1-main.tar" },
    });
    const { exportKnowledgeNetwork } = await import(
      "@/modules/knowledge-network/services/network.service"
    );

    await exportKnowledgeNetwork("kn-1", "bkn");

    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/kn-1", {
      responseType: "blob",
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe("kn-1-main.tar");
    expect(await readBlob(downloads[0]?.blob)).toBe("tar-bytes");
  });

  it("names the BKN package after the network when the response carries no filename", async () => {
    const downloads = captureDownloads();
    getMock.mockResolvedValue({ data: new Blob(["tar-bytes"]), headers: {} });
    const { exportKnowledgeNetwork } = await import(
      "@/modules/knowledge-network/services/network.service"
    );

    await exportKnowledgeNetwork("kn-1", "bkn");

    expect(downloads[0]?.name).toBe("kn-1.tar");
  });
});
