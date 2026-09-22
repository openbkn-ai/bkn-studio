/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { consumeApiKeyHandoff, saveApiKeyHandoff } from "./api-key-handoff";

describe("API key handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
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
});
