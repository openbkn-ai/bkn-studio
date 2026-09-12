/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolDetailScene } from "@/modules/execution-factory/scenes/ToolDetailScene";
import { ToolboxToolsScene } from "@/modules/execution-factory/scenes/ToolboxToolsScene";
import { buildReturnToState } from "@/modules/execution-factory/utils/back-navigation";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { destroy: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: {
      currentUser: {
        permissions: [
          "execution-factory:tool:create",
          "execution-factory:tool:debug",
          "execution-factory:tool:delete",
          "execution-factory:tool:edit",
          "execution-factory:toolbox:edit",
        ],
      },
    },
  }),
}));

// The two scenes under test only need their chrome; everything that talks to the backend or
// renders an editor is stubbed so the test exercises routing and nothing else.
vi.mock("@/modules/execution-factory/components/HttpToolLifecyclePanel", () => ({
  HttpToolLifecyclePanel: ({ businessFields }: { businessFields: ReactNode }) => (
    <>{businessFields}</>
  ),
}));
vi.mock("@/modules/execution-factory/components/OpenApiDefinitionFields", () => ({
  OpenApiDefinitionFields: () => null,
}));
vi.mock("@/modules/execution-factory/components/FunctionDefinitionFields", () => ({
  FunctionDefinitionFields: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolDebugPanel", () => ({
  ToolDebugPanel: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolIoPanel", () => ({
  ToolIoPanel: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolDebugModal", () => ({
  ToolDebugModal: () => null,
}));
vi.mock("@/modules/execution-factory/components/ToolFormDrawer", () => ({
  ToolFormDrawer: () => null,
}));
vi.mock("@/modules/execution-factory/components/create-menu/AddCapabilityWizard", () => ({
  AddCapabilityWizard: () => null,
}));
vi.mock("@/modules/execution-factory/utils/use-audit-user-directory", () => ({
  useAuditUserDirectory: () => new Map<string, string>(),
}));
vi.mock("@/modules/execution-factory/utils/use-impex-export", () => ({
  useImpexExport: () => ({ exportComponentById: vi.fn(), isExporting: () => false }),
}));

const { getToolbox, getToolboxMarket } = vi.hoisted(() => ({
  getToolbox: vi.fn(),
  getToolboxMarket: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox,
  getToolboxMarket,
}));

const { deleteTools, getToolDetail, listTools, updateTool, updateToolStatus } = vi.hoisted(() => ({
  deleteTools: vi.fn(),
  getToolDetail: vi.fn(),
  listTools: vi.fn(),
  updateTool: vi.fn(),
  updateToolStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  deleteTools,
  getToolDetail,
  listTools,
  updateTool,
  updateToolStatus,
}));

const LIST_URL = "/execution-factory/units?activeTab=toolbox";
const TOOLS_URL = "/execution-factory/toolboxes/box-1/tools";
const DETAIL_URL = "/execution-factory/toolboxes/box-1/tools/tool-1/edit";
const CAPABILITY_LIST_URL = "/knowledge-network/kn-1/capabilities?kind=function";

/** Reports the current location and offers the browser's own back, which no scene may rely on. */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      <button onClick={() => void navigate(-1)} type="button">
        browser back
      </button>
    </>
  );
}

function ToolDetailRoute() {
  const { boxId, toolId } = useParams<{ boxId: string; toolId: string }>();
  return <ToolDetailScene boxId={boxId ?? ""} toolId={toolId ?? ""} />;
}

function ToolboxToolsRoute() {
  const { boxId } = useParams<{ boxId: string }>();
  return <ToolboxToolsScene boxId={boxId ?? ""} />;
}

function renderAt(entries: Array<string | { pathname: string; search?: string; state?: unknown }>) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <LocationProbe />
      <Routes>
        <Route element={<output>toolbox list</output>} path="/execution-factory/units" />
        <Route element={<output>catalog</output>} path="/execution-factory/catalog" />
        <Route element={<ToolboxToolsRoute />} path="/execution-factory/toolboxes/:boxId/tools" />
        <Route
          element={<ToolDetailRoute />}
          path="/execution-factory/toolboxes/:boxId/tools/:toolId/edit"
        />
        <Route element={<output>capability list</output>} path="/knowledge-network/*" />
        <Route element={<output>elsewhere</output>} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

function currentLocation() {
  return screen.getByTestId("location").textContent;
}

async function clickBack() {
  const button = await screen.findByRole("button", { name: "common.back" });
  fireEvent.click(button);
}

describe("tool config back navigation (#386)", () => {
  beforeAll(() => {
    // A real tab always holds more than one entry; jsdom reports one, which would let a scene
    // that still consulted `window.history.length` before `navigate(-1)` pass by accident.
    Object.defineProperty(window.history, "length", { configurable: true, value: 5 });

    // antd's grid subscribes to breakpoints through matchMedia, which jsdom does not provide.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getToolbox.mockResolvedValue({
      boxId: "box-1",
      name: "Box",
      metadataType: "openapi",
      status: "enabled",
    });
    getToolboxMarket.mockResolvedValue({
      boxId: "box-1",
      name: "Box",
      metadataType: "openapi",
      status: "enabled",
    });
    listTools.mockResolvedValue({ items: [], total: 0 });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "Tool",
      metadataType: "openapi",
      status: "enabled",
    });
  });

  it("walks from the wizard's config page to the tool list and on to the toolbox list", async () => {
    // The wizard pushes the config page straight on top of the toolbox list.
    renderAt([LIST_URL, DETAIL_URL]);
    expect(currentLocation()).toBe(DETAIL_URL);

    await clickBack();
    await waitFor(() => expect(currentLocation()).toBe(TOOLS_URL));

    await clickBack();
    await waitFor(() =>
      expect(currentLocation()).toBe(`${LIST_URL}&toolboxView=openapi`),
    );
    expect(screen.getByText("toolbox list")).toBeTruthy();
  });

  it("does not leave the config page behind for the browser's back to land on", async () => {
    renderAt([LIST_URL, DETAIL_URL]);

    await clickBack();
    await waitFor(() => expect(currentLocation()).toBe(TOOLS_URL));

    fireEvent.click(screen.getByRole("button", { name: "browser back" }));
    await waitFor(() => expect(currentLocation()).toBe(LIST_URL));
    expect(screen.queryByText("executionFactory.toolDetailTitle")).toBeNull();
  });

  it("returns to a knowledge network's capability list when that is where the visitor came from", async () => {
    renderAt([
      CAPABILITY_LIST_URL,
      {
        pathname: "/execution-factory/toolboxes/box-1/tools/tool-1/edit",
        state: buildReturnToState({
          pathname: "/knowledge-network/kn-1/capabilities",
          search: "?kind=function",
        }),
      },
    ]);

    await clickBack();
    await waitFor(() => expect(currentLocation()).toBe(CAPABILITY_LIST_URL));
    expect(screen.getByText("capability list")).toBeTruthy();
  });

  it("sends the tool list back to its own list page instead of whatever the history holds", async () => {
    renderAt(["/somewhere/else", TOOLS_URL]);

    await clickBack();
    await waitFor(() =>
      expect(currentLocation()).toBe(`${LIST_URL}&toolboxView=openapi`),
    );
  });

  it("sends a marketplace preview of the tool list back to the catalog", async () => {
    renderAt(["/somewhere/else", `${TOOLS_URL}?from=catalog`]);

    await clickBack();
    await waitFor(() =>
      expect(currentLocation()).toBe("/execution-factory/catalog?activeTab=toolbox&toolboxView=openapi"),
    );
  });
});
