/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";
import { EvalRoutePage } from "./EvalRoutePage";
import type { EvalTab } from "./types";
import { defaultCaseFilters, type EvalCaseFilters } from "./eval-case-navigation";

const access = vi.hoisted(() => ({ status: "allowed" }));
vi.mock("./useEvalAccess", () => ({
  useEvalAccess: () => ({ status: access.status, retry: vi.fn() }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/shell/TopBar", () => ({ TopBar: () => <header>Studio</header> }));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: {} }),
}));
vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({ hiddenNavigation: [] }),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => "available",
  useEntitlementContext: () => ({ snapshot: null }),
}));
vi.mock("@/modules/knowledge-network/scenes/workspace/useWorkspaceData", () => ({
  useWorkspaceData: () => ({ detail: { name: "Supply network", statistics: {} } }),
}));
vi.mock("@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal", () => ({
  KnowledgeNetworkFormModal: () => null,
}));
vi.mock("@/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection", () => ({
  WorkspaceOverviewSection: () => <div>Network overview</div>,
}));
vi.mock("@/modules/knowledge-network/eval/EvalWorkspaceScene", () => ({
  EvalWorkspaceScene: ({
    networkId,
    activeTab,
    onTabChange,
  }: {
    networkId: string;
    activeTab: EvalTab;
    onTabChange: (tab: EvalTab, filters?: Partial<EvalCaseFilters>) => void;
  }) => (
    <div>
      <div>Eval content: {networkId}</div>
      <output data-testid="active-eval-tab">{activeTab}</output>
      <button onClick={() => onTabChange("cases")}>Cases tab</button>
      <button
        onClick={() =>
          onTabChange("cases", {
            ...defaultCaseFilters,
            result: "failed",
            participation: "participating",
            status: "enabled",
          })
        }
      >
        Failed Cases
      </button>
      <button onClick={() => onTabChange("runs")}>Runs tab</button>
      <button onClick={() => onTabChange("overview")}>Overview tab</button>
    </div>
  ),
}));
function HistoryControls() {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (
    <>
      <output data-testid="query">{search}</output>
      <button onClick={() => void navigate(-1)}>Back</button>
      <button onClick={() => void navigate(1)}>Forward</button>
    </>
  );
}

it("restores a linked tab and supports browser history without dropping other query parameters", () => {
  render(
    <MemoryRouter
      initialEntries={["/knowledge-network/workspace/supply/evals?tab=runs&context=keep"]}
    >
      <HistoryControls />
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("runs");
  fireEvent.click(screen.getByText("Cases tab"));
  expect(screen.getByTestId("query")).toHaveTextContent("tab=cases&context=keep");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("runs");
  fireEvent.click(screen.getByText("Forward"));
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("cases");
  fireEvent.click(screen.getByText("Overview tab"));
  expect(screen.getByTestId("query")).toHaveTextContent("?context=keep");
});

it("falls back to overview for an unsupported tab", () => {
  render(
    <MemoryRouter initialEntries={["/knowledge-network/workspace/supply/evals?tab=unknown"]}>
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("overview");
});

it("treats removed tabs as unknown instead of redirecting them", () => {
  render(
    <MemoryRouter
      initialEntries={["/knowledge-network/workspace/supply/evals?tab=repairs&context=keep"]}
    >
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("overview");
});

it("opens a direct Eval URL with workspace navigation and can switch to overview and back", () => {
  render(
    <MemoryRouter
      basename="/studio"
      initialEntries={["/studio/knowledge-network/workspace/supply/evals"]}
    >
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
        <Route
          path="/knowledge-network/workspace/:networkId/overview"
          element={<KnowledgeNetworkWorkspaceScene section="overview" />}
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("Eval content: supply")).toBeTruthy();
  // The current shell owns the network heading; the workspace no longer repeats it.
  expect(screen.getByRole("banner").textContent).toBe("Studio");
  expect(screen.getByTitle("knowledgeNetwork.eval.title").className).toMatch(/sideItemActive/);
  fireEvent.click(screen.getByRole("button", { name: "shell.collapseSidenav" }));
  expect(screen.getByTitle("knowledgeNetwork.eval.title").textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "shell.expandSidenav" }));
  fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork.workspaceOverviewShort/ }));
  expect(screen.getByText("Network overview")).toBeTruthy();
  expect(screen.queryByText("Eval content: supply")).toBeNull();
  fireEvent.click(screen.getByTitle("knowledgeNetwork.eval.title"));
  expect(screen.getByText("Eval content: supply")).toBeTruthy();
});

it("opens an exact metric scope and restores filters through browser back and forward", () => {
  render(
    <MemoryRouter initialEntries={["/knowledge-network/workspace/supply/evals?context=keep"]}>
      <HistoryControls />
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Failed Cases"));
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("cases");
  expect(screen.getByTestId("query")).toHaveTextContent("case_result=failed");
  expect(screen.getByTestId("query")).toHaveTextContent("case_scope=participating");
  expect(screen.getByTestId("query")).toHaveTextContent("case_status=enabled");
  expect(screen.getByTestId("query")).toHaveTextContent("context=keep");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("overview");
  expect(screen.getByTestId("query")).not.toHaveTextContent("case_result");
  fireEvent.click(screen.getByText("Forward"));
  expect(screen.getByTestId("active-eval-tab")).toHaveTextContent("cases");
  expect(screen.getByTestId("query")).toHaveTextContent("case_result=failed");
});

it("clears run detail when navigating to another functional page and restores it on Back", () => {
  render(
    <MemoryRouter
      initialEntries={[
        "/knowledge-network/workspace/supply/evals?tab=runs&run_id=run-1&case_run_id=case-2&result_tab=evidence&run_page=2",
      ]}
    >
      <HistoryControls />
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Cases tab"));
  expect(screen.getByTestId("query")).not.toHaveTextContent("run_id");
  expect(screen.getByTestId("query")).toHaveTextContent("run_page=2");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByTestId("query")).toHaveTextContent("run_id=run-1");
  expect(screen.getByTestId("query")).toHaveTextContent("result_tab=evidence");
});

it("does not mount Eval content when backend admission denies the current user", () => {
  access.status = "denied";
  render(
    <MemoryRouter initialEntries={["/knowledge-network/workspace/supply/evals"]}>
      <Routes>
        <Route path="/knowledge-network/workspace/:networkId/evals" element={<EvalRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.queryByText("Eval content: supply")).toBeNull();
  expect(screen.getByText("knowledgeNetwork.eval.access.denied")).toBeTruthy();
  expect(screen.queryByTitle("knowledgeNetwork.eval.title")).toBeNull();
  access.status = "allowed";
});
