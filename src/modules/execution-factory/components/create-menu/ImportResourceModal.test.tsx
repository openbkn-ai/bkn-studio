/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportResourceModal } from "@/modules/execution-factory/components/create-menu/ImportResourceModal";

const spacedTitleSpec = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "示例工具箱 API", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/ping": {
      get: {
        summary: "ping",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const absoluteServerSpec = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "remote_ops", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/ping": {
      get: {
        summary: "ping",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const missingServerSpec = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "no_servers_ops", version: "1.0.0" },
  paths: {
    "/ping": {
      get: {
        summary: "ping",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const relativeServerSpec = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "relative_ops", version: "1.0.0" },
  servers: [{ url: "/api" }],
  paths: {
    "/ping": {
      get: {
        summary: "ping",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

let nextOpenApiSpec = spacedTitleSpec;

const translate = (key: string) => {
  const labels: Record<string, string> = {
    "common.required": "Required",
    "executionFactory.category": "Category",
    "executionFactory.toolboxName": "Toolbox name",
    "executionFactory.serviceUrl": "Service URL",
    "executionFactory.importKindOpenApi": "OpenAPI",
    "executionFactory.importKindAdp": "ADP",
    "executionFactory.importConfirm": "Import",
    "executionFactory.importResourceTitle.toolbox": "Import toolbox",
    "executionFactory.importResourceTitle.operator": "Import operator",
    "executionFactory.importSuccess": "Imported",
    "executionFactory.importOpenApiFileRequired": "OpenAPI required",
    "executionFactory.importOpenApiServiceUrlRequired": "Service URL required",
    "executionFactory.importOpenApiMissingServerManual": "Missing servers",
    "executionFactory.importOpenApiRelativeServerManual": "Relative server",
    "executionFactory.businessIntro.impexOpenApiToolbox": "Intro",
    "executionFactory.businessIntro.impexOpenApiOperator": "Intro",
  };

  return labels[key] ?? key;
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

vi.mock("react-i18next", () => ({
  initReactI18next: {
    init: vi.fn(),
    type: "3rdParty",
  },
  useTranslation: () => ({
    t: translate,
  }),
}));

const { messageError } = vi.hoisted(() => ({
  messageError: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: messageError,
      info: vi.fn(),
      success: vi.fn(),
    },
  }),
}));

vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: vi.fn(() =>
    Promise.resolve([{ categoryType: "other_category", name: "Other" }]),
  ),
}));

const { createToolbox, registerOperator } = vi.hoisted(() => ({
  createToolbox: vi.fn(() => Promise.resolve({ boxId: "box-1" })),
  registerOperator: vi.fn<(input: { openapiSpec?: string }) => Promise<{ operatorId: string }>>(
    () => Promise.resolve({ operatorId: "op-1" }),
  ),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  createToolbox,
}));

vi.mock("@/modules/execution-factory/services/operator.service", () => ({
  registerOperator,
}));

vi.mock("@/modules/execution-factory/services/impex.service", () => ({
  importComponentFile: vi.fn(),
}));

vi.mock("@/modules/execution-factory/components/CapabilityBusinessIntro", () => ({
  CapabilityBusinessIntro: () => null,
}));

vi.mock("@/modules/execution-factory/components/OpenApiSpecInput", () => ({
  OpenApiSpecInput: ({
    onChange,
  }: {
    onChange?: (value: string, source?: { kind: "paste" }) => void;
  }) => (
    <button onClick={() => onChange?.(nextOpenApiSpec, { kind: "paste" })} type="button">
      Load OpenAPI
    </button>
  ),
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");

  return {
    ...actual,
    Modal: ({
      children,
      okText,
      onOk,
      open,
      title,
    }: {
      children?: React.ReactNode;
      okText?: React.ReactNode;
      onOk?: () => void;
      open?: boolean;
      title?: React.ReactNode;
    }) =>
      open ? (
        <div>
          <h1>{title}</h1>
          {children}
          <button onClick={onOk} type="button">
            {okText}
          </button>
        </div>
      ) : null,
  };
});

describe("ImportResourceModal", () => {
  afterEach(() => {
    cleanup();
    nextOpenApiSpec = spacedTitleSpec;
    vi.clearAllMocks();
  });

  it("normalizes OpenAPI title spaces into the toolbox name field", async () => {
    render(<ImportResourceModal activeTab="toolbox" onClose={vi.fn()} open />);

    // Wait for open-effect to finish resetting form state before injecting a spec.
    await screen.findByDisplayValue("http://127.0.0.1:9000");

    fireEvent.click(screen.getByRole("button", { name: "Load OpenAPI" }));

    expect(await screen.findByDisplayValue("示例工具箱_API")).toBeTruthy();
  });

  it("submits a normalized toolbox name when creating from OpenAPI", async () => {
    render(
      <ImportResourceModal activeTab="toolbox" onClose={vi.fn()} onSuccess={vi.fn()} open />,
    );

    await screen.findByDisplayValue("http://127.0.0.1:9000");

    fireEvent.click(screen.getByRole("button", { name: "Load OpenAPI" }));
    await screen.findByDisplayValue("示例工具箱_API");
    await screen.findByDisplayValue("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(createToolbox).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "示例工具箱_API",
        }),
      );
    });
  });

  it("preserves absolute OpenAPI servers when importing an operator", async () => {
    nextOpenApiSpec = absoluteServerSpec;

    render(
      <ImportResourceModal activeTab="operator" onClose={vi.fn()} onSuccess={vi.fn()} open />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Load OpenAPI" }));
    await screen.findByDisplayValue("https://api.example.com");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(registerOperator).toHaveBeenCalled();
    });

    const firstCall = registerOperator.mock.calls[0]?.[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.openapiSpec).toContain('"url": "https://api.example.com"');
    expect(firstCall?.openapiSpec).not.toContain("127.0.0.1:9000");
  });

  it("does not inject localhost when operator OpenAPI has no servers", async () => {
    nextOpenApiSpec = missingServerSpec;

    render(
      <ImportResourceModal activeTab="operator" onClose={vi.fn()} onSuccess={vi.fn()} open />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Load OpenAPI" }));

    await waitFor(() => {
      const serviceUrlInput = screen.getByLabelText("Service URL") as HTMLInputElement;
      expect(serviceUrlInput.value).toBe("");
    });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(registerOperator).not.toHaveBeenCalled();
    });
  });

  it("does not inject localhost when operator OpenAPI has a relative server", async () => {
    nextOpenApiSpec = relativeServerSpec;

    render(
      <ImportResourceModal activeTab="operator" onClose={vi.fn()} onSuccess={vi.fn()} open />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Load OpenAPI" }));

    await waitFor(() => {
      const serviceUrlInput = screen.getByLabelText("Service URL") as HTMLInputElement;
      expect(serviceUrlInput.value).toBe("");
    });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(registerOperator).not.toHaveBeenCalled();
    });
  });

  it("imports an operator with a manually provided Service URL when servers are missing", async () => {
    nextOpenApiSpec = missingServerSpec;

    render(
      <ImportResourceModal activeTab="operator" onClose={vi.fn()} onSuccess={vi.fn()} open />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Load OpenAPI" }));

    const serviceUrlInput = await screen.findByLabelText("Service URL");
    fireEvent.change(serviceUrlInput, { target: { value: "https://prod.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(registerOperator).toHaveBeenCalled();
    });

    const firstCall = registerOperator.mock.calls[0]?.[0];
    expect(firstCall?.openapiSpec).toContain('"url": "https://prod.example.com"');
    expect(firstCall?.openapiSpec).not.toContain("127.0.0.1:9000");
  });
});
