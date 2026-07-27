/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import { BuildTaskLaunchPanel, STREAMING_BUILD_ENTRY_ENABLED } from "./BuildTaskLaunchPanel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn() } }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  BuildTaskConflictError: class BuildTaskConflictError extends Error {},
  createBuildTask: vi.fn(),
  listBuildTasks: vi.fn().mockResolvedValue([]),
  resumeBuildTask: vi.fn(),
}));

vi.mock("@/modules/model-resources/services/small-model.service", () => ({
  listSmallModels: vi.fn().mockResolvedValue({ items: [] }),
}));

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  indexConfig: { buildKeyFields: ["id"] },
  name: "orders",
  rowCount: 1,
  schema: [
    {
      features: [{ featureType: "vector" }],
      name: "content",
      type: "string",
    },
  ],
  sourceIdentifier: "orders",
  updateTime: "2026-07-27T00:00:00Z",
  updatedAt: 0,
};

describe("BuildTaskLaunchPanel", () => {
  it("hides the streaming-build entry while the feature is disabled", () => {
    expect(STREAMING_BUILD_ENTRY_ENABLED).toBe(false);

    render(
      <BuildTaskLaunchPanel
        active
        onGoConfigure={vi.fn()}
        onStarted={vi.fn()}
        resource={resource}
      />,
    );

    expect(screen.getByText("dataCatalog.build.batchLabel")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.streamingLabel")).toBeNull();
  });
});
