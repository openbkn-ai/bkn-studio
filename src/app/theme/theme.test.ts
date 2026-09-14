/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createThemeConfig } from "@/app/theme/theme";
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
    const rowSelectedHoverBg = requiredColor(
      tableTokens.rowSelectedHoverBg,
      "rowSelectedHoverBg",
    );
    const rowColors = [
      rowHoverBg,
      rowSelectedBg,
      rowSelectedHoverBg,
    ];

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
        const linear = channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
        const weights = [0.2126, 0.7152, 0.0722];
        return sum + linear * weights[index];
      }, 0);
    };

    expect(luminance(rowHoverBg)).toBeGreaterThan(
      luminance(rowSelectedBg),
    );
    expect(luminance(rowSelectedBg)).toBeGreaterThan(
      luminance(rowSelectedHoverBg),
    );
  });

  it("uses the Ant Design dark algorithm and dark table states", () => {
    const darkTheme = createThemeConfig(runtimeConfig, "dark");
    const tableTokens = darkTheme.components?.Table;

    expect(darkTheme.algorithm).toBeDefined();
    expect(darkTheme.token?.colorBgLayout).toBe("#0f172a");
    expect(darkTheme.token?.colorText).toBe("#f1f5f9");
    expect(tableTokens?.rowHoverBg).toBe("#243047");
    expect(tableTokens?.rowSelectedBg).toBe("#1e3a5f");
    expect(tableTokens?.rowSelectedHoverBg).toBe("#254b78");
  });
});
