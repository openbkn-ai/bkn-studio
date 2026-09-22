/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consumeApiKeyHandoff, saveApiKeyHandoff } from "./api-key-handoff";

describe("API key handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a one-time API key handoff out of Web Storage", () => {
    const handoffId = saveApiKeyHandoff("/studio/knowledge-network", "bak_sensitive-key");

    expect(handoffId).toEqual(expect.any(String));
    expect(window.sessionStorage.length).toBe(0);
    expect(consumeApiKeyHandoff("/studio/knowledge-network", handoffId)).toBe("bak_sensitive-key");
    expect(consumeApiKeyHandoff("/studio/knowledge-network", handoffId)).toBeNull();
  });

  it("rejects external return paths", () => {
    expect(saveApiKeyHandoff("//attacker.example", "bak_sensitive-key")).toBeNull();
  });

  it("uses getRandomValues when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    const handoffId = saveApiKeyHandoff("/studio/knowledge-network", "bak_sensitive-key");

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(handoffId).toBe("000102030405060708090a0b0c0d0e0f");
  });

  it("fails closed when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    expect(saveApiKeyHandoff("/studio/knowledge-network", "bak_sensitive-key")).toBeNull();
  });
});
