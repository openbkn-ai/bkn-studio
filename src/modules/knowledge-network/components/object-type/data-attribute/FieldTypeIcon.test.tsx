/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FieldTypeIcon } from "./FieldTypeIcon";

afterEach(() => {
  cleanup();
});

const STANDARD_TYPE_PRESENTATIONS = [
  { expected: "[Str]", type: "string" },
  { expected: "[Text]", type: "text" },
  { expected: "int", type: "integer" },
  { expected: "uint", type: "unsigned integer" },
  { expected: "float", type: "float" },
  { expected: "dec", type: "decimal" },
  { expected: "date", type: "date" },
  { expected: "time", type: "time" },
  { expected: "datetime", type: "datetime" },
  { expected: "timestamp", type: "timestamp" },
  { expected: "[IP]", type: "ip" },
  { expected: "bool", type: "boolean" },
  { expected: "[Bin]", type: "binary" },
  { expected: "[JSON]", type: "json" },
  { expected: "[Point]", type: "point" },
  { expected: "[Shape]", type: "shape" },
  { expected: "[Vec]", type: "vector" },
  { expected: "[Other]", type: "other" },
] as const;

describe("FieldTypeIcon", () => {
  it.each(STANDARD_TYPE_PRESENTATIONS)(
    "renders the Foundry type $type as $expected",
    ({ expected, type }) => {
      render(<FieldTypeIcon type={type} />);

      expect(screen.getByTitle(type).textContent).toBe(expected);
    },
  );

  it.each([
    { expected: "int", type: "bigint" },
    { expected: "int", type: "smallint" },
    { expected: "float", type: "double" },
    { expected: "float", type: "number" },
    { expected: "dec", type: "numeric" },
    { expected: "float", type: "real" },
  ])("keeps the legacy type $type compatible", ({ expected, type }) => {
    render(<FieldTypeIcon type={type} />);

    expect(screen.getByTitle(type).textContent).toBe(expected);
  });

  it("renders an unknown backend type explicitly", () => {
    render(<FieldTypeIcon type="custom_type" />);

    expect(screen.getByTitle("custom_type").textContent).toBe("[Unknown]");
    expect(screen.queryByText("[Str]")).toBeNull();
  });

  it("renders a missing backend type explicitly", () => {
    render(<FieldTypeIcon />);

    expect(screen.getByTitle("unknown").textContent).toBe("[Unknown]");
    expect(screen.queryByText("[Str]")).toBeNull();
  });
});
