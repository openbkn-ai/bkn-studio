/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { togglePermissionRequestOperation } from "./resource-permission-request";

describe("togglePermissionRequestOperation", () => {
  it("does not resubmit an already effective prerequisite", () => {
    const selected = togglePermissionRequestOperation([], "modify", [
      { key: "modify", requires: ["view_detail"] },
    ]);

    expect(selected).toEqual(["modify"]);
  });

  it("includes a prerequisite only when it is also requestable", () => {
    const selected = togglePermissionRequestOperation([], "modify", [
      { key: "view_detail", requires: [] },
      { key: "modify", requires: ["view_detail"] },
    ]);

    expect(selected).toEqual(["view_detail", "modify"]);
  });
});
