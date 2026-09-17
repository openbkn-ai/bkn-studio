/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const getCatalogMock = vi.hoisted(() => vi.fn());
const listBuildTaskPageMock = vi.hoisted(() => vi.fn());
const subscribeMockDbMock = vi.hoisted(() => vi.fn());
const discoverCatalogResourceMock = vi.hoisted(() => vi.fn());
const setCatalogResourceEnabledMock = vi.hoisted(() => vi.fn());
const modalConfirmMock = vi.hoisted(() => vi.fn());
const currentPermissions = vi.hoisted(() => ({ value: [] as string[] }));
const drawerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
const indexPanelProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));

vi.mock("antd", () => ({
  Alert: ({ action, description, message, type }: {
    action?: React.ReactNode;
    description?: React.ReactNode;
    message: React.ReactNode;
    type?: string;
  }) => (
    <div>
      <div data-alert-type={type}>{message}</div>
      {description ? <div>{description}</div> : null}
      {action}
    </div>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Spin: ({ children }: { children?: React.ReactNode }) => <div data-testid="workspace-spin">{children}</div>,
  Tabs: ({ activeKey, items, onChange }: {
    activeKey: string;
    items: Array<{ children: React.ReactNode; key: string; label: React.ReactNode }>;
    onChange?: (key: string) => void;
  }) => (
    <div data-testid="workspace-tabs" data-tab-keys={items.map((item) => item.key).join(",")}>
      {items.map((item) => (
        <button key={item.key} onClick={() => onChange?.(item.key)} type="button">{item.label}</button>
      ))}
      {items.find((item) => item.key === activeKey)?.children}
    </div>
  ),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/data-catalog/resource/resource-1", search: "" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: modalConfirmMock },
    runtimeConfig: { currentUser: { permissions: currentPermissions.value } },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/framework/ui/common/AppButton", () => ({
  AppButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">{children}</button>
  ),
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
vi.mock("@/modules/data-catalog/components/ResourceIndexPanel", () => ({
  ResourceIndexPanel: (props: Record<string, unknown>) => {
    indexPanelProps.value = props;
    return <output data-testid="index-task-status-unavailable">{String(props.taskStatusUnavailable)}</output>;
  },
}));
vi.mock("@/modules/data-catalog/components/ResourcePreviewPanel", () => ({ ResourcePreviewPanel: () => <div /> }));
vi.mock("@/modules/data-catalog/components/ResourceSemanticUnderstandingPanel", () => ({
  ResourceSemanticUnderstandingPanel: () => <div data-testid="semantic-panel" />,
}));
vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: (props: Record<string, unknown>) => {
    drawerProps.value = props;
    return props.open ? <div data-testid="authorize-drawer" /> : null;
  },
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  discoverCatalogResource: discoverCatalogResourceMock,
  getCatalogResource: getCatalogResourceMock,
  setCatalogResourceEnabled: setCatalogResourceEnabledMock,
}));
vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTaskPage: listBuildTaskPageMock,
}));
vi.mock("@/modules/data-catalog/services/mock-db", () => ({
  subscribeMockDb: subscribeMockDbMock,
}));
vi.mock("@/shared/catalog", () => ({
  getCatalog: getCatalogMock,
  hasCatalogOperation: (catalog: { operations?: string[] } | null, operation: string) =>
    Boolean(catalog?.operations?.includes("*") || catalog?.operations?.includes(operation)),
}));

import { ResourceWorkspaceScene } from "./ResourceWorkspaceScene";

