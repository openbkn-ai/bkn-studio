/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const getCatalogMock = vi.hoisted(() => vi.fn());
const listBuildTasksMock = vi.hoisted(() => vi.fn());
const subscribeMockDbMock = vi.hoisted(() => vi.fn());

vi.mock("antd", () => ({
  Alert: ({ message }: { message: React.ReactNode }) => <div>{message}</div>,
  Spin: ({ children }: { children?: React.ReactNode }) => <div data-testid="workspace-spin">{children}</div>,
  Tabs: ({ activeKey, items }: { activeKey: string; items: Array<{ children: React.ReactNode; key: string }> }) => (
    <>{items.find((item) => item.key === activeKey)?.children}</>
  ),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/data-directory/resource/resource-1", search: "" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock("@/framework/ui/common/AppButton", () => ({
  AppButton: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@/framework/ui/common/EmptyStatePanel", () => ({
  EmptyStatePanel: () => <div />,
}));

vi.mock("@/framework/ui/common/SceneBackButton", () => ({
  SceneBackButton: () => <button type="button" />,
}));

vi.mock("@/framework/entitlement/EditionBadge", () => ({ EditionBadge: () => null }));
vi.mock("@/framework/entitlement/RequireEdition", () => ({
  RequireEdition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/modules/data-catalog/components/ResourceDetailPanel", () => ({
  ResourceDetailPanel: ({ resource }: { resource: CatalogResource }) => (
    <div data-testid="detail-schema-name">{resource.schema[0]?.displayName ?? "-"}</div>
  ),
}));
vi.mock("@/modules/data-catalog/components/ResourceIndexPanel", () => ({ ResourceIndexPanel: () => <div /> }));
vi.mock("@/modules/data-catalog/components/ResourcePreviewPanel", () => ({ ResourcePreviewPanel: () => <div /> }));
vi.mock("@/modules/data-catalog/components/ResourceSemanticUnderstandingPanel", () => ({
  ResourceSemanticUnderstandingPanel: () => <div data-testid="semantic-panel" />,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
}));
vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTasks: listBuildTasksMock,
}));
vi.mock("@/modules/data-catalog/services/mock-db", () => ({
  subscribeMockDb: subscribeMockDbMock,
}));
vi.mock("@/shared/catalog", () => ({ getCatalog: getCatalogMock }));

import { ResourceWorkspaceScene } from "./ResourceWorkspaceScene";

const staleResource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "order_id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-20T00:00:00Z",
  expectedUpdateTime: 1,
};

describe("ResourceWorkspaceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogMock.mockResolvedValue({ id: "catalog-1", name: "Catalog" });
    listBuildTasksMock.mockResolvedValue([]);
    subscribeMockDbMock.mockImplementation(() => () => {});
  });

  it("finishes an in-flight workspace load after a tab refresh", async () => {
    let onMockDbChange: (() => void) | undefined;
    let resolveLoad: (resource: CatalogResource) => void;
    const semanticResource: CatalogResource = {
      ...staleResource,
      expectedUpdateTime: 2,
      schema: [{ ...staleResource.schema[0], displayName: "订单编号" }],
    };
    subscribeMockDbMock.mockImplementation((listener: () => void) => {
      onMockDbChange = listener;
      return () => {};
    });
    getCatalogResourceMock
      .mockResolvedValueOnce(staleResource)
      .mockImplementationOnce(() => new Promise<CatalogResource>((resolve) => {
        resolveLoad = resolve;
      }))
      .mockResolvedValueOnce(semanticResource);

    const props = {
      indexView: "config" as const,
      onIndexViewChange: vi.fn(),
      onTabChange: vi.fn(),
      resourceId: staleResource.id,
      tab: "semantic-understanding" as const,
    };
    const { rerender } = render(<ResourceWorkspaceScene {...props} />);

    await screen.findByTestId("semantic-panel");
    onMockDbChange?.();
    await screen.findByTestId("workspace-spin");
    rerender(<ResourceWorkspaceScene {...props} tab="detail" />);
    await waitFor(() => expect(getCatalogResourceMock).toHaveBeenCalledTimes(3));
    resolveLoad!(staleResource);

    expect((await screen.findByTestId("detail-schema-name")).textContent).toBe("订单编号");
    expect(screen.queryByTestId("workspace-spin")).toBeNull();
  });

  it("refreshes the resource once when entering detail after semantic understanding", async () => {
    const semanticResource: CatalogResource = {
      ...staleResource,
      expectedUpdateTime: 2,
      schema: [{ ...staleResource.schema[0], description: "Order identifier", displayName: "订单编号" }],
    };
    getCatalogResourceMock
      .mockResolvedValueOnce(staleResource)
      .mockResolvedValueOnce(semanticResource);

    const props = {
      indexView: "config" as const,
      onIndexViewChange: vi.fn(),
      onTabChange: vi.fn(),
      resourceId: staleResource.id,
      tab: "semantic-understanding" as const,
    };
    const { rerender } = render(<ResourceWorkspaceScene {...props} />);

    await screen.findByTestId("semantic-panel");
    rerender(<ResourceWorkspaceScene {...props} tab="detail" />);

    await waitFor(() => expect(getCatalogResourceMock).toHaveBeenCalledTimes(2));
    expect((await screen.findByTestId("detail-schema-name")).textContent).toBe("订单编号");
  });
});
