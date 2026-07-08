/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuickAddApiForm } from "@/modules/execution-factory/components/create-menu/QuickAddApiForm";

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
    t: (key: string, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "common.description": "Description",
        "executionFactory.businessIntro.quickApiInputCurl": "Paste cURL.",
        "executionFactory.businessIntro.quickApiInputForm": "Fill the API URL.",
        "executionFactory.businessIntro.quickApiTop": "Add API.",
        "executionFactory.businessIntro.toolMetadataSection": "Tool metadata.",
        "executionFactory.quickApiCurlLabel": "cURL command",
        "executionFactory.quickApiCurlPlaceholder": "curl ...",
        "executionFactory.quickApiIoPreviewTitle": "Endpoint preview",
        "executionFactory.quickApiMethod": "Method",
        "executionFactory.quickApiParsedParams": `Detected ${options?.count} query parameter(s).`,
        "executionFactory.quickApiPath": "Path",
        "executionFactory.quickApiRecognizeAction": "Recognize",
        "executionFactory.quickApiServerUrl": "Service base URL",
        "executionFactory.quickApiSummary": "Tool name",
        "executionFactory.quickApiTabCurl": "Paste cURL",
        "executionFactory.quickApiTabForm": "Simple form",
        "executionFactory.quickApiUrlLabel": "Full API URL",
        "executionFactory.openapiOperationIoSummary": `${options?.paramCount} URL/Header parameters · ${options?.responseCount} responses`,
        "executionFactory.openapiOperationIoSummaryWithBody": `${options?.paramCount} URL/Header parameters · request body ${options?.bodyFieldCount} fields · ${options?.responseCount} responses`,
        "executionFactory.openapiOperationsIoPreviewHint": "Expand to review inputs and responses.",
      };

      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: vi.fn(async () => ({ items: [] })),
}));

describe("QuickAddApiForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("recognizes a full API URL from the form row and previews query parameters", async () => {
    render(<QuickAddApiForm formId="quick-api-form" initialBoxId="box-1" onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Simple form" }));
    fireEvent.change(screen.getByLabelText("Full API URL"), {
      target: {
        value: "http://host.docker.internal:8080/proxy/uapis/weather?city=北京",
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect((screen.getByLabelText("Service base URL") as HTMLInputElement).value).toBe(
      "http://host.docker.internal:8080",
    );

    expect((screen.getByLabelText("Path") as HTMLInputElement).value).toBe("/proxy/uapis/weather");
    expect((screen.getByLabelText("Tool name") as HTMLInputElement).value).toBe("weather");
    expect(screen.getByText("Detected 1 query parameter(s).")).toBeTruthy();
    expect(screen.getByText("city")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recognize" })).toBeTruthy();
  }, 15_000);
});
