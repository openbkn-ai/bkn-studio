/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScriptTypeBadge } from "./ScriptTypeBadge";

describe("ScriptTypeBadge", () => {
  it("names each known language with its own icon", () => {
    const { container } = render(
      <>
        <ScriptTypeBadge scriptType="python" />
        <ScriptTypeBadge scriptType="cypher" />
      </>,
    );
    expect(screen.getByText("Python")).toBeTruthy();
    expect(screen.getByText("Cypher")).toBeTruthy();
    expect(container.querySelectorAll(".anticon")).toHaveLength(2);
  });

  it("shows an unknown type as plain text, without an icon", () => {
    const { container } = render(<ScriptTypeBadge scriptType="lua" />);
    expect(screen.getByText("Lua")).toBeTruthy();
    expect(container.querySelector(".anticon")).toBeNull();
  });
});
