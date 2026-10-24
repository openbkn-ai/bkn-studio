/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnitFormScene } from "./UnitFormScene";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  registerOperator: vi.fn(),
}));
const translate = (key: string) => key;

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: mocks.error, success: mocks.success } }),
}));
vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/modules/execution-factory/services/operator.service", () => ({
  registerOperator: mocks.registerOperator,
  getOperatorDetail: vi.fn(),
  operatorDetailToFormValues: vi.fn(),
  updateOperator: vi.fn(),
}));
vi.mock("@/modules/execution-factory/components/FunctionDefinitionFields", () => ({
  FunctionDefinitionFields: () => null,
}));
vi.mock("@/modules/execution-factory/components/OpenApiDefinitionFields", () => ({
  OpenApiDefinitionFields: () => null,
}));
vi.mock("@/modules/execution-factory/components/OperatorExecuteControlFields", () => ({
  OperatorExecuteControlFields: () => null,
}));
vi.mock("@/modules/execution-factory/components/OperatorDebugPanel", () => ({
  OperatorDebugPanel: () => null,
}));
vi.mock("@/modules/execution-factory/components/OperatorRunLogPanel", () => ({
  OperatorRunLogPanel: () => null,
}));

describe("UnitFormScene submission errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    {
      detail: { field: "title", reason: "{{ literal }}" },
      text: '{"field":"title","reason":"{{ literal }}"}',
    },
    { detail: [{ field: "title" }], text: '[{"field":"title"}]' },
    { detail: 0, text: "0" },
    { detail: false, text: "false" },
    { detail: "Check title", text: "Check title" },
    { detail: null, text: undefined },
  ])("renders detail $detail consistently in the alert and toast", async ({ detail, text }) => {
    mocks.registerOperator.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: { error_code: "Operator.Invalid", description: "Bad input", error_details: detail },
      },
    });
    render(
      <MemoryRouter initialEntries={["/create?metadataType=function"]}>
        <UnitFormScene mode="create" />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("executionFactory.operatorName"), {
      target: { value: "test_operator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(mocks.registerOperator).toHaveBeenCalledOnce();
      expect(mocks.error).toHaveBeenCalledWith(text ? `Bad input（${text}）` : "Bad input");
    });
    const alert = screen.getByText("Bad input").closest('[role="alert"]');
    expect(alert).not.toBeNull();
    if (!alert) throw new Error("Submission error alert is missing");
    if (text !== undefined) {
      expect(within(alert as HTMLElement).getByText(text)).toBeInTheDocument();
    } else {
      expect(alert.querySelector(".ant-alert-description")).toBeNull();
    }
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
