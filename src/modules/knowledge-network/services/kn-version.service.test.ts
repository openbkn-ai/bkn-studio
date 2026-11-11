/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

vi.mock("@/modules/knowledge-network/services/shared/runtime", () => ({
  useMock: false,
}));

import {
  activateKnVersion,
  changeKnVersionStatus,
  diffKnVersions,
  enableKnVersioning,
  isKnVersionConflict,
  listKnVersions,
  publishKnVersion,
  readKnVersionErrorCode,
  readKnVersionProblems,
  resetKnDraft,
} from "@/modules/knowledge-network/services/kn-version.service";
import {
  getKnVersionContext,
  recordKnVersioning,
} from "@/modules/knowledge-network/services/shared/kn-version-context";

const BASE = "/bkn-backend/v1/knowledge-networks/kn-1";

function refused(code: string, details?: unknown) {
  return { response: { data: { error_code: code, error_details: details }, status: 409 } };
}

describe("kn-version.service", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("publishes against the running version and draft revision it saw, with an idempotency key", async () => {
    postMock.mockResolvedValue({ data: { version: 4 } });

    await publishKnVersion("kn-1", {
      allowOutdatedBase: true,
      expectedDraftRevision: 128,
      expectedRunningVersion: 3,
      label: " v1.2.0 ",
      notes: "Add small-business class",
    });

    const [path, body, config] = postMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(path).toBe(`${BASE}/versions`);
    expect(body).toEqual({
      allow_outdated_base: true,
      expected_draft_revision: 128,
      expected_running_version: 3,
      label: "v1.2.0",
      notes: "Add small-business class",
    });
    expect(config.headers["Idempotency-Key"]).toMatch(/\S+/);
  });

  it("does not send allow_outdated_base for an up-to-date draft", async () => {
    postMock.mockResolvedValue({ data: { version: 4 } });

    await publishKnVersion("kn-1", { expectedDraftRevision: 1, expectedRunningVersion: 3 });

    expect(
      (postMock.mock.calls[0][1] as Record<string, unknown>).allow_outdated_base,
    ).toBeUndefined();
  });

  it("opens the draft after enabling, since enabling already needed modify", async () => {
    // Before versioning the network was read without a draft, so nothing granted canDraft yet.
    recordKnVersioning("kn-1", {
      enabled: false,
      full_history: true,
      previous_version: 0,
      running_version: 0,
    });
    postMock.mockResolvedValue({
      data: {
        draft: { base_version: 1, has_changes: false, outdated: false, revision: 1 },
        enabled: true,
        full_history: true,
        previous_version: 0,
        running_version: 1,
      },
    });

    await enableKnVersioning("kn-1");

    expect(getKnVersionContext("kn-1")).toMatchObject({
      canDraft: true,
      versioned: true,
      view: "draft",
    });
  });

  it("activates, resets and changes status through their own routes", async () => {
    postMock.mockResolvedValue({ data: {} });

    await activateKnVersion("kn-1", 2, 3);
    await resetKnDraft("kn-1", {
      expectedDraftRevision: 9,
      fromVersion: 2,
      overwriteChanges: true,
    });
    await changeKnVersionStatus("kn-1", 2, "purge");

    expect((postMock.mock.calls as unknown[][]).map((call) => call[0])).toEqual([
      `${BASE}/versions/2/activate`,
      `${BASE}/draft/reset`,
      `${BASE}/versions/2/purge`,
    ]);
    expect(postMock.mock.calls[0][1]).toEqual({ expected_running_version: 3 });
    expect(postMock.mock.calls[1][1]).toEqual({
      expected_draft_revision: 9,
      from_version: 2,
      overwrite_changes: true,
    });
  });

  it("names both sides of a comparison by kn_version", async () => {
    postMock.mockResolvedValue({ data: {} });

    await diffKnVersions("kn-1", "draft", 2);

    expect(postMock.mock.calls[0][0]).toBe("/bkn-backend/v1/bkns/diff");
    expect(postMock.mock.calls[0][1]).toEqual({
      base: { kn_id: "kn-1", kn_version: "draft" },
      target: { kn_id: "kn-1", kn_version: "2" },
    });
  });

  it("lists versions with the statuses asked for", async () => {
    getMock.mockResolvedValue({
      data: { entries: [{ version: 3, status: "running" }], total_count: 1 },
    });

    const page = await listKnVersions("kn-1", { status: ["running", "history"] });

    expect(page).toEqual({ items: [{ status: "running", version: 3 }], total: 1 });
    const [, config] = getMock.mock.calls[0] as [string, { params: { status: string } }];
    expect(config.params.status).toBe("running,history");
  });

  it("reads the problems of a refused publish and tells conflicts apart", () => {
    const failed = {
      response: {
        data: {
          error_code: "BknBackend.KNVersion.ValidationFailed",
          error_details: { problems: [{ category: "broken_reference", definition_id: "rt-1" }] },
        },
        status: 400,
      },
    };

    expect(readKnVersionErrorCode(failed)).toBe("ValidationFailed");
    expect(readKnVersionProblems(failed)).toEqual([
      { category: "broken_reference", definition_id: "rt-1" },
    ]);
    expect(isKnVersionConflict(failed)).toBe(false);
    expect(isKnVersionConflict(refused("BknBackend.KNVersion.DraftRevisionMismatch"))).toBe(true);
    expect(isKnVersionConflict(refused("BknBackend.KNVersion.DefinitionModified"))).toBe(true);
  });
});
