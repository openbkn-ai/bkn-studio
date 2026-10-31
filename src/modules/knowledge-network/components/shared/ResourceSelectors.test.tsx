/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";

import { ResourceColorSelect } from "./ResourceColorSelect";
import {
  DEFAULT_RESOURCE_ICON,
  RESOURCE_ICON_OPTIONS,
  ResourceIconSelect,
  renderResourceIcon,
} from "./ResourceIconSelect";

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
});

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

    fireEvent.change(screen.getByPlaceholderText("Search icons by keyword"), {
      target: { value: "代码" },
    });

    fireEvent.click(screen.getByTitle("代码"));
    expect(onChange).toHaveBeenCalledWith("icon-daima");
  });

  it("emits the default icon when the value is empty", () => {
    const onChange = vi.fn();
    render(<ResourceIconSelect inModal={false} onChange={onChange} />);

    expect(onChange).toHaveBeenCalledWith(DEFAULT_RESOURCE_ICON);
  });

  it("injects a drawable symbol for every icon option and keeps icon references compatible", () => {
    const { container } = render(
      <>
        {renderResourceIcon("icon-yingyongguanli")}
        <ResourceIconSelect inModal={false} value="icon-yingyongguanli" />
      </>,
    );

    const sprite = document.getElementById("resource-iconfont-dip-object-sprite");
    const symbolIds = Array.from(sprite?.querySelectorAll("symbol") ?? [], (symbol) => symbol.id);
    expect(symbolIds).toHaveLength(RESOURCE_ICON_OPTIONS.length);
    expect(new Set(symbolIds)).toEqual(
      new Set(RESOURCE_ICON_OPTIONS.map((option) => option.value)),
    );

    for (const symbolId of symbolIds) {
      const symbol = sprite?.querySelector(`#${symbolId}`);
      expect(symbol?.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(symbol?.querySelector("path[d]")).toBeTruthy();
    }

    const renderedUse = container.querySelector("use");
    expect(renderedUse?.getAttribute("href") ?? renderedUse?.getAttribute("xlink:href")).toBe(
      "#icon-yingyongguanli",
    );
  });
});
