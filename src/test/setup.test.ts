/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

describe("test environment setup", () => {
  it("falls back to element styles for unsupported pseudo-elements without logging an error", () => {
    const element = document.createElement("div");
    element.style.color = "rgb(1, 2, 3)";
    document.body.append(element);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const style = window.getComputedStyle(element, "::before");

    expect(style.color).toBe("rgb(1, 2, 3)");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    element.remove();
  });
});
