/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import { ToolDetailScene } from "@/modules/execution-factory/scenes/ToolDetailScene";
import { ToolboxFormScene } from "@/modules/execution-factory/scenes/ToolboxFormScene";

const mocks = vi.hoisted(() => ({
  createToolbox: vi.fn(),
  fetchCurrentUser: vi.fn(),
  permissions: [] as string[],
  navigate: vi.fn(),
  getToolbox: vi.fn(),
  getToolDetail: vi.fn(),
  updateToolbox: vi.fn(),
  updateTool: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/framework/auth/current-user", () => ({
  fetchCurrentUser: mocks.fetchCurrentUser,
}));

vi.mock("@/modules/execution-factory/utils/metadata-content", () => ({
  validateOpenApiDocumentText: () => ({ ok: true }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    runtimeConfig: { currentUser: { permissions: mocks.permissions } },
  }),
}));

vi.mock("@/framework/scaffold/CrudFormPage", () => ({
  CrudFormPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  createToolbox: mocks.createToolbox,
  getToolbox: mocks.getToolbox,
  getToolboxMarket: mocks.getToolbox,
  updateToolbox: mocks.updateToolbox,
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  getToolDetail: mocks.getToolDetail,
  updateTool: mocks.updateTool,
}));

vi.mock("@/modules/execution-factory/components/HttpToolLifecyclePanel", () => ({
  HttpToolLifecyclePanel: ({ businessFields, debugWorkbench }: {
    businessFields: ReactNode;
    debugWorkbench: ReactNode;
  }) => <>{businessFields}{debugWorkbench}</>,
}));

vi.mock("@/modules/execution-factory/components/ToolDebugPanel", () => ({
  ToolDebugPanel: () => <button type="button">debug-run</button>,
}));

vi.mock("@/modules/execution-factory/components/FunctionDefinitionFields", () => ({
  FunctionDefinitionFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/OpenApiDefinitionFields", () => ({
  OpenApiDefinitionFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/ToolIoPanel", () => ({
  ToolIoPanel: () => null,
}));

vi.mock("@/modules/execution-factory/components/ToolboxMetadataFormFields", () => ({
  ToolboxMetadataFormFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/OpenApiSpecInput", () => ({
  OpenApiSpecInput: (props: ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@/modules/execution-factory/components/execution-unit-detail/ExecutionUnitDetailDrawerLayout", () => ({
  ExecutionUnitDetailDrawerLayout: ({ children, footerPrimary, footerSecondary }: {
    children: ReactNode;
    footerPrimary: ReactNode;
    footerSecondary: ReactNode;
  }) => <div>{children}{footerPrimary}{footerSecondary}</div>,
}));

vi.mock("@/modules/execution-factory/components/DetailMetaPanel", () => ({
  DetailMetaPanel: () => null,
}));

vi.mock("@/modules/execution-factory/utils/use-audit-user-directory", () => ({
  useAuditUserDirectory: () => new Map(),
}));

vi.mock("@/modules/execution-factory/utils/use-impex-export", () => ({
  useImpexExport: () => ({ exportComponentById: vi.fn(), isExporting: () => false }),
}));

beforeAll(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = [];
  mocks.getToolbox.mockResolvedValue({
    boxId: "box-1",
    name: "Box",
    description: "",
    metadataType: "function",
    status: "unpublish",
  });
  mocks.getToolDetail.mockResolvedValue({
    toolId: "tool-1",
    name: "Tool",
    metadataType: "function",
    status: "enabled",
  });
  mocks.fetchCurrentUser.mockResolvedValue({
    id: "user-1",
    permissions: ["execution-factory:function:view", "execution-factory:toolbox:view"],
    roles: [],
  });
});

afterEach(cleanup);

function renderForm() {
  return render(<MemoryRouter><ToolboxFormScene boxId="box-1" mode="edit" /></MemoryRouter>);
}

function renderTool() {
  return render(<MemoryRouter><ToolDetailScene boxId="box-1" toolId="tool-1" /></MemoryRouter>);
}

