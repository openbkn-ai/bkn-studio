/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInstallStatusUrl,
  resolveConfiguredInstallStatusUrl,
} from "@/framework/runtime/install-status-url";

describe("resolveConfiguredInstallStatusUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for blank input", () => {
    expect(resolveConfiguredInstallStatusUrl("")).toBeNull();
    expect(resolveConfiguredInstallStatusUrl("   ")).toBeNull();
  });

  it("joins relative paths with window origin", () => {
    vi.stubGlobal("window", { location: { origin: "https://gateway.example.com" } });
    expect(resolveConfiguredInstallStatusUrl("/install-status")).toBe(
      "https://gateway.example.com/install-status",
    );
  });

  it("returns relative paths without window", () => {
    vi.stubGlobal("window", undefined);
    expect(resolveConfiguredInstallStatusUrl("/install-status")).toBe("/install-status");
  });

  it("rejects non-http(s) protocols", () => {
    expect(resolveConfiguredInstallStatusUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(resolveConfiguredInstallStatusUrl("not a url")).toBeNull();
  });

  it("accepts absolute https URLs", () => {
    expect(resolveConfiguredInstallStatusUrl("https://example.com/install-status")).toBe(
      "https://example.com/install-status",
    );
  });
});

describe("getInstallStatusUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefers configured env override", () => {
    vi.stubEnv("VITE_INSTALL_STATUS_URL", "https://remote.example/install-status");
    expect(getInstallStatusUrl()).toBe("https://remote.example/install-status");
  });

  it("falls back to same-origin default", () => {
    vi.stubEnv("VITE_INSTALL_STATUS_URL", "");
    vi.stubGlobal("window", { location: { origin: "https://gateway.example.com" } });
    expect(getInstallStatusUrl()).toBe("https://gateway.example.com/install-status");
  });
});
