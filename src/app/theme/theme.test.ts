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
    businessDomainId: null,
    id: null,
    isAdmin: false,
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
    const tableTokens = createThemeConfig(runtimeConfig).components?.Table;

    if (!tableTokens) {
      throw new Error("Table theme tokens are not configured");
    }

    const rowColors = [
      tableTokens.rowHoverBg,
      tableTokens.rowSelectedBg,
      tableTokens.rowSelectedHoverBg,
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

    expect(luminance(tableTokens.rowHoverBg)).toBeGreaterThan(
      luminance(tableTokens.rowSelectedBg),
    );
    expect(luminance(tableTokens.rowSelectedBg)).toBeGreaterThan(
      luminance(tableTokens.rowSelectedHoverBg),
    );
  });
});
