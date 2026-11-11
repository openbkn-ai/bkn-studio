/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolCallGuideDrawer } from "./ToolCallGuideDrawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const key = (name: string) => `executionFactory.callGuide.${name}`;

describe("ToolCallGuideDrawer", () => {
  it("shows a Cypher table function's call with its own ids, arguments and result shape", () => {
    render(
      <ToolCallGuideDrawer
        boxId="box-1"
        functionInput={{
          script_type: "cypher",
          result_shape: "table",
          inputs: [{ name: "code", type: "string", required: true, example: "S1" }],
        }}
        kind={{ kind: "cypher", shape: "table" }}
        onClose={() => {}}
        open
        toolId="tool-1"
      />,
    );

    const curl = screen.getAllByLabelText(key("httpTitle")).find((node) => node.tagName === "PRE");
    expect(curl?.textContent).toContain("/tool-box/box-1/proxy/tool-1");
    expect(curl?.textContent).toContain('"code": "S1"');
    expect(screen.getByText(key("httpCypherIdentity"))).toBeTruthy();
    expect(screen.getByText(key("responseCypherTable"))).toBeTruthy();
    expect(screen.queryByText(key("bindLogicValue"))).toBeNull();
    const cli = screen.getAllByLabelText(key("agentTitle")).find((node) => node.tagName === "PRE");
    expect(cli?.textContent).toContain('"tool_id": "tool-1"');
  });

  it("describes an API tool's envelope and leaves out what only Cypher functions have", () => {
    render(
      <ToolCallGuideDrawer
        boxId="box-1"
        ioSpec={{ parameters: [{ name: "id", in: "path", required: true, type: "string" }] }}
        kind={{ kind: "openapi" }}
        onClose={() => {}}
        open
        toolId="tool-2"
      />,
    );

    expect(screen.getByText(key("httpEnvelopeOpenapi"))).toBeTruthy();
    expect(screen.getByText(key("responseOpenapi"))).toBeTruthy();
    expect(screen.queryByText(key("httpCypherIdentity"))).toBeNull();
  });
});
