/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { EvalAssistantResizeHandle } from "./EvalAssistantResizeHandle";
import { evalLocales } from "./locales";

let containerWidth = 1200;

function Harness() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <div ref={containerRef} data-testid="container">
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && <EvalAssistantResizeHandle containerRef={containerRef} />}
    </div>
  );
}

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});

beforeEach(() => {
  containerWidth = 1200;
  vi.stubGlobal("ResizeObserver", undefined);
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    width: containerWidth,
    height: 800,
    x: 0,
    y: 0,
    left: 0,
    right: containerWidth,
    top: 0,
    bottom: 800,
    toJSON: () => ({}),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("drags left to expand the assistant, bounds its width, and stops on pointer cancellation", () => {
  render(<Harness />);
  const handle = screen.getByRole("separator", { name: "调整 AI 助手宽度" });
  const capture = vi.fn();
  Object.defineProperty(handle, "setPointerCapture", { value: capture });
  const initial = Number(handle.getAttribute("aria-valuenow"));
  fireEvent.pointerDown(handle, { button: 0, pointerId: 7, clientX: 800 });
  expect(capture).toHaveBeenCalledWith(7);
  fireEvent.pointerMove(handle, { pointerId: 8, clientX: 600 });
  expect(handle).toHaveAttribute("aria-valuenow", String(initial));
  fireEvent.pointerMove(handle, { pointerId: 7, clientX: 600 });
  expect(screen.getByTestId("container").style.getPropertyValue("--eval-assistant-width")).toBe(
    `${initial + 200}px`,
  );
  fireEvent.pointerMove(handle, { pointerId: 7, clientX: -2000 });
  expect(handle).toHaveAttribute("aria-valuenow", handle.getAttribute("aria-valuemax"));
  fireEvent.pointerMove(handle, { pointerId: 7, clientX: 4000 });
  expect(handle).toHaveAttribute("aria-valuenow", "360");
  fireEvent.pointerCancel(handle, { pointerId: 7 });
  fireEvent.pointerMove(handle, { pointerId: 7, clientX: 600 });
  expect(handle).toHaveAttribute("aria-valuenow", "360");
  expect(screen.getByTestId("container")).not.toHaveAttribute("data-assistant-resizing");
});

it("supports keyboard resizing, retains width on reopening, and adapts to a narrower workspace", () => {
  render(<Harness />);
  let handle = screen.getByRole("separator");
  fireEvent.keyDown(handle, { key: "End" });
  expect(handle).toHaveAttribute("aria-valuenow", "872");
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(handle).toHaveAttribute("aria-valuenow", "848");
  fireEvent.click(screen.getByText("Toggle"));
  fireEvent.click(screen.getByText("Toggle"));
  handle = screen.getByRole("separator");
  expect(handle).toHaveAttribute("aria-valuenow", "848");
  containerWidth = 500;
  fireEvent(window, new Event("resize"));
  expect(Number(handle.getAttribute("aria-valuenow"))).toBeLessThan(500);
  containerWidth = 1200;
  fireEvent(window, new Event("resize"));
  expect(handle).toHaveAttribute("aria-valuenow", "848");
  fireEvent.doubleClick(handle);
  expect(Number(handle.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(520);
});
