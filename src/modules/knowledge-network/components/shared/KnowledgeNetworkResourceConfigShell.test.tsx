/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeNetworkResourceConfigShell } from "./KnowledgeNetworkResourceConfigShell";

afterEach(() => {
  cleanup();
});

describe("KnowledgeNetworkResourceConfigShell", () => {
  it("fills the content area with a centered loading state", () => {
    const { container } = render(
      <KnowledgeNetworkResourceConfigShell
        loading
        onBack={vi.fn()}
        subtitle="Detail subtitle"
        title="Detail title"
      >
        <div>Loaded content</div>
      </KnowledgeNetworkResourceConfigShell>,
    );

    const loadingContent = container.querySelector('[aria-busy="true"]');

    expect(loadingContent).not.toBeNull();
    expect(loadingContent?.className).toContain("contentLoading");
    expect(screen.queryByText("Loaded content")).toBeNull();
  });
});
