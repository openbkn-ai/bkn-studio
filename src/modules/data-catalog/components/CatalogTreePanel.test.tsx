/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, Key, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/shared/catalog";

type MockTreeNode = {
  children?: MockTreeNode[];
  key: Key;
  title?: ReactNode;
};

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    i18n: { language: "zh-CN" },
    t: (key: string, values?: { catalogCount?: number }) => (
      key === "dataCatalog.tree.summary" ? `catalogs:${values?.catalogCount}` : key
    ),
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() }, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/ui/common/BusinessTreePanel", () => ({
  BusinessTree: ({
    expandedKeys = [],
    onExpand,
    onSelect,
    treeData = [],
  }: {
    expandedKeys?: Key[];
    onExpand?: (keys: Key[]) => void;
    onSelect?: (keys: Key[]) => void;
    treeData?: MockTreeNode[];
  }) => {
    const renderTitles = (nodes: MockTreeNode[]): ReactNode => nodes.map((node) => (
      <div key={node.key}>
        {node.title}
        {node.children ? renderTitles(node.children) : null}
      </div>
    ));

    return (
      <>
        <output data-testid="expanded-keys">{expandedKeys.join(",")}</output>
        <output data-testid="tree-keys">{treeData.map((node) => node.key).join(",")}</output>
        <output data-testid="catalog-tree-keys">
          {treeData.flatMap((root) => [
            root.key,
            ...(root.children ?? []).flatMap((child) => [
              child.key,
              ...(child.children ?? []).map((grandchild) => grandchild.key),
            ]),
          ]).join(",")}
        </output>
        <div data-testid="tree-titles">{renderTitles(treeData)}</div>
        <button onClick={() => onExpand?.([])} type="button">collapse catalog</button>
        <button onClick={() => onExpand?.(["catalog:catalog-1"])} type="button">expand catalog</button>
        <button onClick={() => onSelect?.(["connector:postgresql"])} type="button">select connector</button>
        <button onClick={() => onSelect?.(["catalog-load-more:logical"])} type="button">load more logical catalogs</button>
        <button onClick={() => onSelect?.(["catalog:catalog-1"])} type="button">select catalog</button>
      </>
    );
  },
  BusinessTreePanel: ({ children, footer, headerActions }: { children: ReactNode; footer?: ReactNode; headerActions: ReactNode }) => (
    <div>
      {headerActions}
      {children}
      <output data-testid="catalog-summary">{footer}</output>
    </div>
  ),
}));

import { CatalogTreePanel } from "./CatalogTreePanel";

function makeCatalog(
  id: string,
  name: string,
  type: CatalogRecord["type"],
  builtin = false,
): CatalogRecord {
  return {
    category: "table",
    connectorConfig: {},
    connectorType: type === "physical" ? "postgresql" : "",
    createTime: null,
    creatorName: "-",
    description: "",
    enabled: true,
    expectedUpdateTime: 1,
    healthCheckResult: "",
    healthStatus: "unchecked",
    id,
    builtin,
    lastCheckTime: null,
    metadata: {},
    mode: "",
    name,
    operations: [],
    status: "enabled",
    tags: [],
    type,
    updateTime: null,
    updaterName: "-",
  };
}

