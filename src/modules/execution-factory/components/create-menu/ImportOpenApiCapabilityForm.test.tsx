/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportOpenApiCapabilityForm } from "@/modules/execution-factory/components/create-menu/ImportOpenApiCapabilityForm";

/* eslint-disable @typescript-eslint/restrict-template-expressions */

const petstoreSpec = JSON.stringify({
  openapi: "3.0.4",
  info: { title: "Swagger Petstore", version: "1.0.0" },
  servers: [{ url: "/api/v3" }],
  paths: {
    "/pet": {
      put: {
        summary: "Update a pet",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const translate = (key: string, options?: Record<string, unknown>) => {
  const labels: Record<string, string> = {
    "common.description": "Description",
    "common.required": "Required",
    "executionFactory.businessIntro.importOpenApiTop": "Import OpenAPI.",
    "executionFactory.businessIntro.toolboxPlacementSection": "Toolbox placement.",
    "executionFactory.importOpenApiCapabilityPreview": `OpenAPI ${options?.version} with ${options?.count} endpoint(s)`,
    "executionFactory.importOpenApiRelativeServerResolved": `Detected relative OpenAPI server ${options?.relativeUrl} and resolved it to ${options?.serviceUrl}.`,
    "executionFactory.importOpenApiRelativeServerManual": `Relative server ${options?.relativeUrl}`,
    "executionFactory.importOpenApiMissingServerManual": "Document has no servers; use Service URL.",
    "executionFactory.importOpenApiServiceUrlRequired": "Service URL required",
    "executionFactory.quickApiToolboxExisting": "Existing toolset",
    "executionFactory.quickApiToolboxNew": "New toolset",
    "executionFactory.quickApiToolboxTarget": "Add to toolset",
    "executionFactory.serviceUrl": "Service URL",
    "executionFactory.toolboxName": "Toolbox name",
    "executionFactory.useRule": "Use rule",
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

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: vi.fn(() => Promise.resolve({ items: [] })),
}));

vi.mock("@/modules/execution-factory/components/CapabilityBusinessIntro", () => ({
  CapabilityBusinessIntro: ({ messageKey }: { messageKey: string }) => <p>{messageKey}</p>,
  ToolboxPlacementIntro: () => null,
}));

vi.mock("@/modules/execution-factory/components/CapabilityCategoryFields", () => ({
  CapabilityCategoryFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/OperatorSyncPublishFields", () => ({
  OperatorSyncPublishFields: () => null,
}));

vi.mock("@/modules/execution-factory/components/OpenApiSpecInput", () => ({
  OpenApiSpecInput: ({
    onChange,
  }: {
    onChange?: (value: string, source?: { kind: "url"; url: string }) => void;
  }) => (
    <button
      onClick={() =>
        onChange?.(petstoreSpec, {
          kind: "url",
          url: "https://petstore3.swagger.io/api/v3/openapi.json",
        })
      }
      type="button"
    >
      Load Petstore OpenAPI
    </button>
  ),
}));

describe("ImportOpenApiCapabilityForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("resolves a relative server URL from the fetched OpenAPI document URL", async () => {
    render(<ImportOpenApiCapabilityForm formId="import-openapi" onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Load Petstore OpenAPI" }));

    expect(await screen.findByDisplayValue("https://petstore3.swagger.io/api/v3")).toBeTruthy();
    expect(screen.getByDisplayValue("Swagger_Petstore")).toBeTruthy();
    expect(
      screen.getByText(
        "Detected relative OpenAPI server /api/v3 and resolved it to https://petstore3.swagger.io/api/v3.",
      ),
    ).toBeTruthy();
  });

  it("keeps a manually edited service URL after OpenAPI autofill", async () => {
    render(<ImportOpenApiCapabilityForm formId="import-openapi" onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Load Petstore OpenAPI" }));

    const serviceUrlInput = await screen.findByDisplayValue("https://petstore3.swagger.io/api/v3");
    fireEvent.change(serviceUrlInput, {
      target: { value: "https://custom.example.com/api" },
    });

    fireEvent.change(screen.getByLabelText("Use rule"), {
      target: { value: "prefer custom service url" },
    });

    expect(screen.getByDisplayValue("https://custom.example.com/api")).toBeTruthy();
    expect(screen.queryByDisplayValue("https://petstore3.swagger.io/api/v3")).toBeNull();
  });
});
