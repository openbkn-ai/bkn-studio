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
  it("uses light, distinct states for selectable table rows", () => {
    expect(createThemeConfig(runtimeConfig).components?.Table).toMatchObject({
      rowHoverBg: "#f8fafc",
      rowSelectedBg: "#eff6ff",
      rowSelectedHoverBg: "#dbeafe",
    });
  });
});
