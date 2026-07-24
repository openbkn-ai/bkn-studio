/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourceColorSelect } from "./ResourceColorSelect";
import { ResourceIconSelect } from "./ResourceIconSelect";

afterEach(() => {
  cleanup();
});

describe("resource appearance selectors", () => {
  it("opens the color palette outside a modal and emits the selected color", () => {
    const onChange = vi.fn();
    render(<ResourceColorSelect inModal={false} onChange={onChange} value="#0e5fc5" />);

    fireEvent.click(screen.getByRole("button"));

    const colorButtons = screen.getAllByRole("button");
    expect(colorButtons).toHaveLength(15);

    fireEvent.click(colorButtons[3]);
    expect(onChange).toHaveBeenCalledWith("#323232");
  });

  it("opens the icon panel and emits a selected icon", () => {
    const onChange = vi.fn();
    render(<ResourceIconSelect inModal={false} onChange={onChange} value="icon-yingyongguanli" />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByPlaceholderText("输入关键词筛选图标")).toBeTruthy();

    const iconButtons = screen.getAllByRole("button");
    fireEvent.click(iconButtons[2]);
    expect(onChange).toHaveBeenCalled();
  });
});
