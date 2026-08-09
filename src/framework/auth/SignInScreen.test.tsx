/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInScreen } from "@/framework/auth/SignInScreen";

const oauth = vi.hoisted(() => ({
  beginLogin: vi.fn(() => Promise.resolve()),
  canAutoStartLogin: vi.fn(() => true),
}));

vi.mock("@/framework/auth/oauth", () => oauth);

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});

/** jsdom reports "visible" by default; override per test. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("SignInScreen auto-redirect gating", () => {
  beforeEach(() => {
    oauth.beginLogin.mockClear();
    oauth.canAutoStartLogin.mockReset();
    oauth.canAutoStartLogin.mockReturnValue(true);
    setVisibility("visible");
  });

  it("redirects to hydra on its own when nothing else owns the flow", () => {
    render(<SignInScreen onDevTokenSaved={vi.fn()} />);

    expect(oauth.beginLogin).toHaveBeenCalledTimes(1);
  });

  // A background tab redirecting would rewrite the browser's single login CSRF
  // cookie and break the tab the user is actually signing in on (issue #387).
  it("stays put while the tab is hidden", () => {
    setVisibility("hidden");

    render(<SignInScreen onDevTokenSaved={vi.fn()} />);

    expect(oauth.beginLogin).not.toHaveBeenCalled();
  });

  it("redirects once the hidden tab is brought to the front", () => {
    setVisibility("hidden");
    render(<SignInScreen onDevTokenSaved={vi.fn()} />);
    expect(oauth.beginLogin).not.toHaveBeenCalled();

    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(oauth.beginLogin).toHaveBeenCalledTimes(1);
  });

  it("defers to another tab's in-flight login and offers a manual takeover", async () => {
    oauth.canAutoStartLogin.mockReturnValue(false);

    render(<SignInScreen onDevTokenSaved={vi.fn()} />);

    expect(oauth.beginLogin).not.toHaveBeenCalled();
    expect(await screen.findByText("auth.signInOtherTabTitle")).toBeTruthy();

    // Explicit intent wins: the user is on this tab, so it takes the flow over.
    act(() => {
      screen.getByRole("button", { name: "auth.signInButton" }).click();
    });

    expect(oauth.beginLogin).toHaveBeenCalledTimes(1);
  });
});
