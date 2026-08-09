/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthCallback } from "@/framework/auth/OAuthCallback";

const oauth = vi.hoisted(() => ({
  beginLogin: vi.fn(() => Promise.resolve()),
  completeLogin: vi.fn(() => Promise.resolve("/studio/")),
  consumeCsrfRetry: vi.fn(() => true),
  getStoredReturnTo: vi.fn(() => "/studio/knowledge-network"),
  isCsrfConflictCallback: vi.fn(() => false),
  releaseFlowLock: vi.fn(),
  stashCallbackError: vi.fn(),
  takeStashedCallbackError: vi.fn(() => null as string | null),
}));

vi.mock("@/framework/auth/oauth", () => oauth);

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("@/app/router/app-paths", () => ({
  getAppHomePath: () => "/studio/",
}));

describe("OAuthCallback CSRF recovery wiring", () => {
  beforeEach(() => {
    for (const spy of Object.values(oauth)) {
      if (typeof spy === "function" && "mockClear" in spy) {
        spy.mockClear();
      }
    }
    oauth.isCsrfConflictCallback.mockReturnValue(false);
    oauth.consumeCsrfRetry.mockReturnValue(true);
    oauth.completeLogin.mockResolvedValue("/studio/");
    oauth.takeStashedCallbackError.mockReturnValue(null);
  });

  it("exchanges the code on a normal callback", () => {
    render(<OAuthCallback />);

    expect(oauth.completeLogin).toHaveBeenCalledTimes(1);
    expect(oauth.beginLogin).not.toHaveBeenCalled();
    // The retry budget must survive a successful callback.
    expect(oauth.consumeCsrfRetry).not.toHaveBeenCalled();
  });

  it("restarts the flow instead of stranding the user on a stale-CSRF error", () => {
    oauth.isCsrfConflictCallback.mockReturnValue(true);

    render(<OAuthCallback />);

    expect(oauth.beginLogin).toHaveBeenCalledWith("/studio/knowledge-network");
    expect(oauth.completeLogin).not.toHaveBeenCalled();
    expect(oauth.stashCallbackError).toHaveBeenCalledTimes(1);
  });

  it("falls through to the error page once the retry budget is spent", async () => {
    oauth.isCsrfConflictCallback.mockReturnValue(true);
    oauth.consumeCsrfRetry.mockReturnValue(false);
    oauth.completeLogin.mockRejectedValue(new Error("second attempt failed"));
    oauth.takeStashedCallbackError.mockReturnValue("the original reason");

    render(<OAuthCallback />);

    expect(oauth.beginLogin).not.toHaveBeenCalled();
    expect(oauth.completeLogin).toHaveBeenCalledTimes(1);
    // The retry's own message describes the retry, not the real cause.
    expect(await screen.findByText("the original reason")).toBeTruthy();
    expect(oauth.releaseFlowLock).toHaveBeenCalled();
  });

  it("releases the flow lock when the callback fails outright", async () => {
    oauth.completeLogin.mockRejectedValue(new Error("OAuth state mismatch"));

    render(<OAuthCallback />);

    expect(await screen.findByText("OAuth state mismatch")).toBeTruthy();
    expect(oauth.releaseFlowLock).toHaveBeenCalledTimes(1);
  });
});
