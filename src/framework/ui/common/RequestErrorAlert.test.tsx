/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestErrorAlert } from "./RequestErrorAlert";

const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const writeTextToClipboardMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { value?: string }) =>
        options?.value ? `${key}: ${options.value}` : key,
    }),
  };
});

vi.mock("@/framework/compat/clipboard", () => ({
  writeTextToClipboard: writeTextToClipboardMock,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

describe("RequestErrorAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("reports feedback after copying expanded error details", async () => {
    writeTextToClipboardMock.mockResolvedValue(undefined);
    render(
      <RequestErrorAlert
        autoDismissMs={0}
        error={{ code: "BuildTask.CreateFailed", description: "Build failed" }}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("common.viewDetails"));
    fireEvent.click(screen.getByText("common.copy"));

    await waitFor(() => {
      expect(writeTextToClipboardMock).toHaveBeenCalledWith(
        "Build failed\ncommon.error.code: BuildTask.CreateFailed",
      );
      expect(messageMock.success).toHaveBeenCalledWith("common.copySuccess");
    });
  });
});