describe("CatalogTreePanel", () => {
  it("hides creation and duplicate data-connect entry points", () => {
    render(
      <CatalogTreePanel
        catalogs={[]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    expect(screen.queryByLabelText("dataCatalog.tree.addLogical")).toBeNull();
    expect(screen.queryByLabelText("dataCatalog.catalog.goScan")).toBeNull();
    expect(screen.queryByLabelText("dataCatalog.catalog.goConnection")).toBeNull();
  });

  it("keeps both root groups visible when a search has no matches", () => {
    render(
      <CatalogTreePanel
        catalogs={[]}
        discoveringCatalogIds={[]}
        keyword="missing"
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    expect(screen.getByTestId("tree-keys").textContent).toBe("group:physical,group:logical");
  });

  it("keeps matching physical connector groups collapsed until the user loads them", () => {
    render(
      <CatalogTreePanel
        catalogs={[]}
        connectorTypeStats={[{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }]}
        discoveringCatalogIds={[]}
        keyword="orders"
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    expect(screen.getByTestId("expanded-keys").textContent).not.toContain("connector:postgresql");
  });

  it("uses statistics for the catalog total instead of the loaded page size", () => {
    render(
      <CatalogTreePanel
        catalogs={[]}
        connectorTypeStats={[
          { catalogCount: 250, catalogType: "physical", connectorType: "postgresql" },
          { catalogCount: 3, catalogType: "logical", connectorType: "" },
        ]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    expect(screen.getByTestId("catalog-summary").textContent).toBe("catalogs:253");
  });

  it("preserves backend order for mixed-case and Chinese names while pinning built-in logical catalogs", () => {
    render(
      <CatalogTreePanel
        catalogs={[
          makeCatalog("physical-zulu", "Zulu", "physical"),
          makeCatalog("physical-chinese", "中文", "physical"),
          makeCatalog("physical-alpha", "alpha", "physical"),
          makeCatalog("logical-zulu", "Zulu", "logical"),
          makeCatalog("logical-builtin", "openbkn_system", "logical", true),
          makeCatalog("logical-chinese", "中文", "logical"),
          makeCatalog("logical-alpha", "alpha", "logical"),
        ]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    expect(screen.getByTestId("catalog-tree-keys").textContent).toBe([
      "group:physical",
      "connector:postgresql",
      "catalog:physical-zulu",
      "catalog:physical-chinese",
      "catalog:physical-alpha",
      "group:logical",
      "catalog:logical-builtin",
      "catalog:logical-zulu",
      "catalog:logical-chinese",
      "catalog:logical-alpha",
    ].join(","));
  });

  it("exposes complete names for truncated catalog and schema nodes", () => {
    const physicalName = "ISSUE180_IV18007_PG17_physical_catalog_with_a_long_suffix";
    const logicalName = "ISSUE180_IV18007_PG17_logical_catalog_with_a_long_suffix";
    const schemaName = "ISSUE180_IV18007_PG17_schema_with_a_long_suffix";

    render(
      <CatalogTreePanel
        catalogs={[
          {
            ...makeCatalog("catalog-1", physicalName, "physical"),
            enabled: false,
            schemas: [schemaName],
            status: "disabled",
          },
          makeCatalog("logical-long", logicalName, "logical"),
        ]}
        discoveringCatalogIds={["catalog-1"]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={{ id: "catalog-1", type: "catalog" }}
      />,
    );

    expect(screen.getByText(physicalName)).toHaveAttribute("title", physicalName);
    expect(screen.getByText(logicalName)).toHaveAttribute("title", logicalName);
    expect(screen.getByText("common.disabled")).toBeInTheDocument();
    expect(screen.getByText("dataCatalog.tree.discovering")).toBeInTheDocument();
    expect(screen.getByText(schemaName)).toHaveAttribute("title", schemaName);
  });

  it("uses schemas from the catalog summary when a physical catalog is expanded", () => {
    const catalog: CatalogRecord = {
      category: "table",
      connectorConfig: {},
      connectorType: "postgresql",
      createTime: null,
      creatorName: "-",
      description: "",
      enabled: true,
      expectedUpdateTime: 1,
      healthCheckResult: "",
      healthStatus: "unchecked",
      id: "catalog-1",
      builtin: false,
      lastCheckTime: null,
      metadata: {},
      mode: "",
      name: "orders",
      operations: [],
      schemas: ["public"],
      status: "enabled",
      tags: [],
      type: "physical",
      updateTime: null,
      updaterName: "-",
    };
    const props: ComponentProps<typeof CatalogTreePanel> = {
      catalogs: [catalog],
      discoveringCatalogIds: [],
      onRefresh: vi.fn(),
      onSelectCatalog: vi.fn(),
      resourceCount: 0,
      selection: null,
    };
    render(<CatalogTreePanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "expand catalog" }));
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("expands a summary-only catalog using schemas from the catalog summary", () => {
    const catalog = {
      ...makeCatalog("catalog-1", "orders", "physical"),
      operations: ["view_summary"],
      schemas: ["public"],
    };

    render(
      <CatalogTreePanel
        catalogs={[catalog]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "expand catalog" }));
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("expands a connector group when its title is selected", () => {
    const catalog: CatalogRecord = {
      category: "table",
      connectorConfig: {},
      connectorType: "postgresql",
      createTime: null,
      creatorName: "-",
      description: "",
      enabled: true,
      expectedUpdateTime: 1,
      healthCheckResult: "",
      healthStatus: "unchecked",
      id: "catalog-1",
      builtin: false,
      lastCheckTime: null,
      metadata: {},
      mode: "",
      name: "orders",
      operations: [],
      status: "enabled",
      tags: [],
      type: "physical",
      updateTime: null,
      updaterName: "-",
    };

    render(
      <CatalogTreePanel
        catalogs={[catalog]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "select connector" }));

    expect(screen.getByTestId("expanded-keys").textContent).toContain("connector:postgresql");
  });

  it("loads the next page for logical catalogs", () => {
    const onLoadCatalogsByConnectorType = vi.fn().mockResolvedValue(undefined);
    const catalog: CatalogRecord = {
      category: "table",
      connectorConfig: {},
      connectorType: "",
      createTime: null,
      creatorName: "-",
      description: "",
      enabled: true,
      expectedUpdateTime: 1,
      healthCheckResult: "",
      healthStatus: "unchecked",
      id: "catalog-1",
      builtin: false,
      lastCheckTime: null,
      metadata: {},
      mode: "",
      name: "logical-orders",
      operations: [],
      status: "enabled",
      tags: [],
      type: "logical",
      updateTime: null,
      updaterName: "-",
    };

    render(
      <CatalogTreePanel
        catalogs={[catalog]}
        connectorTypeStats={[{ catalogCount: 2, catalogType: "logical", connectorType: "" }]}
        discoveringCatalogIds={[]}
        onLoadCatalogsByConnectorType={onLoadCatalogsByConnectorType}
        onRefresh={vi.fn()}
        onSelectCatalog={vi.fn()}
        resourceCount={0}
        selection={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "load more logical catalogs" }));
    fireEvent.click(screen.getByRole("button", { name: "load more logical catalogs" }));

    expect(onLoadCatalogsByConnectorType).toHaveBeenCalledWith("", 1);
    expect(onLoadCatalogsByConnectorType).toHaveBeenCalledTimes(1);
  });

  it("expands a catalog when its title is selected", () => {
    const onSelectCatalog = vi.fn();
    const catalog: CatalogRecord = {
      category: "table",
      connectorConfig: {},
      connectorType: "postgresql",
      createTime: null,
      creatorName: "-",
      description: "",
      enabled: true,
      expectedUpdateTime: 1,
      healthCheckResult: "",
      healthStatus: "unchecked",
      id: "catalog-1",
      builtin: false,
      lastCheckTime: null,
      metadata: {},
      mode: "",
      name: "orders",
      operations: [],
      status: "enabled",
      tags: [],
      type: "physical",
      updateTime: null,
      updaterName: "-",
    };

    render(
      <CatalogTreePanel
        catalogs={[catalog]}
        discoveringCatalogIds={[]}
        onRefresh={vi.fn()}
        onSelectCatalog={onSelectCatalog}
        resourceCount={0}
        selection={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "select catalog" }));

    expect(onSelectCatalog).toHaveBeenCalledWith("catalog-1");
    expect(screen.getByTestId("expanded-keys").textContent).toContain("catalog:catalog-1");
  });
});
