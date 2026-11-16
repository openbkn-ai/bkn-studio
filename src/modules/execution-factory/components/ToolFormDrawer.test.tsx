/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { ToolFormDrawer } from "@/modules/execution-factory/components/ToolFormDrawer";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  createTool: vi.fn(),
  getToolDetail: vi.fn(),
  updateTool: vi.fn(),
}));

vi.mock("@/modules/execution-factory/components/OpenApiDefinitionFields", () => ({
  OpenApiDefinitionFields: () => <p>openapi definition</p>,
}));

vi.mock("@/modules/execution-factory/components/FunctionDefinitionFields", () => ({
  FunctionDefinitionFields: () => <p>function definition</p>,
}));

function renderCreate(toolboxMetadataType: "function" | "openapi") {
  renderWithoutAntdStyles(
    <ToolFormDrawer
      boxId="b1"
      mode="create"
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      open
      toolboxMetadataType={toolboxMetadataType}
    />,
  );
}

describe("ToolFormDrawer create layout", () => {
  beforeEach(() => {
    // The drawer's responsive width reads breakpoints, which jsdom does not provide.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["openapi", "openapi definition"],
    ["function", "function definition"],
  ] as const)(
    "puts the required %s definition above the optional usage rule",
    (kind, definition) => {
      renderCreate(kind);

      const definitionNode = screen.getByText(definition);
      const useRuleNode = screen.getByText(i18n.t("executionFactory.useRule"));
      expect(
        definitionNode.compareDocumentPosition(useRuleNode) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );
});
