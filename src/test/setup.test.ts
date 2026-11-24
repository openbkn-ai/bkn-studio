/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Input } from "antd";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { expect, it, vi } from "vitest";

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

it("keeps autosizing textarea heights finite without the injected antd styles", () => {
  const consoleError = vi.spyOn(console, "error");
  try {
    const { getByRole } = render(
      createElement(Input.TextArea, {
        autoSize: { minRows: 2, maxRows: 5 },
        variant: "borderless",
        "aria-label": "Prompt",
      }),
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    expect(Number.isFinite(Number.parseFloat(textarea.style.height))).toBe(true);
    const heightWarnings = consoleError.mock.calls.filter((args) =>
      args.some((value: unknown) => typeof value === "string" && value.includes("height")),
    );
    expect(heightWarnings).toEqual([]);
  } finally {
    consoleError.mockRestore();
  }
});

it("preserves explicit textarea sizing styles over the test defaults", () => {
  const { getByRole } = render(
    createElement(Input.TextArea, { style: { padding: "7px", border: "3px solid" } }),
  );
  const style = getComputedStyle(getByRole("textbox"));
  expect(style.paddingTop).toBe("7px");
  expect(style.paddingBottom).toBe("7px");
  expect(style.borderTopWidth).toBe("3px");
  expect(style.borderBottomWidth).toBe("3px");
});
