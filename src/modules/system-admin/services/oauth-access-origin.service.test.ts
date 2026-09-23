/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { describe, expect, it } from "vitest";

import {
  mapOAuthAccessOrigin,
  resolveOAuthAccessOriginError,
  validateOAuthAccessOrigin,
} from "@/modules/system-admin/services/oauth-access-origin.service";

describe("oauth-access-origin.service", () => {
  it("maps the backend contract without deriving callback paths in the UI", () => {
    expect(
      mapOAuthAccessOrigin({
        created_at: "2026-09-22T12:00:00Z",
        created_by: "admin-1",
        desired_state: "active",
        id: "origin-1",
        last_sync_error: "hydra unavailable",
        origin: "http://10.0.0.20:30080",
        post_logout_redirect_uri: "http://10.0.0.20:30080/studio",
        read_only: false,
        redirect_uri: "http://10.0.0.20:30080/studio/callback",
        source: "runtime",
        sync_state: "error",
      }),
    ).toEqual({
      createdAt: "2026-09-22T12:00:00Z",
      createdBy: "admin-1",
      desiredState: "active",
      id: "origin-1",
      lastSyncError: "hydra unavailable",
      origin: "http://10.0.0.20:30080",
      postLogoutRedirectUri: "http://10.0.0.20:30080/studio",
      readOnly: false,
      redirectUri: "http://10.0.0.20:30080/studio/callback",
      source: "runtime",
      syncState: "error",
    });
  });

  it.each([
    "https://example.com",
    "https://example.com/",
    "http://10.0.0.20:30080",
    "http://[2001:db8::1]:8080",
  ])("accepts an HTTP(S) origin: %s", (value) => {
    expect(validateOAuthAccessOrigin(value)).toBe(true);
  });

  it.each([
    "",
    "example.com",
    "ftp://example.com",
    "https://*.example.com",
    "https://user@example.com",
    "https://example.com/studio",
    "https://example.com?next=/studio",
    "https://example.com#studio",
  ])("rejects a value that is not an exact origin: %s", (value) => {
    expect(validateOAuthAccessOrigin(value)).toBe(false);
  });

  it("preserves the existing row id from a duplicate response", () => {
    const error = new axios.AxiosError("conflict", undefined, undefined, undefined, {
      config: { headers: new axios.AxiosHeaders() },
      data: { error_details: { existing_id: "origin-existing" } },
      headers: {},
      status: 409,
      statusText: "Conflict",
    });

    expect(resolveOAuthAccessOriginError(error)).toEqual({
      code: "conflict",
      existingId: "origin-existing",
    });
  });
});
