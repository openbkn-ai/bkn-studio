/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { getModelConfigConflict } from "./model-config-conflict";

describe("getModelConfigConflict", () => {
  it("extracts the display-safe duplicate identity and permission flag", () => {
    const error = new AxiosError("Conflict", undefined, undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: {},
      config: {} as never,
      data: {
        error_code: "RESOURCE_EXISTED",
        details: {
          existing_model: { id: "123", name: "existing", type: "embedding" },
          can_set_default: true,
        },
      },
    });

    expect(getModelConfigConflict(error)).toEqual({
      existingModel: { id: "123", name: "existing", type: "embedding" },
      canSetDefault: true,
    });
  });

  it("ignores unrelated conflicts", () => {
    expect(getModelConfigConflict(new Error("Conflict"))).toBeNull();
  });

  it("preserves a non-permission default-switch reason without exposing a model", () => {
    const error = new AxiosError("Conflict", undefined, undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: {},
      config: {} as never,
      data: {
        error_code: "RESOURCE_EXISTED",
        details: { can_set_default: false, default_switch_reason: "NO_DISPLAY_PERMISSION" },
      },
    });

    expect(getModelConfigConflict(error)).toEqual({
      canSetDefault: false,
      defaultSwitchReason: "NO_DISPLAY_PERMISSION",
    });
  });
});
