/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";

it("reads the scrollbar pseudo-element without a jsdom not-implemented warning", () => {
  const element = document.createElement("div");
  element.style.width = "25px";
  const warnings: Error[] = [];
  const virtualConsole = (
    globalThis as typeof globalThis & {
      jsdom: {
        virtualConsole: {
          on(event: string, listener: (error: Error) => void): void;
          off(event: string, listener: (error: Error) => void): void;
        };
      };
    }
  ).jsdom.virtualConsole;
  const captureWarning = (error: Error) => warnings.push(error);
  virtualConsole.on("jsdomError", captureWarning);

  try {
    const style = getComputedStyle(element, "::-webkit-scrollbar");

    expect(style.width).toBe("25px");
    expect(warnings).toEqual([]);
  } finally {
    virtualConsole.off("jsdomError", captureWarning);
  }
});
