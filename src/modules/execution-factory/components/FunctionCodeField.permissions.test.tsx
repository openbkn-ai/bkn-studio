/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FunctionCodeField } from "@/modules/execution-factory/components/FunctionCodeField";

const mocks = vi.hoisted(() => ({
  getResourceOperations: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    runtimeConfig: { currentUser: { permissions: mocks.permissions } },
  }),
}));

vi.mock("@/modules/model-resources/services/authorization.service", () => ({
  getResourceOperations: mocks.getResourceOperations,
}));

vi.mock("@/modules/execution-factory/services/template.service", () => ({
  getPythonCodeTemplate: vi.fn().mockResolvedValue("def handler(event):\n    return event\n"),
}));

vi.mock("@/modules/execution-factory/components/CodeEditor", () => ({
  CodeEditor: ({ value }: { value?: string }) => <textarea readOnly value={value ?? ""} />,
}));

vi.mock("@/modules/execution-factory/components/FunctionAiGenerateModal", () => ({
  FunctionAiGenerateModal: () => null,
}));

vi.mock("@/modules/execution-factory/components/FunctionExecuteModal", () => ({
  FunctionExecuteModal: () => null,
}));

const CODE = "def handler(event):\n    return event\n";

describe("FunctionCodeField permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResourceOperations.mockResolvedValue([{ id: "adhoc", operation: ["execute"] }]);
  });

  afterEach(cleanup);

  it("hides Function generation and runs in the legacy operator form for operator-only users", async () => {
    mocks.permissions.splice(
      0,
      mocks.permissions.length,
      "execution-factory:operator:create",
      "execution-factory:operator:edit",
      "execution-factory:operator:debug",
    );

    render(<FunctionCodeField onChange={vi.fn()} value={CODE} />);

    expect(await screen.findByText("executionFactory.functionInsertTemplate")).toBeTruthy();
    expect(screen.queryByText("executionFactory.functionAiGenerate")).toBeNull();
    expect(screen.queryByText("executionFactory.runFunction")).toBeNull();
    expect(mocks.getResourceOperations).not.toHaveBeenCalled();
  });

  it("offers generation with Function create and runs with the ad-hoc execute grant", async () => {
    mocks.permissions.splice(
      0,
      mocks.permissions.length,
      "execution-factory:function:create",
      "execution-factory:function:debug",
    );

    render(<FunctionCodeField onChange={vi.fn()} value={CODE} />);

    expect(await screen.findByText("executionFactory.runFunction")).toBeTruthy();
    expect(screen.getByText("executionFactory.functionAiGenerate")).toBeTruthy();
    expect(mocks.getResourceOperations).toHaveBeenCalledWith([{ type: "function", id: "adhoc" }]);
  });

  it("does not offer runs when Function execute does not cover the ad-hoc resource", async () => {
    mocks.permissions.splice(0, mocks.permissions.length, "execution-factory:function:debug");
    mocks.getResourceOperations.mockResolvedValue([{ id: "adhoc", operation: [] }]);

    render(<FunctionCodeField onChange={vi.fn()} value={CODE} />);

    await waitFor(() => expect(mocks.getResourceOperations).toHaveBeenCalled());
    expect(screen.queryByText("executionFactory.runFunction")).toBeNull();
    expect(screen.queryByText("executionFactory.functionAiGenerate")).toBeNull();
  });
});
