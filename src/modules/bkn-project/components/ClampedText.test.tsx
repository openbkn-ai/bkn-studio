/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClampedText } from "./ClampedText";

const LONG = "供应链里按物料、仓库和日期记录的库存快照，".repeat(8);

function overflow(element: HTMLElement, scrollHeight: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: 40 });
}

describe("ClampedText", () => {
  it("keeps a long description to two lines and shows all of it on hover", async () => {
    render(<ClampedText className="muted" text={LONG} />);
    const text = screen.getByTestId("clamped-text");
    expect(text).toHaveTextContent(LONG);
    expect(text).toHaveClass("muted");

    overflow(text, 120);
    fireEvent.mouseEnter(text);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG);
  });

  it("shows no tooltip when nothing was cut", () => {
    render(<ClampedText text="库存快照" />);
    const text = screen.getByTestId("clamped-text");
    overflow(text, 40);
    fireEvent.mouseEnter(text);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
