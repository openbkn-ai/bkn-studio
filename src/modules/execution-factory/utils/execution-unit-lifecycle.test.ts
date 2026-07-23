/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getExecutionUnitLifecycleActions,
  resolveLifecycleActionStatus,
} from "./execution-unit-lifecycle";

describe("getExecutionUnitLifecycleActions", () => {
  it("offers publish for draft, editing, and offline units", () => {
    expect(getExecutionUnitLifecycleActions("unpublish")).toEqual(["publish"]);
    expect(getExecutionUnitLifecycleActions("editing")).toEqual(["publish"]);
    expect(getExecutionUnitLifecycleActions("offline")).toEqual(["publish"]);
  });

  it("offers only offline for published units (never unpublish)", () => {
    const actions = getExecutionUnitLifecycleActions("published");

    expect(actions).toEqual(["offline"]);
    expect(actions).not.toContain("unpublish");
  });

  it("returns no lifecycle actions for unknown or missing status", () => {
    expect(getExecutionUnitLifecycleActions(undefined)).toEqual([]);
    expect(getExecutionUnitLifecycleActions("")).toEqual([]);
    expect(getExecutionUnitLifecycleActions("unknown")).toEqual([]);
  });
});

describe("resolveLifecycleActionStatus", () => {
  it("maps publish to published", () => {
    expect(resolveLifecycleActionStatus("publish")).toBe("published");
  });

  it("maps offline take-down to offline, not unpublish", () => {
    expect(resolveLifecycleActionStatus("offline")).toBe("offline");
    expect(resolveLifecycleActionStatus("offline")).not.toBe("unpublish");
  });

  it("keeps published → offline as the only take-down transition for cards", () => {
    const actions = getExecutionUnitLifecycleActions("published");
    const statuses = actions.map(resolveLifecycleActionStatus);

    expect(statuses).toEqual(["offline"]);
  });
});