const staleResource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  operations: ["modify", "query_data", "view_detail"],
  rowCount: 1,
  schema: [{ name: "order_id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-20T00:00:00Z",
  expectedUpdateTime: 1,
};

const runningTask: BuildTask = {
  primaryKeyFields: [],
  incrementalFields: [],
  createTime: 100,
  embeddingFields: [],
  embeddingModel: "",
  error: null,
  finishTime: null,
  fulltextAnalyzer: "",
  fulltextFields: [],
  id: "task-1",
  lastProgressTime: null,
  mode: "batch",
  modelDimensions: 0,
  resourceId: staleResource.id,
  startTime: null,
  status: "running",
  syncedCount: 0,
  totalCount: 0,
};

describe("ResourceWorkspaceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPermissions.value = [];
    drawerProps.value = null;
    indexPanelProps.value = null;
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      name: "Catalog",
      operations: ["authorize", "resource_manage", "task_manage", "view_detail"],
    });
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
    subscribeMockDbMock.mockImplementation(() => () => {});
    discoverCatalogResourceMock.mockReset();
    setCatalogResourceEnabledMock.mockReset();
    modalConfirmMock.mockReset();
  });

  it("loads only the latest build task for the resource status", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith({
      direction: "desc",
      limit: 1,
      resourceId: staleResource.id,
      sort: "create_time",
    }, { skipErrorToast: true }));
  });

  it("refreshes index context without remounting the workspace or rechecking catalog permissions", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);

    render(
      <ResourceWorkspaceScene
        indexView="tasks"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="index"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("index-task-status-unavailable")).toBeInTheDocument());
    const refresh = indexPanelProps.value?.onRefresh as (() => Promise<void>) | undefined;
    expect(refresh).toBeTypeOf("function");
    await act(async () => { await refresh?.(); });

    expect(getCatalogResourceMock).toHaveBeenCalledTimes(2);
    expect(getCatalogMock).toHaveBeenCalledTimes(1);
    expect(listBuildTaskPageMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("index-task-status-unavailable")).toBeInTheDocument();
  });

  it.each([403, 500])("keeps resource details when task status loading fails with %s", async (status) => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    listBuildTaskPageMock.mockRejectedValue(new AxiosError(
      "Task status unavailable",
      undefined,
      undefined,
      undefined,
      {
        status,
        statusText: status === 403 ? "Forbidden" : "Internal Server Error",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    ));

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    expect(await screen.findByTestId("detail-schema-name")).toBeTruthy();
    expect(screen.getByTestId("workspace-tabs")).toBeTruthy();
    expect(screen.getByText("dataCatalog.resourceWorkspace.taskStatusUnavailable")).toHaveAttribute(
      "data-alert-type",
      "warning",
    );
    expect(screen.getByText(/dataCatalog\.resourceWorkspace\.indexStatusUnavailable/)).toBeTruthy();
    expect(screen.queryByText("common.retry")).toBeNull();
    expect(screen.queryByText("dataCatalog.permissionRequired")).toBeNull();
  });

  it("passes the unknown task status into the index panel", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    listBuildTaskPageMock.mockRejectedValue(new Error("Task status unavailable"));

    render(
      <ResourceWorkspaceScene
        indexView="tasks"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="index"
      />,
    );

    expect(await screen.findByTestId("index-task-status-unavailable")).toHaveTextContent("true");
  });

  it("uses a successful latest history page to recover the task status", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    listBuildTaskPageMock.mockRejectedValue(new Error("Task status unavailable"));

    render(
      <ResourceWorkspaceScene
        indexView="tasks"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="index"
      />,
    );

    expect(await screen.findByTestId("index-task-status-unavailable")).toHaveTextContent("true");
    expect(screen.getByText(/dataCatalog\.resourceWorkspace\.indexStatusUnavailable/)).toBeInTheDocument();

    act(() => {
      (indexPanelProps.value?.onLatestTaskLoaded as
        | ((resourceId: string, task: BuildTask | null) => void)
        | undefined)?.(staleResource.id, runningTask);
    });

    expect(screen.getByTestId("index-task-status-unavailable")).toHaveTextContent("false");
    expect(screen.getByText(/dataCatalog\.indexState\.building/)).toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.resourceWorkspace.taskStatusUnavailable")).toBeNull();
  });

  it("keeps a directly granted resource available when the parent catalog is forbidden", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    getCatalogMock.mockRejectedValue(new AxiosError(
      "Forbidden",
      undefined,
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    ));

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("detail-schema-name")).toBeTruthy());
    expect(screen.queryByText("Forbidden")).toBeNull();
    expect(getCatalogMock).toHaveBeenCalledWith(staleResource.catalogId, { skipErrorToast: true });
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("keeps the detail tab reachable but hides resource details without view_detail", async () => {
    getCatalogResourceMock.mockResolvedValue({ ...staleResource, operations: ["query_data"] });

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    expect(await screen.findByText("dataCatalog.permissionRequired")).toHaveAttribute(
      "data-alert-type",
      "warning",
    );
    expect(screen.queryByTestId("detail-schema-name")).toBeNull();
  });

  it("keeps tab navigation and a warning visible when the resource read is forbidden", async () => {
    getCatalogResourceMock.mockRejectedValue(new AxiosError(
      "Forbidden",
      undefined,
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    ));

    const onTabChange = vi.fn();
    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={onTabChange}
        resourceId={staleResource.id}
        tab="index"
      />,
    );

    expect(await screen.findByText("dataCatalog.permissionRequired")).toHaveAttribute(
      "data-alert-type",
      "warning",
    );
    expect(screen.getByText("dataCatalog.resourceWorkspace.permissionRefreshHint")).toBeTruthy();
    expect(screen.queryByText("common.retry")).toBeNull();
    expect(screen.getByTestId("workspace-tabs")).toHaveAttribute(
      "data-tab-keys",
      "detail,preview,index,semantic-understanding",
    );
    fireEvent.click(screen.getByText("dataCatalog.resourceWorkspace.tabDetail"));
    expect(onTabChange).toHaveBeenCalledWith("detail");
    expect(screen.queryByText("orders")).toBeNull();
    expect(screen.queryByTestId("detail-schema-name")).toBeNull();
    expect(getCatalogMock).not.toHaveBeenCalled();
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("keeps server failures as errors rather than permission warnings", async () => {
    getCatalogResourceMock.mockRejectedValue(new AxiosError(
      "Unavailable",
      undefined,
      undefined,
      undefined,
      {
        status: 500,
        statusText: "Internal Server Error",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    ));

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    expect(await screen.findByText("Unavailable")).toHaveAttribute("data-alert-type", "error");
    expect(screen.getByText("dataCatalog.resourceWorkspace.loadErrorRefreshHint")).toBeTruthy();
    expect(screen.queryByText("common.retry")).toBeNull();
    expect(screen.queryByTestId("workspace-tabs")).toBeNull();
  });

  it("does not load build tasks without task_manage on the parent catalog", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      builtin: false,
      name: "Catalog",
      operations: ["view_detail"],
    });

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("detail-schema-name")).toBeTruthy());
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("keeps semantic understanding reachable without task_manage", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      builtin: false,
      name: "Catalog",
      operations: ["view_detail"],
    });
    const onTabChange = vi.fn();

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={onTabChange}
        resourceId={staleResource.id}
        tab="semantic-understanding"
      />,
    );

    expect(await screen.findByTestId("semantic-panel")).toBeTruthy();
    expect(onTabChange).not.toHaveBeenCalledWith("detail");
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("keeps semantic understanding unavailable for internal catalogs", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      builtin: true,
      name: "Internal Catalog",
      operations: ["task_manage", "view_detail"],
    });
    const onTabChange = vi.fn();

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={onTabChange}
        resourceId={staleResource.id}
        tab="semantic-understanding"
      />,
    );

    await waitFor(() => expect(onTabChange).toHaveBeenCalledWith("detail"));
    expect(screen.queryByTestId("semantic-panel")).toBeNull();
  });

  it("does not use global catalog grants for management actions on the current catalog", async () => {
    currentPermissions.value = [
      "catalog:resource_manage",
      "catalog:task_manage",
      "catalog:view_detail",
    ];
    getCatalogResourceMock.mockResolvedValue(staleResource);
    getCatalogMock.mockResolvedValue({
      id: "catalog-1",
      name: "Catalog",
      operations: ["view_detail"],
    });

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("detail-schema-name")).toBeTruthy());
    expect(screen.queryByText("dataCatalog.resourceWorkspace.refreshMetadata")).toBeNull();
    expect(screen.queryByText("common.disable")).toBeNull();
  });

  it("opens the shared authorization drawer from the resource workspace", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    getCatalogResourceMock.mockResolvedValue(staleResource);

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    fireEvent.click(await screen.findByText("dataCatalog.catalog.authorize"));

    expect(screen.getByTestId("authorize-drawer")).toBeTruthy();
    expect(drawerProps.value?.objType).toBe("resource");
    expect(drawerProps.value?.objId).toBe("resource-1");
    expect(drawerProps.value?.objName).toBe("orders");
  });

  it("confirms metadata refresh and resource availability changes before creating requests", async () => {
    getCatalogResourceMock.mockResolvedValue(staleResource);

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await screen.findByText("dataCatalog.resourceWorkspace.refreshMetadata");
    fireEvent.click(screen.getByText("dataCatalog.resourceWorkspace.refreshMetadata"));
    fireEvent.click(screen.getByText("common.disable"));

    expect(discoverCatalogResourceMock).not.toHaveBeenCalled();
    expect(setCatalogResourceEnabledMock).not.toHaveBeenCalled();
    expect(modalConfirmMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: "dataCatalog.resourceWorkspace.refreshMetadataConfirmTitle",
    }));
    expect(modalConfirmMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      okButtonProps: { danger: true },
      title: "dataCatalog.resourceWorkspace.disableConfirmTitle",
    }));
  });

  it("confirms enabling a disabled resource before issuing the request", async () => {
    getCatalogResourceMock.mockResolvedValue({ ...staleResource, enabled: false });

    render(
      <ResourceWorkspaceScene
        indexView="config"
        onIndexViewChange={vi.fn()}
        onTabChange={vi.fn()}
        resourceId={staleResource.id}
        tab="detail"
      />,
    );

    await screen.findByText("common.enable");
    fireEvent.click(screen.getByText("common.enable"));

    expect(setCatalogResourceEnabledMock).not.toHaveBeenCalled();
    expect(modalConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "dataCatalog.resourceWorkspace.enableConfirmTitle",
    }));
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

  it("removes cached resource details when a tab refresh loses read permission", async () => {
    getCatalogResourceMock
      .mockResolvedValueOnce(staleResource)
      .mockRejectedValueOnce(new AxiosError(
        "Forbidden",
        undefined,
        undefined,
        undefined,
        {
          status: 403,
          statusText: "Forbidden",
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders() },
          data: {},
        },
      ));

    const props = {
      indexView: "config" as const,
      onIndexViewChange: vi.fn(),
      onTabChange: vi.fn(),
      resourceId: staleResource.id,
      tab: "detail" as const,
    };
    const { rerender } = render(<ResourceWorkspaceScene {...props} />);
    await screen.findByTestId("detail-schema-name");

    rerender(<ResourceWorkspaceScene {...props} tab="preview" />);

    expect(await screen.findByText("dataCatalog.permissionRequired")).toHaveAttribute(
      "data-alert-type",
      "warning",
    );
    expect(screen.queryByText("orders")).toBeNull();
    expect(screen.queryByTestId("detail-schema-name")).toBeNull();
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
