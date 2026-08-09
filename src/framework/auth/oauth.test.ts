/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canAutoStartLogin,
  completeLogin,
  computeCodeChallenge,
  consumeCsrfRetry,
  isCsrfConflictCallback,
  shouldUseOAuthGate,
} from "@/framework/auth/oauth";

describe("oauth", () => {
  beforeEach(() => {
    if (!window.crypto?.subtle) {
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: webcrypto,
      });
    }
    window.sessionStorage.clear();
    window.localStorage.clear();
    for (const part of document.cookie ? document.cookie.split("; ") : []) {
      const name = part.split("=")[0];
      if (name) {
        document.cookie = `${name}=; path=/; max-age=0`;
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes the RFC 7636 S256 code challenge", async () => {
    await expect(
      computeCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("rejects the callback when the state does not match", async () => {
    window.sessionStorage.setItem("bkn_oauth_state", "expected");
    window.sessionStorage.setItem("bkn_oauth_verifier", "verifier");

    await expect(completeLogin("?code=abc&state=tampered")).rejects.toThrow(
      /state mismatch/i,
    );
  });

  it("surfaces authorization errors from the callback URL", async () => {
    await expect(
      completeLogin("?error=access_denied&error_description=user%20denied"),
    ).rejects.toThrow("user denied");
  });

  it("exchanges the code, stores tokens, and returns the saved path", async () => {
    window.sessionStorage.setItem("bkn_oauth_state", "state-1");
    window.sessionStorage.setItem("bkn_oauth_verifier", "verifier-1");
    window.sessionStorage.setItem("bkn_oauth_return_to", "/knowledge-network");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-1",
          id_token: "id-1",
          refresh_token: "refresh-1",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    await expect(completeLogin("?code=abc&state=state-1")).resolves.toBe(
      "/knowledge-network",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/oauth2/token",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("openbkn-studio");
    expect(body.get("code_verifier")).toBe("verifier-1");
    expect(body.get("redirect_uri")).toBe("http://localhost:3000/studio/callback");

    expect(document.cookie).toContain("bkn_access_token=access-1");
    expect(document.cookie).toContain("bkn_refresh_token=refresh-1");
    expect(document.cookie).toContain("bkn_id_token=id-1");
    expect(window.sessionStorage.getItem("bkn_access_token")).toBeNull();
    expect(window.sessionStorage.getItem("bkn_oauth_state")).toBeNull();
    expect(window.sessionStorage.getItem("bkn_oauth_verifier")).toBeNull();
    expect(window.sessionStorage.getItem("bkn_oauth_return_to")).toBeNull();
  });

  it("rejects a token response without an access_token", async () => {
    window.sessionStorage.setItem("bkn_oauth_state", "state-1");
    window.sessionStorage.setItem("bkn_oauth_verifier", "verifier-1");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }),
    );

    await expect(completeLogin("?code=abc&state=state-1")).rejects.toThrow(
      "invalid_grant",
    );
  });
});

// Regression: forced first-login password change. The user sits on the
// bkn-safe login + change-password pages for a minute or more, which is long
// enough for another Studio tab to start its own /oauth2/auth and overwrite
// the browser's single login CSRF cookie — hydra then rejects the original
// flow with request_forbidden. See issue #387.
describe("login CSRF flow lock", () => {
  const FLOW_LOCK_KEY = "bkn_oauth_flow_lock";

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  function currentTabId() {
    // canAutoStartLogin seeds the per-tab id on first use.
    canAutoStartLogin();
    return window.sessionStorage.getItem("bkn_oauth_tab_id") ?? "";
  }

  it("allows an automatic redirect when no flow is in progress", () => {
    expect(canAutoStartLogin()).toBe(true);
  });

  it("blocks an automatic redirect while another tab owns the flow", () => {
    window.localStorage.setItem(
      FLOW_LOCK_KEY,
      JSON.stringify({ startedAt: Date.now(), tabId: "some-other-tab" }),
    );

    expect(canAutoStartLogin()).toBe(false);
  });

  it("ignores this tab's own lock so navigating back can restart the flow", () => {
    const tabId = currentTabId();
    window.localStorage.setItem(
      FLOW_LOCK_KEY,
      JSON.stringify({ startedAt: Date.now(), tabId }),
    );

    expect(canAutoStartLogin()).toBe(true);
  });

  it("releases an abandoned lock once it ages out", () => {
    window.localStorage.setItem(
      FLOW_LOCK_KEY,
      JSON.stringify({
        startedAt: Date.now() - 4 * 60 * 1000,
        tabId: "some-other-tab",
      }),
    );

    expect(canAutoStartLogin()).toBe(true);
  });

  it("ignores a malformed lock rather than deadlocking sign-in", () => {
    window.localStorage.setItem(FLOW_LOCK_KEY, "not json");
    expect(canAutoStartLogin()).toBe(true);

    window.localStorage.setItem(FLOW_LOCK_KEY, JSON.stringify({ tabId: 42 }));
    expect(canAutoStartLogin()).toBe(true);
  });
});

describe("callback CSRF recovery", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recognises hydra's stale-CSRF rejection", () => {
    expect(isCsrfConflictCallback("?error=request_forbidden")).toBe(true);
    expect(
      isCsrfConflictCallback(
        "?error=some_other&error_description=" +
          encodeURIComponent(
            "The CSRF value from the token does not match the CSRF value from the data store.",
          ),
      ),
    ).toBe(true);
  });

  it("leaves unrelated callback errors alone", () => {
    expect(isCsrfConflictCallback("?error=access_denied")).toBe(false);
    expect(isCsrfConflictCallback("?code=abc&state=state-1")).toBe(false);
  });

  it("permits exactly one automatic retry per tab", () => {
    expect(consumeCsrfRetry()).toBe(true);
    expect(consumeCsrfRetry()).toBe(false);
  });

  it("clears the retry budget and the flow lock on a successful login", async () => {
    window.sessionStorage.setItem("bkn_oauth_state", "state-1");
    window.sessionStorage.setItem("bkn_oauth_verifier", "verifier-1");
    window.localStorage.setItem(
      "bkn_oauth_flow_lock",
      JSON.stringify({ startedAt: Date.now(), tabId: "some-other-tab" }),
    );
    // Spend the retry budget, as a first failed attempt would.
    expect(consumeCsrfRetry()).toBe(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "access-1" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await completeLogin("?code=abc&state=state-1");

    expect(window.localStorage.getItem("bkn_oauth_flow_lock")).toBeNull();
    expect(consumeCsrfRetry()).toBe(true);
  });
});

describe("shouldUseOAuthGate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // No-auth / no-bkn-safe contract: a deploy that injects mode:"hosted"
  // (config.js override) must NEVER trigger the OAuth gate, whatever the build
  // mode — AuthGate then renders the app directly as the default user, no login.
  it("never gates in hosted mode", () => {
    expect(shouldUseOAuthGate("hosted")).toBe(false);
  });

  // Standalone against a real backend (mock off) must gate — that path needs a
  // bkn-safe/hydra login.
  it("gates standalone against a real backend", () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    expect(shouldUseOAuthGate("standalone")).toBe(true);
  });
});
