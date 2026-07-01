/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  CAPABILITY_UX_PRIMARY_TABS,
  TOOLBOX_CAPABILITY_MODES,
  canReturnToModeStep,
  getCapabilityModesForTab,
  getDefaultCapabilityModeForTab,
  getDefaultManagementTab,
  getManagementTabs,
  resolveVisibleManagementTabs,
  shouldSkipCapabilityModeStep,
} from "@/modules/execution-factory/utils/capability-ux";

describe("capability-ux", () => {
  it("defaults to toolbox-first tabs when v2 is enabled", () => {
    expect(getDefaultManagementTab()).toBe("toolbox");
    expect(getManagementTabs()).toEqual(CAPABILITY_UX_PRIMARY_TABS);
  });

  it("temporarily exposes operator tab while advanced view is active", () => {
    expect(resolveVisibleManagementTabs("toolbox")).toEqual(CAPABILITY_UX_PRIMARY_TABS);
    expect(resolveVisibleManagementTabs("operator")).toEqual([
      ...CAPABILITY_UX_PRIMARY_TABS,
      "operator",
    ]);
  });

  it("scopes wizard modes by active tab", () => {
    expect(getCapabilityModesForTab("mcp")).toEqual(["mcp"]);
    expect(getCapabilityModesForTab("skill")).toEqual(["skill"]);
    expect(getCapabilityModesForTab("toolbox")).toEqual(TOOLBOX_CAPABILITY_MODES);
    expect(getDefaultCapabilityModeForTab("mcp")).toBe("mcp");
    expect(shouldSkipCapabilityModeStep("mcp")).toBe(true);
    expect(shouldSkipCapabilityModeStep("toolbox")).toBe(true);
    expect(shouldSkipCapabilityModeStep("operator")).toBe(false);
    expect(canReturnToModeStep(["mcp"])).toBe(false);
    expect(canReturnToModeStep(TOOLBOX_CAPABILITY_MODES)).toBe(true);
  });
});
