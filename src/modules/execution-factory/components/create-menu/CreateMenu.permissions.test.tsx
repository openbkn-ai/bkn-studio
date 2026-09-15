/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveStudioPermissions, flattenSafeGrants } from "@/framework/auth/permission-map";
import { CreateMenu } from "./CreateMenu";
import { AddCapabilityWizard } from "./AddCapabilityWizard";
import { CreateExecutionUnitWizard } from "./CreateExecutionUnitWizard";
import type { ExecutionUnitTab } from "../execution-unit/types";
import type { CapabilityUxMode } from "../../utils/capability-ux";

const state = vi.hoisted(() => ({
  runtimeConfig: { currentUser: { permissions: [] as string[] } },
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: () => state }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/execution-factory/utils/capability-ux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/capability-ux")>()),
  isCapabilityUxV2: () => true,
}));
vi.mock("./QuickAddApiForm", () => ({ QuickAddApiForm: () => <div>API form</div> }));
vi.mock("./ImportOpenApiCapabilityForm", () => ({ ImportOpenApiCapabilityForm: () => <div>Import form</div> }));
vi.mock("./CreateToolboxForm", () => ({ CreateToolboxForm: () => <div>Function form</div> }));
vi.mock("./CreateMcpDrawer", () => ({ CreateMcpDrawer: () => <div>MCP form</div> }));
vi.mock("./CreateSkillForm", () => ({ CreateSkillForm: () => <div>Skill form</div> }));
vi.mock("./ImportResourceModal", () => ({ ImportResourceModal: () => null }));
// Exercise both filtering and the parent callback: even an unexpected mode event must be rejected.
vi.mock("./AddCapabilityModeStep", () => ({
  AddCapabilityModeStep: ({ allowedModes, onModeChange }: {
    allowedModes: CapabilityUxMode[]; onModeChange: (mode: CapabilityUxMode) => void;
  }) => <div>
    {allowedModes.map((mode) => <button key={mode} onClick={() => onModeChange(mode)}>{mode}</button>)}
    <button onClick={() => onModeChange("mcp")}>unexpected MCP event</button>
  </div>,
}));

const knownPermissions = ["operator", "toolbox", "function", "mcp", "skill", "tool"].flatMap((type) =>
  ["create", "edit", "execute", "view"].map((op) => `execution-factory:${type}:${op}`),
);
function grant(type: string, operations: string[]) {
  state.runtimeConfig.currentUser.permissions = deriveStudioPermissions(knownPermissions,
    flattenSafeGrants([{ resource: { type, id: "*" }, operations }]), false);
}
const labels = {
  api: "executionFactory.capabilityCreateMenu.addHttpApi",
  function: "executionFactory.capabilityCreateMenu.addFunction",
  mcp: "executionFactory.capabilityCreateMenu.registerMcp",
  skill: "executionFactory.capabilityCreateMenu.importSkill",
};
async function openMenu(tab: ExecutionUnitTab, toolboxView: "openapi" | "function" = "openapi") {
  render(<CreateMenu activeTab={tab} toolboxView={toolboxView} />);
  fireEvent.click(screen.getByRole("button", { name: /executionFactory.addCapabilityButton/ }));
  await screen.findByRole("menu");
}
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});
const getComputedStyle = window.getComputedStyle;
beforeEach(() => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getComputedStyle(element));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { state.runtimeConfig.currentUser.permissions = []; });

