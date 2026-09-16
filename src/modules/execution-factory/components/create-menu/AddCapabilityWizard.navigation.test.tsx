/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AddCapabilityWizard } from "./AddCapabilityWizard";

const mocks = vi.hoisted(() => ({
  buildAppPath: vi.fn(() => "#reload-permissions"),
  navigate: vi.fn(),
  refreshCurrentUser: vi.fn(),
  registerQuickApi: vi.fn(),
  registerOpenApiImport: vi.fn(),
  runtimeConfig: { currentUser: { permissions: ["execution-factory:toolbox:create"] } },
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/app/router/app-paths", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/router/app-paths")>()),
  buildAppPath: mocks.buildAppPath,
}));
vi.mock("@/framework/auth/current-user", () => ({ refreshCurrentUser: mocks.refreshCurrentUser }));
vi.mock("@/framework/context/use-app-services", () => ({ useAppServices: () => mocks }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/execution-factory/services/quick-api.service", () => ({
  registerQuickApi: mocks.registerQuickApi,
}));
vi.mock("@/modules/execution-factory/services/import-openapi.service", () => ({
  registerOpenApiImport: mocks.registerOpenApiImport,
}));
vi.mock("./QuickAddApiForm", () => ({
  QuickAddApiForm: ({ onSubmit }: { onSubmit: (payload: {
    openapiSpec: string;
    serviceUrl: string;
    values: { toolboxMode: "new"; toolboxName: string; summary: string; description: string };
  }) => void }) => <button onClick={() => onSubmit({
    openapiSpec: "{}",
    serviceUrl: "https://example.com",
    values: { toolboxMode: "new", toolboxName: "API box", summary: "Tool", description: "" },
  })}>create API</button>,
}));
vi.mock("./ImportOpenApiCapabilityForm", () => ({
  ImportOpenApiCapabilityForm: ({ onSubmit }: { onSubmit: (payload: {
    openapiSpec: string;
    values: { toolboxMode: "new"; toolboxName: string };
  }) => void }) => <button onClick={() => onSubmit({
    openapiSpec: "{}",
    values: { toolboxMode: "new", toolboxName: "API box" },
  })}>import API</button>,
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

const getComputedStyle = window.getComputedStyle;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getComputedStyle(element));
  mocks.runtimeConfig.currentUser.permissions = ["execution-factory:toolbox:create"];
  mocks.registerQuickApi.mockResolvedValue({ boxId: "box-created", toolIds: ["tool-created"] });
  mocks.registerOpenApiImport.mockResolvedValue({
    boxId: "box-created", toolIds: ["tool-created"], successCount: 1, failureCount: 0,
  });
});
afterEach(() => vi.restoreAllMocks());

describe("API creation next-step navigation", () => {
  it.each([
    ["quick-api", "create API", "executionFactory.createdNextStepsViewToolset", "/execution-factory/toolboxes/box-created/tools"],
    ["quick-api", "create API", "executionFactory.createdNextStepsEditTool", "/execution-factory/toolboxes/box-created/tools/tool-created/edit"],
    ["quick-api", "create API", "executionFactory.createdNextStepsDebug", "/execution-factory/toolboxes/box-created/tools/tool-created/edit?focus=debug"],
    ["import-openapi", "import API", "executionFactory.createdNextStepsViewToolset", "/execution-factory/toolboxes/box-created/tools"],
  ] as const)("refreshes grants before the %s next step %s", async (mode, createLabel, nextLabel, destination) => {
    let resolveRefresh!: (user: typeof mocks.runtimeConfig.currentUser) => void;
    mocks.refreshCurrentUser.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    render(<AddCapabilityWizard initialMode={mode} lockInitialMode onClose={vi.fn()} open />);

    fireEvent.click(await screen.findByRole("button", { name: createLabel }));
    fireEvent.click(await screen.findByRole("button", { name: nextLabel }));
    expect(mocks.refreshCurrentUser).toHaveBeenCalledOnce();
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      resolveRefresh({ permissions: ["execution-factory:toolbox:view", "execution-factory:tool:view"] });
      await Promise.resolve();
    });
    expect(mocks.runtimeConfig.currentUser.permissions).toContain("execution-factory:toolbox:view");
    expect(mocks.navigate).toHaveBeenCalledWith(destination);
  });

  it("reloads the API target if owner permissions cannot be refreshed", async () => {
    mocks.refreshCurrentUser.mockRejectedValue(new Error("temporary failure"));
    render(<AddCapabilityWizard initialMode="quick-api" lockInitialMode onClose={vi.fn()} open />);

    fireEvent.click(await screen.findByRole("button", { name: "create API" }));
    fireEvent.click(await screen.findByRole("button", { name: "executionFactory.createdNextStepsViewToolset" }));

    await waitFor(() => expect(mocks.buildAppPath).toHaveBeenCalledWith(
      "/execution-factory/toolboxes/box-created/tools",
    ));
    expect(window.location.hash).toBe("#reload-permissions");
    expect(mocks.navigate).not.toHaveBeenCalled();
    window.location.hash = "";
  });
});