describe("Function and API edit boundaries", () => {
  it("offers only the resource types the caller may create", async () => {
    mocks.permissions = ["execution-factory:toolbox:create"];
    render(<MemoryRouter><ToolboxFormScene mode="create" /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "executionFactory.metadataTypes.openapi" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "executionFactory.metadataTypes.function" })).toBeNull();

    cleanup();
    mocks.permissions = ["execution-factory:function:create"];
    render(<MemoryRouter><ToolboxFormScene mode="create" /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "executionFactory.metadataTypes.function" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "executionFactory.metadataTypes.openapi" })).toBeNull();
  });

  it("lets a caller with both grants switch creation types without losing the form", async () => {
    mocks.permissions = ["execution-factory:toolbox:create", "execution-factory:function:create"];
    render(<MemoryRouter><ToolboxFormScene mode="create" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("radio", { name: "executionFactory.metadataTypes.function" }));
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();
    expect(screen.queryByText("403")).toBeNull();
  });

  it.each([
    {
      grant: "execution-factory:function:create",
      metadataType: "function",
      target: "/execution-factory/toolboxes/box-created/tools?create=1",
    },
    {
      grant: "execution-factory:toolbox:create",
      metadataType: "openapi",
      target: "/execution-factory/units?activeTab=toolbox&toolboxView=openapi",
    },
  ])("refreshes owner permissions before routing a create-only $metadataType user", async ({ grant, metadataType, target }) => {
    mocks.permissions = [grant];
    mocks.createToolbox.mockResolvedValue({ boxId: "box-created" });
    render(<MemoryRouter><ToolboxFormScene mode="create" /></MemoryRouter>);

    await screen.findByRole("button", { name: "common.save" });
    if (metadataType === "openapi") {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "openapi: 3.0.0" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.createToolbox).toHaveBeenCalledWith(expect.objectContaining({ metadataType })));
    await waitFor(() => expect(mocks.fetchCurrentUser).toHaveBeenCalledOnce());
    expect(mocks.navigate).toHaveBeenCalledWith(target);
  });

  it("opens the Function form with only Function modify and denies the API form", async () => {
    mocks.permissions = ["execution-factory:function:edit"];
    renderForm();
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();

    cleanup();
    mocks.getToolbox.mockResolvedValue({
      boxId: "box-1", name: "API", metadataType: "openapi", status: "unpublish",
    });
    renderForm();
    await waitFor(() => expect(screen.getByText("403")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
  });

  it("shows the Function drawer edit button only for a Function record", async () => {
    mocks.permissions = ["execution-factory:function:edit"];
    render(<ToolboxDetailDrawer boxId="box-1" onClose={vi.fn()} open />);
    fireEvent.click(await screen.findByRole("button", { name: "executionFactory.cardMenu.edit" }));
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();

    cleanup();
    mocks.getToolbox.mockResolvedValue({
      boxId: "box-1", name: "API", metadataType: "openapi", status: "unpublish",
    });
    render(<ToolboxDetailDrawer boxId="box-1" initialEditMode onClose={vi.fn()} open />);
    await waitFor(() => expect(mocks.getToolbox).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "executionFactory.cardMenu.edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
  });

  it("keeps Function editing available while hiding execution without Function execute", async () => {
    mocks.permissions = ["execution-factory:function:edit"];
    renderTool();
    expect(await screen.findByRole("button", { name: "common.save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "debug-run" })).toBeNull();

    cleanup();
    mocks.permissions = ["execution-factory:function:edit", "execution-factory:function:debug"];
    renderTool();
    expect(await screen.findByRole("button", { name: "debug-run" })).toBeTruthy();
  });

  it("denies API tool editing to a Function-only editor", async () => {
    mocks.permissions = ["execution-factory:function:edit", "execution-factory:toolbox:view"];
    mocks.getToolDetail.mockResolvedValue({
      toolId: "tool-1", name: "API tool", metadataType: "openapi", status: "enabled",
    });
    renderTool();
    expect(await screen.findByText("common.noPermission")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "debug-run" })).toBeNull();
  });

  it("denies Function tool editing to an API-only editor", async () => {
    mocks.permissions = ["execution-factory:toolbox:edit", "execution-factory:function:view"];
    renderTool();
    expect(await screen.findByText("common.noPermission")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
  });
});