describe("creation permissions (#670 / #672)", () => {
  it.each([
    ["skill", "skill", ["skill"]],
    ["mcp", "mcp", ["mcp"]],
    ["tool_box", "toolbox", ["api"]],
    ["function", "toolbox", ["function"]],
  ] as const)("filters each menu target for %s:create", async (type, tab, expected) => {
    grant(type, ["create"]);
    await openMenu(tab, type === "function" ? "function" : "openapi");
    for (const [key, label] of Object.entries(labels)) {
      expect(Boolean(screen.queryByText(label))).toBe((expected as readonly string[]).includes(key));
    }
  });

  it("opens only the permitted Skill form", async () => {
    grant("skill", ["create"]);
    await openMenu("skill");
    fireEvent.click(screen.getByText(labels.skill));
    expect(await screen.findByText("Skill form")).toBeTruthy();
    expect(screen.queryByText("MCP form")).toBeNull();
    expect(screen.queryByText("API form")).toBeNull();
  });

  it("opens a permitted cross-tab target", async () => {
    grant("*", ["*"]);
    await openMenu("skill");
    fireEvent.click(screen.getByText(labels.mcp));
    expect(await screen.findByText("MCP form")).toBeTruthy();
  });

  it.each(["tool_box", "function", "*"])("honors %s wildcard grants through the standard permission mapping", async (type) => {
    grant(type, ["*"]);
    await openMenu("toolbox", type === "function" ? "function" : "openapi");
    expect(Boolean(screen.queryByText(labels.api))).toBe(type === "tool_box" || type === "*");
    expect(Boolean(screen.queryByText(labels.function))).toBe(type === "function" || type === "*");
    expect(Boolean(screen.queryByText(labels.skill))).toBe(type === "*");
  });

  it("filters mixed grants", async () => {
    grant("skill", ["create"]);
    state.runtimeConfig.currentUser.permissions.push("execution-factory:mcp:create");
    await openMenu("skill");
    expect(screen.getByText(labels.skill)).toBeTruthy();
    expect(screen.getByText(labels.mcp)).toBeTruthy();
    expect(screen.queryByText(labels.api)).toBeNull();
  });

  it.each([{ operations: [] }, { operations: ["view"] }])("hides creation and rejects auto-open without create ($operations)", ({ operations }) => {
    grant("tool_box", operations);
    const handled = vi.fn();
    render(<CreateMenu activeTab="toolbox" autoOpen onAutoOpenHandled={handled} />);
    expect(screen.queryByRole("button", { name: /executionFactory.addCapabilityButton/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(handled).toHaveBeenCalled();
  });

  it("keeps operator grants separate from function-set creation", () => {
    grant("operator", ["create", "execute"]);
    const { rerender } = render(<CreateMenu activeTab="toolbox" autoOpen />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Function form")).toBeNull();
    rerender(<CreateMenu activeTab="operator" autoOpen />);
    expect(screen.getByText("executionFactory.executionUnitTabs.operator")).toBeTruthy();
    expect(screen.queryByText("executionFactory.executionUnitTabs.skill")).toBeNull();
  });

  it("filters the retained legacy wizard and rejects unauthorized direct opening", () => {
    grant("operator", ["create"]);
    const { rerender } = render(<CreateExecutionUnitWizard open initialTab="skill" onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<CreateExecutionUnitWizard open initialTab="operator" onClose={vi.fn()} />);
    expect(screen.getByText("executionFactory.executionUnitTabs.operator")).toBeTruthy();
    expect(screen.queryByText("executionFactory.executionUnitTabs.toolbox")).toBeNull();
    expect(screen.queryByText("executionFactory.executionUnitTabs.mcp")).toBeNull();
  });

  it("rejects a locked unauthorized initial mode and an empty override", () => {
    grant("skill", ["create"]);
    const { rerender } = render(<AddCapabilityWizard open initialMode="mcp" lockInitialMode onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<AddCapabilityWizard open allowedModesOverride={[]} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters wizard modes and rejects unexpected mode-switch events", () => {
    grant("tool_box", ["create"]);
    render(<AddCapabilityWizard open allowedModesOverride={["quick-api", "import-openapi", "mcp"]} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "mcp" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "unexpected MCP event" }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(screen.getByText("API form")).toBeTruthy();
    expect(screen.queryByText("MCP form")).toBeNull();
  });

  it("allows existing-toolset additions with modify and no create", () => {
    state.runtimeConfig.currentUser.permissions = deriveStudioPermissions(knownPermissions,
      flattenSafeGrants([{ resource: { type: "tool_box", id: "box-1" }, operations: ["modify"] }]), false);
    const { rerender } = render(<AddCapabilityWizard open initialBoxId="box-1" contextTab="toolbox"
      initialMode="quick-api" lockInitialMode onClose={vi.fn()} />);
    expect(screen.getByText("API form")).toBeTruthy();
    rerender(<AddCapabilityWizard open contextTab="toolbox" initialMode="function" lockInitialMode onClose={vi.fn()} />);
    expect(screen.queryByText("Function form")).toBeNull();
  });

  it("removes an open form when its permission is revoked", () => {
    grant("skill", ["create"]);
    const { rerender } = render(<AddCapabilityWizard open initialMode="skill" lockInitialMode onClose={vi.fn()} />);
    expect(screen.getByText("Skill form")).toBeTruthy();
    grant("skill", []);
    rerender(<AddCapabilityWizard open initialMode="skill" lockInitialMode onClose={vi.fn()} />);
    expect(screen.queryByText("Skill form")).toBeNull();
  });
});
