/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { Form } from "antd";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HttpDebugRequestFields } from "@/modules/execution-factory/components/HttpDebugRequestFields";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderFields(ioSpec?: Parameters<typeof HttpDebugRequestFields>[0]["ioSpec"]) {
  return render(
    <Form layout="vertical">
      <HttpDebugRequestFields
        ioSpec={ioSpec}
        method="GET"
        path="/resources/{resourceId}"
        serverUrl="https://api.example.com"
      />
    </Form>,
  );
}

describe("HttpDebugRequestFields", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("offers the request header editor even when the API declares no header parameter", () => {
    renderFields({ parameters: [{ in: "query", name: "limit", type: "integer" }] });

    fireEvent.click(screen.getByText("executionFactory.debugRequestHeaders"));

    expect(screen.getByText("executionFactory.debugHeaderSensitiveHint")).toBeDefined();
    expect(screen.queryByText("executionFactory.debugPathParameters")).toBeNull();
    expect(screen.getByText("executionFactory.debugQueryParameters")).toBeDefined();
  });

  it("keeps the placeholder in the URL preview while the path value is empty", () => {
    render(
      <Form initialValues={{ requestPath: '{"resourceId":""}' }} layout="vertical">
        <HttpDebugRequestFields
          ioSpec={{ parameters: [{ in: "path", name: "resourceId", type: "string" }] }}
          method="GET"
          path="/resources/{resourceId}"
          serverUrl="https://api.example.com"
        />
      </Form>,
    );

    expect(screen.getByText("https://api.example.com/resources/{resourceId}")).toBeDefined();
  });

  it("previews the endpoint URL alongside the declared header parameters", () => {
    renderFields({
      parameters: [{ in: "header", name: "x-tenant-id", required: true, type: "string" }],
    });

    expect(screen.getByText("https://api.example.com/resources/{resourceId}")).toBeDefined();
    expect(
      screen.getByText(
        "x-tenant-id · required: x-tenant-id · executionFactory.debugHeaderSensitiveHint",
      ),
    ).toBeDefined();
  });
});
