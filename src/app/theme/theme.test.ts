/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createThemeConfig, darkPrimaryFor } from "@/app/theme/theme";
import type { RuntimeConfig } from "@/framework/runtime/types";

const runtimeConfig: RuntimeConfig = {
  apiBaseUrl: "/api",
  auth: {
    tokenManager: {
      getAccessToken: () => null,
      refreshAccessToken: () => Promise.resolve(null),
    },
  },
  currentUser: {
    id: null,
    isAdmin: false,
    isSuperAdmin: false,
    name: null,
    permissions: [],
    roles: [],
  },
  locale: "zh-CN",
  mode: "standalone",
  router: { basename: "/studio" },
  theme: {
    borderRadius: 0,
    primaryColor: "#1e3a8a",
  },
};

describe("createThemeConfig", () => {
  it("keeps selectable table row states light and visually distinct", () => {
    const tableTokens = createThemeConfig(runtimeConfig, "light").components?.Table;

    if (!tableTokens) {
      throw new Error("Table theme tokens are not configured");
    }

    const requiredColor = (value: string | undefined, name: string) => {
      if (typeof value !== "string") {
        throw new Error(`${name} table theme token is not configured`);
      }

      return value;
    };

    const rowHoverBg = requiredColor(tableTokens.rowHoverBg, "rowHoverBg");
    const rowSelectedBg = requiredColor(tableTokens.rowSelectedBg, "rowSelectedBg");
    const rowSelectedHoverBg = requiredColor(tableTokens.rowSelectedHoverBg, "rowSelectedHoverBg");
    const rowColors = [rowHoverBg, rowSelectedBg, rowSelectedHoverBg];

    expect(new Set(rowColors).size).toBe(3);
    expect(rowColors.every((color) => /^#[\da-f]{6}$/i.test(color))).toBe(true);

    const luminance = (color: string) => {
      const channels = color
        .slice(1)
        .match(/[\da-f]{2}/gi)
        ?.map((channel) => Number.parseInt(channel, 16) / 255);

      if (!channels || channels.length !== 3) {
        throw new Error(`Expected a six-digit hex color, received ${color}`);
      }

      return channels.reduce((sum, channel, index) => {
        const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        const weights = [0.2126, 0.7152, 0.0722];
        return sum + linear * weights[index];
      }, 0);
    };

    expect(luminance(rowHoverBg)).toBeGreaterThan(luminance(rowSelectedBg));
    expect(luminance(rowSelectedBg)).toBeGreaterThan(luminance(rowSelectedHoverBg));
  });

  it("uses the Ant Design dark algorithm and dark table states", () => {
    const darkTheme = createThemeConfig(runtimeConfig, "dark");
    const tableTokens = darkTheme.components?.Table;

    expect(darkTheme.algorithm).toBeDefined();
    expect(darkTheme.token?.colorBgLayout).toBe("#111318");
    expect(darkTheme.token?.colorText).toBe("#e6e8eb");
    expect(tableTokens?.rowHoverBg).toBe("#20232a");
    expect(tableTokens?.rowSelectedBg).toBe("#1c2638");
    expect(tableTokens?.rowSelectedHoverBg).toBe("#223049");
  });

  it("uses legible selected tab colors on both themes", () => {
    const lightTabs = createThemeConfig(runtimeConfig, "light").components?.Tabs;
    const darkTabs = createThemeConfig(runtimeConfig, "dark").components?.Tabs;

    expect(lightTabs?.itemSelectedColor).toBe("#1e3a8a");
    expect(darkTabs?.itemSelectedColor).toBe("#93c5fd");
    expect(darkTabs?.itemActiveColor).toBe("#93c5fd");
    expect(darkTabs?.itemHoverColor).toBe("#bfdbfe");
  });

  it("keeps a host brand primary in dark mode by lifting its lightness", () => {
    const brandConfig: RuntimeConfig = {
      ...runtimeConfig,
      theme: { ...runtimeConfig.theme, primaryColor: "#7c2d12" },
    };
    const darkTheme = createThemeConfig(brandConfig, "dark");
    const derived = darkPrimaryFor("#7c2d12");

    expect(darkTheme.token?.colorPrimary).toBe(derived.base);
    expect(darkTheme.components?.Button?.colorPrimary).toBe(derived.base);
    expect(derived.base).not.toBe("#3b82f6");
    // Same hue family (orange-brown), lifted for dark surfaces.
    expect(derived.base).toBe("#e5744d");
  });

  it("maps the default primary to the tuned dark blue", () => {
    expect(darkPrimaryFor("#1e3a8a")).toEqual({
      base: "#3b82f6",
      hover: "#5b95f7",
      active: "#2f6fdc",
    });
    expect(createThemeConfig(runtimeConfig, "dark").token?.colorPrimary).toBe("#3b82f6");
  });
});
