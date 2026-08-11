/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { CapabilityCreatedNextSteps } from "@/modules/execution-factory/components/create-menu/CapabilityCreatedNextSteps";

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
});

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

    fireEvent.click(screen.getByRole("button", { name: "View toolset" }));
    fireEvent.click(screen.getByRole("button", { name: "Debug" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit tool info" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onViewToolset).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onEditTool).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
