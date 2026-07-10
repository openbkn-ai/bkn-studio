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
  it("shows created HTTP capability context and maps next actions to existing pages", () => {
    const onViewToolset = vi.fn();
    const onDebug = vi.fn();
    const onEditTool = vi.fn();
    const onClose = vi.fn();

    render(
      <CapabilityCreatedNextSteps
        onClose={onClose}
        onCompleteContract={onEditTool}
        onDebug={onDebug}
        onViewToolset={onViewToolset}
        toolName="query_weather"
        toolboxName="weather_toolbox"
      />,
    );

    expect(screen.getByTestId("capability-created-next-steps")).toBeTruthy();
    expect(screen.getByText("query_weather")).toBeTruthy();
    expect(screen.getByText("weather_toolbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Agent/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "查看工具集" }));
    fireEvent.click(screen.getByRole("button", { name: "去调试" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑工具信息" }));
    fireEvent.click(screen.getByRole("button", { name: /关\s*闭/ }));

    expect(onViewToolset).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onEditTool).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
