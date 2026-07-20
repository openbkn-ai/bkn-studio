/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeLogin,
  computeCodeChallenge,
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
