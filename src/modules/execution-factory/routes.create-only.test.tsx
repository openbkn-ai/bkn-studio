/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useRoutes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { executionFactoryRoutes } from "@/modules/execution-factory/routes";

const services = vi.hoisted(() => ({
  message: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
  runtimeConfig: { currentUser: { permissions: [] as string[] } },
  refreshCurrentUser: vi.fn(),
}));

vi.mock("@/framework/auth/current-user", () => ({
  refreshCurrentUser: services.refreshCurrentUser,
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => services,
}));
vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => services.runtimeConfig,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/execution-factory/components/create-menu/AddCapabilityWizard", () => ({
  AddCapabilityWizard: ({ initialMode, onCreated, open }: {
    initialMode?: "mcp" | "skill";
    onCreated?: (payload: { tab: "mcp" | "skill"; id: string }) => void;
    open: boolean;
  }) => open ? (
    <>
      <output data-testid="create-wizard">{initialMode}</output>
      <button onClick={() => initialMode && onCreated?.({ tab: initialMode, id: "new-id" })} type="button">
        complete
      </button>
    </>
  ) : null,
}));
vi.mock("@/modules/execution-factory/components/create-menu/CreateExecutionUnitWizard", () => ({
  CreateExecutionUnitWizard: () => null,
}));
vi.mock("@/modules/execution-factory/components/create-menu/ImportResourceModal", () => ({
  ImportResourceModal: () => null,
}));
vi.mock("@/modules/execution-factory/pages/McpDetailPage", () => ({
  McpDetailPage: () => <output>mcp detail</output>,
}));
vi.mock("@/modules/execution-factory/pages/SkillDetailPage", () => ({
  SkillDetailPage: () => <output>skill detail</output>,
}));

function CreateRoute() {
  const location = useLocation();
  const route = useRoutes(executionFactoryRoutes.filter((item) => [
    "execution-factory/mcp/new",
    "execution-factory/skills/new",
    "execution-factory/mcp/:mcpId",
    "execution-factory/skills/:skillId",
  ].includes(item.path ?? "")));
  return <>{route}<output data-testid="current-path">{location.pathname}</output></>;
}

describe("execution factory create-only routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.runtimeConfig.currentUser.permissions = [];
    services.refreshCurrentUser.mockImplementation(() => Promise.resolve({
      permissions: ["execution-factory:mcp:view", "execution-factory:skill:view"],
    }));
  });

  it.each([
    ["mcp", "/execution-factory/mcp/new", "execution-factory:mcp:create"],
    ["skill", "/execution-factory/skills/new", "execution-factory:skill:create"],
  ])("opens the %s form with only its create grant", async (kind, path, grant) => {
    services.runtimeConfig.currentUser.permissions = [grant];
    await import("@/modules/execution-factory/pages/ExecutionUnitCreatePage");

    render(<MemoryRouter initialEntries={[path]}><CreateRoute /></MemoryRouter>);

    expect((await screen.findByTestId("create-wizard", {}, { timeout: 5000 })).textContent).toBe(kind);
    expect(screen.queryByText("common.noPermission")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "complete" }));
    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe(
      `/execution-factory/${kind === "mcp" ? "mcp" : "skills"}/new-id`,
    ));
    expect(await screen.findByText(`${kind} detail`)).toBeTruthy();
    expect(services.refreshCurrentUser).toHaveBeenCalledOnce();
    expect(services.runtimeConfig.currentUser.permissions).toContain(`execution-factory:${kind}:view`);
  });
});
