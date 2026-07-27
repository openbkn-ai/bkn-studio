/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ExecutionUnitCard } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCard";
import type { ExecutionUnitCardItem } from "@/modules/execution-factory/components/execution-unit/types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseItem: ExecutionUnitCardItem = {
  id: "unit-1",
  name: "Self",
  status: "unpublish",
};

afterEach(cleanup);

describe("ExecutionUnitCard meta line", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("badges an MCP with its transport instead of a default category", () => {
    render(
      <ExecutionUnitCard
        activeTab="mcp"
        item={{ ...baseItem, category: "other_category", mode: "stream" }}
      />,
    );

    expect(screen.getByText("executionFactory.mcpModeShort.stream")).toBeTruthy();
    expect(screen.queryByText("executionFactory.operatorCategories.other_category")).toBeNull();
  });

  it("drops the meta line for a SKILL with nothing meaningful to show", () => {
    // The backend's skill `version` is a UUID, not a semver — never badge it.
    const { container } = render(
      <ExecutionUnitCard
        activeTab="skill"
        item={{
          ...baseItem,
          category: "other_category",
          categoryName: "未分类",
          version: "3529519d-3485-4543-bed9-10799507b065",
        }}
      />,
    );

    expect(screen.queryByText(/3529519d/)).toBeNull();
    expect(screen.queryByText("未分类")).toBeNull();
    expect(container.querySelector("[class*='metaLine']")).toBeNull();
  });

  it("keeps a category that is not the shared default", () => {
    render(
      <ExecutionUnitCard
        activeTab="skill"
        item={{ ...baseItem, category: "system", categoryName: "System" }}
      />,
    );

    // The stub `t` echoes keys, so the resolver falls through to categoryName.
    expect(screen.getByText("System")).toBeTruthy();
  });
});
