/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestErrorAlert } from "./RequestErrorAlert";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { value?: string }) =>
      options?.value ? `${key}: ${options.value}` : key,
  }),
}));

describe("RequestErrorAlert", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dismisses the summary after ten seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(<RequestErrorAlert error={{ description: "Build failed" }} onDismiss={onDismiss} />);

    void act(() => vi.advanceTimersByTime(9999));
    expect(onDismiss).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps the alert open after the user expands error details", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <RequestErrorAlert
        error={{ code: "BuildTask.CreateFailed", description: "Build failed", details: "No key" }}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByText("common.viewDetails"));
    expect(screen.getByText("common.error.details: No key")).toBeTruthy();
    void act(() => vi.advanceTimersByTime(10000));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
