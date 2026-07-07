/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CapabilityCreatedNextSteps } from "@/modules/execution-factory/components/create-menu/CapabilityCreatedNextSteps";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe("CapabilityCreatedNextSteps", () => {
  it("shows created HTTP capability context and exposes next actions", () => {
    const onViewToolset = vi.fn();
    const onDebug = vi.fn();
    const onCompleteContract = vi.fn();
    const onClose = vi.fn();

    render(
      <CapabilityCreatedNextSteps
        onClose={onClose}
        onCompleteContract={onCompleteContract}
        onDebug={onDebug}
        onViewToolset={onViewToolset}
        toolName="query_weather"
        toolboxName="weather_toolbox"
      />,
    );

    expect(screen.getByTestId("capability-created-next-steps")).toBeTruthy();
    expect(screen.getByText("query_weather")).toBeTruthy();
    expect(screen.getByText("weather_toolbox")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /查看工具集|View toolset|鏌ョ湅/i }));
    fireEvent.click(screen.getByRole("button", { name: /调试|Debug|璋冭瘯/i }));
    fireEvent.click(screen.getByRole("button", { name: /Agent/i }));
    fireEvent.click(screen.getByRole("button", { name: /关\s*闭|Close|鍏\s*抽棴/i }));

    expect(onViewToolset).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onCompleteContract).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
