/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useResolvedTheme } from "@/app/theme/theme-context";

type MediaChangeListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initiallyDark: boolean) {
  let isDark = initiallyDark;
  const listeners = new Set<MediaChangeListener>();
  const mediaQuery = {
    get matches() {
      return isDark;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (type: string, listener: MediaChangeListener) => {
      if (type === "change") {
        listeners.add(listener);
      }
    },
    removeEventListener: (type: string, listener: MediaChangeListener) => {
      if (type === "change") {
        listeners.delete(listener);
      }
    },
    addListener: (listener: MediaChangeListener) => listeners.add(listener),
    removeListener: (listener: MediaChangeListener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } satisfies MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return {
    changeTheme(nextIsDark: boolean) {
      isDark = nextIsDark;
      const event = { matches: nextIsDark, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function installLegacyMatchMedia(initiallyDark: boolean) {
  let isDark = initiallyDark;
  const listeners = new Set<MediaChangeListener>();
  const mediaQuery = {
    get matches() {
      return isDark;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: (listener: MediaChangeListener) => listeners.add(listener),
    removeListener: (listener: MediaChangeListener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return {
    changeTheme(nextIsDark: boolean) {
      isDark = nextIsDark;
      const event = { matches: nextIsDark, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function ThemeValue() {
  return <output>{useResolvedTheme()}</output>;
}

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("color-scheme");
});

describe("ThemeProvider", () => {
  it("uses the operating-system theme when mounted", () => {
    installMatchMedia(true);

    renderWithTheme(<ThemeValue />);

    expect(screen.getByRole("status").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("updates the document and consumers when the operating-system theme changes", () => {
    const systemTheme = installMatchMedia(false);

    renderWithTheme(<ThemeValue />);
    expect(screen.getByRole("status").textContent).toBe("light");

    act(() => {
      systemTheme.changeTheme(true);
    });

    expect(screen.getByRole("status").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("supports legacy embedded browsers that expose only addListener", () => {
    const systemTheme = installLegacyMatchMedia(false);

    renderWithTheme(<ThemeValue />);

    act(() => {
      systemTheme.changeTheme(true);
    });

    expect(screen.getByRole("status").textContent).toBe("dark");
  });
});
