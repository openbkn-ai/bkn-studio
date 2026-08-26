/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, Key, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/shared/catalog";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() }, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/ui/common/BusinessTreePanel", () => ({
  BusinessTree: ({ onExpand }: { onExpand?: (keys: Key[]) => void }) => (
    <>
      <button onClick={() => onExpand?.([])} type="button">collapse catalog</button>
      <button onClick={() => onExpand?.(["catalog:catalog-1"])} type="button">expand catalog</button>
    </>
  ),
  BusinessTreePanel: ({ children, headerActions }: { children: ReactNode; headerActions: ReactNode }) => (
    <div>
      {headerActions}
      {children}
    </div>
  ),
}));

import { CatalogTreePanel } from "./CatalogTreePanel";

describe("CatalogTreePanel", () => {
  it("hides creation and duplicate data-connect entry points", () => {
    render(
      <CatalogTreePanel
        catalogs={[]}
        connectorTypes={[]}
        discoveringCatalogIds={[]}
        onLoadCatalogSchemas={vi.fn()}
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

  it("loads physical catalog schemas only when its node is expanded", async () => {
    const onLoadCatalogSchemas = vi.fn().mockResolvedValue(["public"]);
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
      internal: false,
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
    const props: ComponentProps<typeof CatalogTreePanel> = {
      catalogs: [catalog],
      connectorTypes: [],
      discoveringCatalogIds: [],
      onLoadCatalogSchemas,
      onRefresh: vi.fn(),
      onSelectCatalog: vi.fn(),
      resourceCount: 0,
      selection: null,
    };
    const { rerender } = render(<CatalogTreePanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "expand catalog" }));
    await waitFor(() => expect(onLoadCatalogSchemas).toHaveBeenCalledWith("catalog-1"));
    fireEvent.click(screen.getByRole("button", { name: "collapse catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "expand catalog" }));
    expect(onLoadCatalogSchemas).toHaveBeenCalledTimes(1);

    rerender(<CatalogTreePanel {...props} catalogs={[{ ...catalog }]} />);
    fireEvent.click(screen.getByRole("button", { name: "collapse catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "expand catalog" }));
    await waitFor(() => expect(onLoadCatalogSchemas).toHaveBeenCalledTimes(2));
  });
});
