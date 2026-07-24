/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { collectToolboxPublishIssues } from "./toolbox-publish-preflight";

const healthy = {
  code: "def handler(event):\n    return event\n",
  description: "Does a thing.",
  metadataType: "function" as const,
  name: "do_thing",
  status: "enabled" as const,
};

describe("collectToolboxPublishIssues", () => {
  it("passes a healthy function toolbox", () => {
    expect(collectToolboxPublishIssues([healthy])).toEqual([]);
  });

  it("reports an empty toolbox and nothing else", () => {
    expect(collectToolboxPublishIssues([])).toEqual([{ key: "emptyToolbox" }]);
  });

  it("reports unnamed tools by position and skips their other checks", () => {
    expect(collectToolboxPublishIssues([{ ...healthy, name: "  ", description: "" }])).toEqual([
      { key: "toolMissingName", params: { index: 1 } },
    ]);
  });

  it("reports a missing description because agents pick tools by it", () => {
    expect(collectToolboxPublishIssues([{ ...healthy, description: "   " }])).toEqual([
      { key: "toolMissingDescription", params: { name: "do_thing" } },
    ]);
  });

  it("reports function code without a handler entry point", () => {
    expect(collectToolboxPublishIssues([{ ...healthy, code: "x = 1\n" }])).toEqual([
      { key: "toolMissingHandler", params: { name: "do_thing" } },
    ]);
  });

  it("accepts a @tool decorated function as a valid entry point", () => {
    expect(
      collectToolboxPublishIssues([
        {
          ...healthy,
          code: '@tool\ndef register(name: str) -> dict:\n    """注册"""\n    return {}\n',
        },
      ]),
    ).toEqual([]);
  });

  it("skips the handler check when the code was not loaded", () => {
    expect(collectToolboxPublishIssues([{ ...healthy, code: undefined }])).toEqual([]);
  });

  it("does not run the handler check on openapi tools", () => {
    expect(
      collectToolboxPublishIssues([
        { ...healthy, code: "x = 1\n", metadataType: "openapi" },
      ]),
    ).toEqual([]);
  });

  it("reports when every tool is disabled", () => {
    expect(collectToolboxPublishIssues([{ ...healthy, status: "disabled" }])).toEqual([
      { key: "allToolsDisabled" },
    ]);
  });

  it("keeps quiet when at least one tool is enabled", () => {
    expect(
      collectToolboxPublishIssues([
        { ...healthy, name: "a", status: "disabled" },
        { ...healthy, name: "b", status: "enabled" },
      ]),
    ).toEqual([]);
  });
});
