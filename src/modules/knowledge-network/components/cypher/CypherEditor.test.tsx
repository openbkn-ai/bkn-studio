/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CypherCompletionSchema } from "@/modules/knowledge-network/cypher/cypher-completion";

import { CypherEditor } from "./CypherEditor";

// Monaco does not run in jsdom: the stand-in records how the editor sized and set it up.
const monaco = vi.hoisted(() => ({
  props: [] as { height?: number | string; options?: Record<string, unknown> }[],
}));

vi.mock("@/framework/monaco/MonacoEditor", () => ({
  MonacoEditor: (props: { height?: number | string; options?: Record<string, unknown> }) => {
    monaco.props.push(props);
    return null;
  },
}));

const common = {
  ariaLabel: "Cypher",
  onChange: () => undefined,
  onHistory: () => undefined,
  onRun: () => undefined,
  schema: {} as CypherCompletionSchema,
  value: "MATCH (n) RETURN n",
};

const last = () => monaco.props[monaco.props.length - 1];

describe("CypherEditor", () => {
  beforeEach(() => {
    monaco.props = [];
  });

  it("fills its container when asked, so a shorter container is never drawn past", () => {
    render(<CypherEditor {...common} height="fill" />);

    expect(last().height).toBe("100%");
    expect(screen.getByTestId("cypher-editor").className).not.toBe("");
  });

  it("otherwise grows with its text between its least and greatest height", () => {
    render(<CypherEditor {...common} maxHeight={640} minHeight={240} />);

    expect(last().height).toBe(240);
    expect(screen.getByTestId("cypher-editor").className).toBe("");
  });

  it("pins no lines over a scrolled statement, which would read as the statement over itself", () => {
    render(<CypherEditor {...common} height="fill" />);

    expect(last().options).toMatchObject({ stickyScroll: { enabled: false } });
  });
});
