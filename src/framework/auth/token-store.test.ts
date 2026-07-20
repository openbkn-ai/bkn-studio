/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredIdToken,
  getStoredRefreshToken,
  storeTokens,
} from "@/framework/auth/token-store";

function clearDocumentCookies() {
  for (const part of document.cookie ? document.cookie.split("; ") : []) {
    const name = part.split("=")[0];
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

describe("token-store", () => {
  beforeEach(() => {
    clearDocumentCookies();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    clearDocumentCookies();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and reads tokens from cookies", () => {
    storeTokens({
      accessToken: " access-1 ",
      refreshToken: "refresh-1",
      idToken: "id-1",
    });

    expect(getStoredAccessToken()).toBe("access-1");
    expect(getStoredRefreshToken()).toBe("refresh-1");
    expect(getStoredIdToken()).toBe("id-1");
    expect(window.sessionStorage.getItem("bkn_access_token")).toBeNull();
  });

  it("migrates legacy sessionStorage tokens into cookies once", () => {
    window.sessionStorage.setItem("bkn_access_token", "legacy-access");
    window.sessionStorage.setItem("bkn_refresh_token", "legacy-refresh");
    window.sessionStorage.setItem("bkn_id_token", "legacy-id");

    expect(getStoredAccessToken()).toBe("legacy-access");
    expect(getStoredRefreshToken()).toBe("legacy-refresh");
    expect(getStoredIdToken()).toBe("legacy-id");
    expect(window.sessionStorage.getItem("bkn_access_token")).toBeNull();
  });

  it("keeps existing id token when refresh omits id_token", () => {
    storeTokens({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      idToken: "id-1",
    });

    storeTokens({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });

    expect(getStoredAccessToken()).toBe("access-2");
    expect(getStoredRefreshToken()).toBe("refresh-2");
    expect(getStoredIdToken()).toBe("id-1");
  });

  it("clears cookies and broadcasts logout to other tabs", () => {
    storeTokens({ accessToken: "access-1", refreshToken: "refresh-1" });

    const postMessage = vi.fn();
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        postMessage = postMessage;
        addEventListener() {
          return undefined;
        }
        removeEventListener() {
          return undefined;
        }
        close() {
          return undefined;
        }
      },
    );

    clearStoredTokens();

    expect(getStoredAccessToken()).toBe("");
    expect(getStoredRefreshToken()).toBe("");
    expect(postMessage).toHaveBeenCalledWith({ type: "logout" });
  });
});
