/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { EvalComparisonColumnHandle } from "./EvalComparisonColumnHandle";
import { evalLocales } from "./locales";

const comparisonColumnWidths = [18, 23, 30, 29];

function Harness() {
  const [widths, setWidths] = useState(comparisonColumnWidths);
  return (
    <>
      <output data-testid="widths">{JSON.stringify(widths)}</output>
      <table>
        <thead>
          <tr>
            <th>
              <EvalComparisonColumnHandle
                index={1}
                widths={widths}
                onChange={setWidths}
                onReset={() => setWidths(comparisonColumnWidths)}
                label="调整判定标准与实际结果宽度"
              />
            </th>
          </tr>
        </thead>
      </table>
    </>
  );
}
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "zh-CN", resources: evalLocales });
});
beforeEach(() => {
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
  vi.spyOn(HTMLTableElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 1000,
  } as DOMRect);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const widths = (): number[] =>
  JSON.parse(screen.getByTestId("widths").textContent ?? "") as number[];

it("resizes adjacent columns with the pointer, bounds them and stops after cancellation", () => {
  render(<Harness />);
  const handle = screen.getByRole("separator", { name: "调整判定标准与实际结果宽度" });
  Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 });
  expect(widths()).toEqual([18, 33, 20, 29]);
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 4000 });
  expect(widths()).toEqual([18, 35, 18, 29]);
  fireEvent.pointerMove(handle, { pointerId: 2, clientX: 0 });
  expect(widths()).toEqual([18, 35, 18, 29]);
  fireEvent.pointerCancel(handle);
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
  expect(widths()).toEqual([18, 35, 18, 29]);
});

it("supports keyboard resizing and restores defaults on double click", () => {
  render(<Harness />);
  const handle = screen.getByRole("separator");
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(widths()).toEqual([18, 25, 28, 29]);
  fireEvent.keyDown(handle, { key: "Home" });
  expect(widths()).toEqual([18, 18, 35, 29]);
  fireEvent.doubleClick(handle);
  expect(widths()).toEqual(comparisonColumnWidths);
});
