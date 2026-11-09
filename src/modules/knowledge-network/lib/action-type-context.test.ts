/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { actionTypeCreatedState, readActionTypeContext } from "./action-type-context";

const context = {
  title: "Reschedule order is needed",
  description: "Moves the promised date",
  prefill: { description: "Moves the promised date", name: "Reschedule order", objectTypeId: "o" },
  returnTo: "/projects/p-1/kinetic",
  returnLabel: "Back to the project",
  returnState: { needId: "n-1" },
};

describe("action type navigation context", () => {
  it("reads a complete context from navigation state", () => {
    expect(readActionTypeContext({ actionTypeContext: context, other: 1 })).toEqual(context);
  });

  it("keeps only the required fields when the optional ones are absent or blank", () => {
    expect(
      readActionTypeContext({
        actionTypeContext: {
          title: "Need",
          prefill: { name: " " },
          returnTo: "/projects/p-1",
          returnLabel: "Back",
        },
      }),
    ).toEqual({
      title: "Need",
      description: undefined,
      prefill: { description: undefined, name: undefined, objectTypeId: undefined },
      returnTo: "/projects/p-1",
      returnLabel: "Back",
      returnState: undefined,
    });
  });

  it("reads what carries the action out, and a notice", () => {
    const execution = (value: unknown) =>
      readActionTypeContext({
        actionTypeContext: {
          ...context,
          notice: "Implement it first",
          prefill: { execution: value },
        },
      });
    expect(execution({ boxId: "b", toolId: "f", toolName: "Lookup", type: "tool" })).toMatchObject({
      notice: "Implement it first",
      prefill: { execution: { boxId: "b", toolId: "f", toolName: "Lookup", type: "tool" } },
    });
    expect(execution({ mcpId: "m", toolId: "t", type: "mcp" })?.prefill?.execution).toEqual({
      mcpId: "m",
      toolId: "t",
      toolName: undefined,
      type: "mcp",
    });
    // Without the ids it takes, or of another kind, it fills nothing.
    for (const value of [
      { toolId: "f", type: "tool" },
      { mcpId: "m", type: "mcp" },
      { boxId: "b", toolId: "f", type: "manual" },
      "tool",
    ]) {
      expect(execution(value)?.prefill?.execution).toBeUndefined();
    }
  });

  it.each([
    ["no state", null],
    ["no context", { knowledgeNetworkReturnTo: "/x" }],
    ["a context without a title", { actionTypeContext: { ...context, title: "" } }],
    ["another site", { actionTypeContext: { ...context, returnTo: "https://example.com" } }],
    ["a protocol-relative address", { actionTypeContext: { ...context, returnTo: "//x" } }],
    ["a backslash address", { actionTypeContext: { ...context, returnTo: "/\\x" } }],
    ["a return state that is not an object", { actionTypeContext: { ...context, returnState: 1 } }],
    ["a prefill that is not an object", { actionTypeContext: { ...context, prefill: [] } }],
  ])("ignores %s", (_, state) => {
    expect(readActionTypeContext(state)).toBeUndefined();
  });

  it("returns with the caller's state and the new id", () => {
    expect(actionTypeCreatedState(context, "a-1")).toEqual({
      needId: "n-1",
      actionTypeCreated: { id: "a-1" },
    });
  });
});
