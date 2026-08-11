/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const createResourceSemanticUnderstandingTaskMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() }, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/framework/entitlement/EditionBadge", () => ({
  EditionBadge: () => null,
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/modules/data-catalog/services/semantic-understanding-task.service", () => ({
  createResourceSemanticUnderstandingTask: createResourceSemanticUnderstandingTaskMock,
  deleteSemanticUnderstandingTask: vi.fn(),
  listResourceSemanticUnderstandingTasks: vi.fn().mockResolvedValue([]),
}));

import { ResourceSemanticUnderstandingPanel } from "./ResourceSemanticUnderstandingPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  updatedAt: 0,
};

describe("ResourceSemanticUnderstandingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("initializes the semantic task defaults before opening the creation dialog", async () => {
    createResourceSemanticUnderstandingTaskMock.mockResolvedValue({ id: "task-1" });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.create/ }));

    await waitFor(() => expect(screen.getByText("dataCatalog.taskManagement.applyMode.fillEmpty")).toBeTruthy());
    expect(screen.getByRole("spinbutton").getAttribute("value")).toBe("0.75");

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.start/ }));

    await waitFor(() => expect(createResourceSemanticUnderstandingTaskMock).toHaveBeenCalledWith({
      applyMode: "fill_empty",
      confidenceThreshold: 0.75,
      includeSampleRows: false,
      resourceId: "resource-1",
    }));
  });
});
