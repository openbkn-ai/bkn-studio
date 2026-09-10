/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listCatalogsMock,
  listDataConnectDiscoverSchedulesMock,
  listDataConnectDiscoverTasksMock,
  listSemanticUnderstandingTasksMock,
} = vi.hoisted(() => ({
  listCatalogsMock: vi.fn(),
  listDataConnectDiscoverSchedulesMock: vi.fn(),
  listDataConnectDiscoverTasksMock: vi.fn(),
  listSemanticUnderstandingTasksMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/modules/data-connect/services/discover.service", () => ({
  deleteDataConnectDiscoverTask: vi.fn(),
  listDataConnectDiscoverSchedules: listDataConnectDiscoverSchedulesMock,
  listDataConnectDiscoverTasks: listDataConnectDiscoverTasksMock,
}));

vi.mock("@/modules/data-catalog/services/semantic-understanding-task.service", () => ({
  deleteSemanticUnderstandingTask: vi.fn(),
  listSemanticUnderstandingTasks: listSemanticUnderstandingTasksMock,
}));

vi.mock("@/shared/catalog", () => ({
  listCatalogs: listCatalogsMock,
}));

import {
  DiscoverTaskListPanel,
  SemanticUnderstandingTaskListPanel,
} from "./TaskManagementTaskPanels";

describe("TaskManagementTaskPanels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listDataConnectDiscoverSchedulesMock.mockResolvedValue({ items: [], total: 0 });
    listDataConnectDiscoverTasksMock.mockResolvedValue({ items: [], total: 0 });
    listSemanticUnderstandingTasksMock.mockResolvedValue({ items: [], total: 0 });
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

  it("shows the discover-task empty-state title only once", async () => {
    render(
      <MemoryRouter>
        <DiscoverTaskListPanel />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listDataConnectDiscoverTasksMock).toHaveBeenCalled());
    expect(screen.getAllByText("dataCatalog.taskManagement.discover.empty")).toHaveLength(1);
  });

  it("shows the semantic-task empty-state title only once", async () => {
    render(
      <MemoryRouter>
        <SemanticUnderstandingTaskListPanel />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listSemanticUnderstandingTasksMock).toHaveBeenCalled());
    expect(screen.getAllByText("dataCatalog.taskManagement.semantic.empty")).toHaveLength(1);
  });
});
