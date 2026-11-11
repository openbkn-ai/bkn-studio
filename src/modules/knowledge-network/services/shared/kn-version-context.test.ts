/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { createRuntimeConfig, setRuntimeConfig } from "@/framework/runtime/config";
import {
  KnVersionReadOnlyError,
  forgetKnVersionContext,
  getKnVersionView,
  knVersionQuery,
  resolveKnReadParams,
  setKnVersionView,
} from "@/modules/knowledge-network/services/shared/kn-version-context";

type Reply = {
  data?: unknown;
  headers?: Record<string, string>;
  status?: number;
};

const NETWORK = "/bkn-backend/v1/knowledge-networks/kn-1";
const versionedNetwork = (operations: string[]) => ({
  id: "kn-1",
  operations,
  versioning: {
    enabled: true,
    full_history: true,
    previous_version: 2,
    running_version: 3,
    draft: { base_version: 3, has_changes: false, revision: 40 },
  },
});

describe("kn version context", () => {
  const seen: InternalAxiosRequestConfig[] = [];
  let routes: Record<string, Reply>;
  const originalAdapter = http.defaults.adapter;

  beforeEach(() => {
    seen.length = 0;
    routes = {};
    window.sessionStorage.clear();
    forgetKnVersionContext("kn-1");
    setRuntimeConfig(createRuntimeConfig());
    const adapter: AxiosAdapter = (config) => {
      seen.push(config);
      const key = `${(config.method ?? "get").toUpperCase()} ${config.url ?? ""}`;
      const reply = routes[key] ?? { data: {} };
      const response = {
        config,
        data: reply.data ?? {},
        headers: reply.headers ?? {},
        status: reply.status ?? 200,
        statusText: "",
      };
      return reply.status && reply.status >= 400
        ? Promise.reject(
            Object.assign(new Error("HTTP error"), { isAxiosError: true, config, response }),
          )
        : Promise.resolve(response);
    };
    http.defaults.adapter = adapter;
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  const request = (method: string, url: string) =>
    seen.filter((config) => config.method === method && config.url === url);

  it("leaves a network without versioning alone", async () => {
    routes[`GET ${NETWORK}`] = { data: { id: "kn-1", operations: ["modify"] } };

    await http.get(`${NETWORK}/object-types`, { params: { branch: "main" } });
    await http.put(`${NETWORK}/object-types/ot-1`, {});

    const [read] = request("get", `${NETWORK}/object-types`);
    expect(read.params).toEqual({ branch: "main" });
    const [write] = request("put", `${NETWORK}/object-types/ot-1`);
    expect(write.headers.has("If-Match")).toBe(false);
  });

  it("reads the draft of a versioned network and drops the branch", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };

    await http.get(`${NETWORK}/object-types`, { params: { branch: "main", limit: 5 } });

    const [read] = request("get", `${NETWORK}/object-types`);
    expect(read.params).toEqual({ kn_version: "draft", limit: 5 });
  });

  it("reads the running version for a user who cannot modify the network", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["view_detail"]) };

    await http.get(`${NETWORK}/object-types`);

    const [read] = request("get", `${NETWORK}/object-types`);
    expect(read.params).toBeUndefined();
    expect(await resolveKnReadParams("kn-1")).toEqual({ kn_version: "running" });
  });

  it("sends the ETag of the definition it read as If-Match on save", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    routes[`GET ${NETWORK}/object-types/ot-1`] = { headers: { etag: '"7"' } };

    await http.get(`${NETWORK}/object-types/ot-1`);
    await http.put(`${NETWORK}/object-types/ot-1`, {}, { params: { branch: "main" } });

    const [write] = request("put", `${NETWORK}/object-types/ot-1`);
    expect(write.headers.get("If-Match")).toBe('"7"');
    expect(write.params).toEqual({ branch: "draft" });
  });

  it("names the draft when it creates a definition, so the write is not published at once", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };

    await http.post(`${NETWORK}/object-types`, {}, { params: { branch: "main" } });

    const [write] = request("post", `${NETWORK}/object-types`);
    expect(write.params).toEqual({ branch: "draft" });
  });

  it("reads the definition first when a save has no ETag yet", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    routes[`GET ${NETWORK}/object-types/ot-1`] = { headers: { etag: '"9"' } };

    await http.patch(`${NETWORK}/object-types/ot-1`, {});

    const [write] = request("patch", `${NETWORK}/object-types/ot-1`);
    expect(write.headers.get("If-Match")).toBe('"9"');
  });

  it("deletes several definitions against the draft revision it last saw", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    routes[`GET ${NETWORK}/object-types`] = { headers: { "x-kn-draft-revision": "41" } };

    await http.get(`${NETWORK}/object-types`);
    await http.delete(`${NETWORK}/object-types/ot-1,ot-2`);

    const [write] = request("delete", `${NETWORK}/object-types/ot-1,ot-2`);
    expect(write.params).toEqual({ branch: "draft", expected_draft_revision: 41 });
    expect(write.headers.has("If-Match")).toBe(false);
  });

  it("sends the draft revision when the network itself is saved", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };

    await http.put(NETWORK, { name: "x" });

    const [write] = request("put", NETWORK);
    expect(write.params).toEqual({ branch: "draft", expected_draft_revision: 40 });
  });

  it("refuses writes while an older version is on screen, and reads that version", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    await http.get(`${NETWORK}/object-types`);
    setKnVersionView("kn-1", 2);

    await http.get(`${NETWORK}/object-types`);
    await expect(http.delete(`${NETWORK}/object-types/ot-1`)).rejects.toBeInstanceOf(
      KnVersionReadOnlyError,
    );

    const reads = request("get", `${NETWORK}/object-types`);
    expect(reads[1].params).toEqual({ kn_version: "2" });
    expect(knVersionQuery("kn-1")).toEqual({ kn_version: "2" });
  });

  it("does not reopen a remembered version the network no longer keeps", async () => {
    // Community keeps the running version and the one before it; v1 is gone.
    window.sessionStorage.setItem("bkn-studio.kn-version-view.kn-1", "1");
    routes[`GET ${NETWORK}`] = {
      data: {
        ...versionedNetwork(["modify"]),
        versioning: { ...versionedNetwork([]).versioning, full_history: false },
      },
    };

    await http.get(`${NETWORK}/object-types`);

    expect(request("get", `${NETWORK}/object-types`)[0].params).toEqual({ kn_version: "draft" });
  });

  it("goes back to the default view when the version on screen was purged", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    await http.get(`${NETWORK}/object-types`);
    setKnVersionView("kn-1", 2);
    routes[`GET ${NETWORK}/object-types`] = {
      data: { error_code: "BknBackend.KNVersion.VersionPurged" },
      status: 410,
    };

    await expect(http.get(`${NETWORK}/object-types`)).rejects.toThrow();

    expect(getKnVersionView("kn-1")).toBe("draft");
    expect(window.sessionStorage.getItem("bkn-studio.kn-version-view.kn-1")).toBe("draft");
  });

  it("keeps what it knows when a summary read of the network leaves the versioning out", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };
    await http.get(`${NETWORK}/object-types`);

    routes[`GET ${NETWORK}`] = { data: { id: "kn-1", statistics: {} } };
    await http.get(NETWORK, { params: { detail_level: "summary", include_statistics: true } });
    await http.get(`${NETWORK}/object-types`);

    const reads = request("get", `${NETWORK}/object-types`);
    expect(reads[1].params).toEqual({ kn_version: "draft" });
  });

  it("does not touch the version endpoints", async () => {
    routes[`GET ${NETWORK}`] = { data: versionedNetwork(["modify"]) };

    await http.post(`${NETWORK}/versions`, {});

    const [publish] = request("post", `${NETWORK}/versions`);
    expect(publish.params).toBeUndefined();
  });

  it("says somebody else changed it when a save hits a stale definition", () => {
    const error = Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: {
        data: {
          description: "etag mismatch",
          error_code: "BknBackend.KNVersion.DefinitionModified",
        },
        status: 409,
      },
    });

    expect(extractRequestErrorMessage(error)).not.toBe("etag mismatch");
  });
});
