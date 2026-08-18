/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
  BusinessTree: () => null,
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
});
