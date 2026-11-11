/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button } from "antd";
import { render } from "@testing-library/react";
import { createElement } from "react";
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

it("keeps the styles antd injects empty so getComputedStyle stays cheap", () => {
  render(createElement(Button, null, "OK"));

  const injected = [...document.head.querySelectorAll("style[data-rc-order]")];
  // If antd stops tagging its style nodes this way, setup.ts no longer empties
  // them and every scene test silently slows down by an order of magnitude.
  expect(injected.length).toBeGreaterThan(0);
  expect(injected.map((style) => style.innerHTML)).toEqual(injected.map(() => ""));
});

it("still hides what antd marks with a hidden state class", () => {
  const closedDropdown = document.createElement("div");
  closedDropdown.className = "ant-dropdown ant-dropdown-hidden";
  document.body.append(closedDropdown);

  try {
    expect(closedDropdown).not.toBeVisible();
  } finally {
    closedDropdown.remove();
  }
});
