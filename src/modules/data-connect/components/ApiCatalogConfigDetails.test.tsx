/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { ApiCatalogConfigDetails } from "./ApiCatalogConfigDetails";
import { findMockCatalog } from "@/shared/catalog/catalog-mock";
import { validateApiLoginDefinition } from "@/shared/api-definition";
import { validateApiCatalogConfig } from "../lib/api-catalog-config";
import { getConnectorOptionDefinitions } from "../lib/connector-options";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("API Catalog configuration details", () => {
  it("renders the complete demo fixture with all supported options and grouped login tables", () => {
    const config = findMockCatalog("cat-api-demo")!.connectorConfig;
    expect(validateApiCatalogConfig(config)).toBeUndefined();
    expect(validateApiLoginDefinition(config.login_request)).toBeUndefined();
    expect(Object.keys(config.options as Record<string, unknown>).sort()).toEqual(
      getConnectorOptionDefinitions("http")!
        .map(({ key }) => key)
        .sort(),
    );
    render(<ApiCatalogConfigDetails config={config} />);
    const variables = screen.getByRole("table", { name: "dataConnect.apiCatalog.variables" });
    for (const name of [
      "tenant",
      "password",
      "api_key",
      "locale",
      "attempts",
      "remember",
      "scopes",
      "client_context",
      "empty_note",
      "extra_context",
    ])
      expect(within(variables).getByRole("rowheader", { name })).toBeVisible();
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.loginConfigured"));
    const request = screen.getByRole("table", { name: "dataConnect.apiEditor.request" });
    const response = screen.getByRole("table", { name: "dataConnect.apiEditor.response" });
    const success = screen.getByRole("table", { name: "dataConnect.apiEditor.success" });
    const parameters = screen.getByRole("table", { name: "dataConnect.apiEditor.parameters" });
    expect(within(parameters).getAllByRole("columnheader")).toHaveLength(4);
    const tenant = within(parameters).getByRole("rowheader", { name: "tenant" }).closest("tr")!;
    expect(within(tenant).getByText("{{ tenant }}")).toBeVisible();
    expect(within(tenant).getByText("demo")).toBeVisible();
    expect(within(tenant).getByText("dataConnect.apiEditor.true")).toBeVisible();
    for (const table of [request, response, success]) {
      expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
      expect(table.querySelector("dl")).toBeNull();
    }
    expect(within(request).getByText("auth/login")).toBeVisible();
    expect(within(request).getByText("Bearer {{ api_key }}")).toBeVisible();
    const body = screen.getByRole("table", { name: "dataConnect.apiEditor.body" });
    expect(within(body).getAllByRole("columnheader")).toHaveLength(5);
    expect(
      within(body).getByRole("rowheader", { name: "client.name" }).closest("tr"),
    ).toHaveTextContent("{{ client_name }}");
    expect(
      within(body).getByRole("rowheader", { name: "client.scopes[0]" }).closest("tr"),
    ).toHaveTextContent("catalog:read");
    const statuses = screen.getByRole("tablist", { name: "dataConnect.apiEditor.responseStatus" });
    expect(
      within(statuses)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["200", "401", "default"]);
    const first = screen.getByRole("table", {
      name: "oneOf · dataConnect.apiEditor.fieldTable.branch 1",
    });
    expect(within(first).getAllByRole("columnheader")).toHaveLength(5);
    expect(within(first).getByRole("rowheader", { name: "data.user_id" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "oneOf · dataConnect.apiEditor.fieldTable.branch 2" }),
    ).toHaveTextContent("error");
    expect(within(success).getByRole("rowheader", { name: "http_status[0]" })).toBeVisible();
    expect(screen.getByText("timeout_seconds:")).toBeVisible();
    expect(screen.getByText("max_response_mib:")).toBeVisible();
    expect(document.body.innerHTML).not.toContain("demo-only-password-not-valid");
    expect(document.body.innerHTML).not.toContain("demo-only-api-key-not-valid");
  });
  it("switches login status tabs independently and keeps both request and response field trees read-only", () => {
    const config = findMockCatalog("cat-api-demo")!.connectorConfig;
    const before = transformPrecisionSafeJSONRequest(config);
    const { container } = render(<ApiCatalogConfigDetails config={config} />);
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.loginConfigured"));
    const body = screen.getByRole("table", { name: "dataConnect.apiEditor.body" });
    const client = within(body).getByRole("button", { name: "client" });
    fireEvent.click(client);
    expect(client).toHaveAttribute("aria-expanded", "false");
    expect(within(body).queryByRole("rowheader", { name: "client.name" })).toBeNull();
    fireEvent.click(client);
    expect(within(body).getByRole("rowheader", { name: "client.name" })).toBeVisible();
    const statuses = screen.getByRole("tablist", { name: "dataConnect.apiEditor.responseStatus" });
    expect(within(statuses).getByRole("tab", { name: "200" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(within(statuses).getByRole("tab", { name: "401" }));
    const rejected = screen.getByRole("table", { name: "401 dataConnect.apiEditor.response" });
    expect(within(rejected).getByRole("rowheader", { name: "error" })).toBeVisible();
    expect(
      screen.queryByRole("table", { name: "oneOf · dataConnect.apiEditor.fieldTable.branch 1" }),
    ).toBeNull();
    expect(body).toBeVisible();
    fireEvent.click(within(statuses).getByRole("tab", { name: "default" }));
    expect(screen.getByRole("tabpanel", { name: "default" })).toHaveTextContent(
      "dataConnect.apiEditor.acceptNone",
    );
    expect(
      screen.queryByRole("table", { name: "default dataConnect.apiEditor.response" }),
    ).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(transformPrecisionSafeJSONRequest(config)).toBe(before);
  });

  it("shows service settings, limits and a semantic variable table instead of a configuration JSON block", () => {
    render(
      <ApiCatalogConfigDetails
        config={{
          base_url: "https://api.example.com/v1/",
          options: { timeout_seconds: 30, max_response_mib: 10 },
          variables: { tenant: { value: "demo", sensitive: false } },
        }}
      />,
    );
    expect(screen.getByText("https://api.example.com/v1/")).toBeVisible();
    expect(screen.getByText("timeout_seconds:")).toBeVisible();
    expect(screen.getByText("30")).toBeVisible();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(
      within(table).getByRole("columnheader", {
        name: "dataConnect.apiEditor.variablesTable.sensitive",
      }),
    ).toBeVisible();
    expect(within(table).getByRole("rowheader", { name: "tenant" })).toBeVisible();
    expect(within(table).getByText("demo")).toBeVisible();
    expect(screen.getByText("dataConnect.apiCatalog.details.noLogin")).toBeVisible();
    expect(document.querySelector("pre")).toBeNull();
  });

  it("preserves precise numbers, numeric strings and explicit empty/false values without mutating configuration", () => {
    const config = parsePrecisionPreservingJSON(
      '{"variables":{"amount":{"value":1234567890.123456789},"id":{"value":9007199254740993},"text":{"value":"9007199254740993"},"enabled":{"value":false},"empty":{"value":""},"items":{"value":[]}}}',
    ) as Record<string, unknown>;
    const before = transformPrecisionSafeJSONRequest(config);
    render(<ApiCatalogConfigDetails config={config} />);
    expect(screen.getByText("1234567890.123456789")).toBeVisible();
    const numericRow = screen.getByRole("rowheader", { name: "id" }).closest("tr")!;
    const textRow = screen.getByRole("rowheader", { name: "text" }).closest("tr")!;
    expect(within(numericRow).getByText("dataConnect.apiEditor.types.number")).toBeVisible();
    expect(within(textRow).getByText("dataConnect.apiEditor.types.string")).toBeVisible();
    expect(screen.getAllByText("9007199254740993")).toHaveLength(2);
    const enabled = screen.getByRole("rowheader", { name: "enabled" }).closest("tr")!;
    expect(within(enabled).getByText("dataConnect.apiEditor.false")).toBeVisible();
    expect(within(enabled).getByText("false")).toBeVisible();
    expect(screen.getByText("dataConnect.apiEditor.variablesTable.emptyString")).toBeVisible();
    expect(screen.getByText("dataConnect.apiEditor.variablesTable.emptyArray")).toBeVisible();
    expect(transformPrecisionSafeJSONRequest(config)).toBe(before);
  });

  it("masks credentials before rendering while preserving symbolic login templates", () => {
    render(
      <ApiCatalogConfigDetails
        config={{
          base_url: "https://api.example.com/",
          variables: {
            secret: { value: "sample-private-value", sensitive: true },
            stored: { sensitive: true },
            public: { value: "ordinary-variable", sensitive: false },
            metadata: { value: { authorization: "ordinary-property" }, sensitive: false },
            malformed: { value: "legacy-unmarked-value", extra: true },
            legacy: "legacy-string-value",
          },
          login_request: {
            request: {
              method: "POST",
              path: "auth/login",
              headers: {
                Authorization: "sample-auth-value",
                Cookie: "sample-cookie-value",
                "Proxy-Authorization": "Bearer {{ secret }}",
                "Set-Cookie": "session=sample-mixed-value; tenant={{ public }}",
                "X-Trace": "prefix sample-private-value suffix",
                "X-Tenant": "{{ public }}",
              },
              body: { type: "string", value: "sample-private-value" },
            },
            response: { statuses: { 200: { schema: { type: "object" } } } },
            success_rule: { http_status: [200] },
          },
        }}
      />,
    );
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.loginConfigured"));
    expect(screen.getByText("auth/login")).toBeVisible();
    const variableTable = screen.getByRole("table", { name: "dataConnect.apiCatalog.variables" });
    expect(variableTable).not.toHaveTextContent("sample-private-value");
    expect(within(variableTable).getByRole("rowheader", { name: "malformed" })).toBeVisible();
    expect(within(variableTable).getByRole("rowheader", { name: "legacy" })).toBeVisible();
    expect(within(variableTable).getByText("ordinary-variable")).toBeVisible();
    fireEvent.click(within(variableTable).getByRole("button", { name: /metadata/ }));
    expect(within(variableTable).getByText("ordinary-property")).toBeVisible();
    const request = screen.getByRole("table", { name: "dataConnect.apiEditor.request" });
    expect(within(request).getByText("Bearer {{ secret }}")).toBeVisible();
    expect(within(request).getByText("{{ public }}")).toBeVisible();
    expect(within(request).getByText("prefix •••••••• suffix")).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "dataConnect.apiEditor.body" })).getByText(
        "••••••••",
      ),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(
      /sample-(auth|cookie|mixed|private)-value|legacy-(unmarked|string)-value/,
    );
    expect(screen.getAllByLabelText("dataConnect.apiEditor.variablesTable.protected")).toHaveLength(
      2,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("preserves exact schema values, empty containers and future fields in login tables", () => {
    const config = parsePrecisionPreservingJSON(
      '{"login_request":{"request":{"headers":{},"parameters":[],"body":{"value":9007199254740993.000000001,"enabled":false,"note":""}},"future":{"value":null}}}',
    ) as Record<string, unknown>;
    const before = transformPrecisionSafeJSONRequest(config);
    render(<ApiCatalogConfigDetails config={config} />);
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.loginConfigured"));
    const request = screen.getByRole("table", { name: "dataConnect.apiEditor.request" });
    const body = screen.getByRole("table", { name: "dataConnect.apiEditor.body" });
    expect(within(body).getByText("9007199254740993.000000001")).toBeVisible();
    fireEvent.click(within(body).getByText(/dataConnect.apiEditor.fieldTable.configuration/));
    expect(within(body).getByText("false")).toBeVisible();
    expect(within(body).getByText("dataConnect.apiCatalog.details.emptyString")).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "dataConnect.apiEditor.parameters" })).getByText(
        "dataConnect.apiCatalog.details.emptyArray",
      ),
    ).toBeVisible();
    expect(within(request).getByText("dataConnect.apiCatalog.details.emptyObject")).toBeVisible();
    expect(within(screen.getByRole("table", { name: "future" })).getByText("null")).toBeVisible();
    expect(transformPrecisionSafeJSONRequest(config)).toBe(before);
  });

  it("shows one row per Query parameter with exact values, defaults, required flags and additional metadata", () => {
    const config = parsePrecisionPreservingJSON(
      '{"login_request":{"request":{"parameters":[{"name":"limit","value":0,"default_value":9007199254740993.000000001,"required":false},{"name":"note","value":"","default_value":false,"required":true,"description":"Future metadata"},{"name":"optional"}]}}}',
    ) as Record<string, unknown>;
    const before = transformPrecisionSafeJSONRequest(config);
    render(<ApiCatalogConfigDetails config={config} />);
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.loginConfigured"));
    const table = screen.getByRole("table", { name: "dataConnect.apiEditor.parameters" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    const limit = within(table).getByRole("rowheader", { name: "limit" }).closest("tr")!;
    expect(within(limit).getAllByRole("cell")).toHaveLength(3);
    expect(within(limit).getByText("0")).toBeVisible();
    expect(within(limit).getByText("9007199254740993.000000001")).toBeVisible();
    expect(within(limit).getByText("dataConnect.apiEditor.false")).toBeVisible();
    const note = within(table).getByRole("rowheader", { name: "note" }).closest("tr")!;
    expect(within(note).getByText("dataConnect.apiCatalog.details.emptyString")).toBeVisible();
    expect(within(note).getByText("dataConnect.apiEditor.false")).toBeVisible();
    expect(within(note).getByText("dataConnect.apiEditor.true")).toBeVisible();
    fireEvent.click(within(note).getByText("dataConnect.apiCatalog.details.additional"));
    expect(within(note).getByText("Future metadata")).toBeVisible();
    const optional = within(table).getByRole("rowheader", { name: "optional" }).closest("tr")!;
    expect(within(optional).getAllByText("—")).toHaveLength(3);
    expect(transformPrecisionSafeJSONRequest(config)).toBe(before);
  });

  it("shows an empty state and preserves additional non-secret metadata", () => {
    const view = render(<ApiCatalogConfigDetails config={{}} />);
    expect(screen.getByText("dataConnect.noConnectorConfig")).toBeVisible();
    view.rerender(
      <ApiCatalogConfigDetails
        config={{ base_url: "https://api.example.com/", future_setting: { enabled: true } }}
      />,
    );
    fireEvent.click(screen.getByText("dataConnect.apiCatalog.details.additional"));
    expect(screen.getByText("future_setting")).toBeVisible();
    expect(screen.getByText("dataConnect.apiEditor.true")).toBeVisible();
    expect(screen.getByText("dataConnect.apiCatalog.details.defaultLimits")).toBeVisible();
  });
});
