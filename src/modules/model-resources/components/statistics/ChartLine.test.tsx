/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@/app/theme/theme-context";

import { ChartLine } from "./ChartLine";

const { chart, init } = vi.hoisted(() => {
  const chart = {
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn(),
  };

  return { chart, init: vi.fn(() => chart) };
});

vi.mock("echarts", () => ({ init }));

function withTheme(theme: "dark" | "light", children: ReactNode) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

describe("ChartLine", () => {
  it("updates options without recreating the chart, and recreates it when the theme changes", () => {
    const firstOption = { series: [] };
    const secondOption = { series: [{ data: [1] }] };
    const view = render(withTheme("light", <ChartLine option={firstOption} />));

    expect(init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalledWith(firstOption, true);

    view.rerender(withTheme("light", <ChartLine option={secondOption} />));

    expect(init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenLastCalledWith(secondOption, true);

    view.rerender(withTheme("dark", <ChartLine option={secondOption} />));

    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(2);
    expect(init).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), "dark");
  });
});
