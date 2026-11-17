/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BigNumber from "bignumber.js";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiCatalogConfigEditor } from "./ApiCatalogConfigEditor";
import { createApiLoginDefinition } from "@/shared/api-definition";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderEditor(initial: Record<string, unknown>, isEdit = false, disabled = false) {
  const changed = vi.fn<(value: Record<string, unknown>) => void>();
  const validity = vi.fn<(valid: boolean) => void>();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <ApiCatalogConfigEditor
        value={value}
        isEdit={isEdit}
        disabled={disabled}
        onChange={(next) => {
          changed(next);
          setValue(next);
        }}
        onValidityChange={validity}
      />
    );
  }
  render(<Harness />);
  return {
    changed,
    validity,
    latest: () => changed.mock.lastCall?.[0] ?? initial,
  };
}

function openVariables() {
  fireEvent.click(screen.getByRole("tab", { name: "dataConnect.apiCatalog.variables" }));
}

async function addLimit(key: "timeout_seconds" | "max_response_mib") {
  const summary = screen.getByText("dataConnect.optionEditor.title", { selector: "summary" });
  const details = summary.closest("details")!;
  if (!details.open) fireEvent.click(summary);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataConnect.optionEditor.add" }));
  const label = key === "timeout_seconds" ? "httpTimeout" : "httpResponseLimit";
  fireEvent.click(
    await screen.findByText(`dataConnect.optionEditor.labels.${label} (${key})`, {
      selector: ".ant-select-item-option-content",
    }),
  );
}

describe("ApiCatalogConfigEditor", () => {
  it.each([
    { "200": { description: "Legacy", content: { "application/json": { schema: {} } } } },
    { "200": { description: "Previous", content_type: "application/json", schema: {} } },
    {
      content_type: "application/json",
      statuses: { "200": { description: "Mixed", schema: {}, content: null } },
    },
    {
      content_type: "application/json",
      statuses: { "200": { description: "Mixed", schema: {}, content_type: null } },
    },
    { content_type: "text/plain", statuses: { "200": { description: "Unsupported", schema: {} } } },
    {
      content_type: "application/json",
      statuses: { "200": { description: "Unsupported", schema: {} } },
      headers: {},
    },
  ])("protects unsupported or legacy response configuration from editing: %j", async (response) => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      login_request: { response },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("dataConnect.apiCatalog.readonly");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(editor.changed).not.toHaveBeenCalled();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));
  });

  it("groups service settings into connection and advanced cards with optional parameters", () => {
    const editor = renderEditor({ base_url: "https://api.example.com/" });
    const connection = screen.getByRole("group", {
      name: "dataConnect.connectorTemplates.fieldGroups.connection",
    });
    const advanced = screen.getByRole("group", {
      name: "dataConnect.connectorTemplates.fieldGroups.advanced",
    });
    const serviceAddress = within(connection).getByLabelText("dataConnect.apiCatalog.baseUrl");
    expect(serviceAddress).toBeVisible();
    expect(serviceAddress).toBeRequired();
    expect(within(connection).getByText("*")).toHaveAttribute("aria-hidden", "true");
    expect(connection).not.toContainElement(advanced);
    expect(
      within(advanced).getByText("dataConnect.optionEditor.title").closest("details"),
    ).not.toHaveAttribute("open");
    expect(
      screen.queryByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
      }),
    ).toBeNull();
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("loads saved limits expanded and removes an invalid limit without changing the other limit", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      options: { timeout_seconds: 45, max_response_mib: 12 },
    });
    const advanced = screen.getByRole("group", {
      name: "dataConnect.connectorTemplates.fieldGroups.advanced",
    });
    expect(advanced.querySelector("details")).toHaveAttribute("open");
    const timeout = screen.getByRole("textbox", {
      name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
    });
    fireEvent.change(timeout, { target: { value: "-" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(
      within(timeout.closest('[class*="optionRow"]') as HTMLElement).getByRole("button", {
        name: "dataConnect.optionEditor.remove",
      }),
    );
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest().options).toEqual({ max_response_mib: 12 });
    expect(
      screen.queryByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpResponseLimit (max_response_mib)",
      }),
    ).toHaveValue("12");
    await addLimit("timeout_seconds");
    expect(
      screen.getByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
      }),
    ).toHaveValue("");
    expect(editor.latest().options).toEqual({ max_response_mib: 12 });
  });

  it("describes sensitive storage on focus and hover, supports Escape, and preserves the checkbox action", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: { secret: { value: "synthetic-input", sensitive: false } },
    });
    openVariables();
    const checkbox = screen.getByRole("checkbox", { name: "dataConnect.apiCatalog.sensitive" });
    fireEvent.focus(checkbox);
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("dataConnect.apiCatalog.sensitiveHint");
    expect(checkbox).toHaveAttribute("aria-describedby", tip.id);
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.keyDown(checkbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    fireEvent.blur(checkbox);
    fireEvent.mouseEnter(checkbox.closest("label")!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "dataConnect.apiCatalog.sensitiveHint",
    );
    fireEvent.click(checkbox);
    expect(editor.latest()).toMatchObject({
      variables: { secret: { value: "synthetic-input", sensitive: true } },
    });
  });

  it.each([
    ["string", "123"],
    ["number", 123],
    ["boolean", false],
    ["object", { value: "business", sensitive: true }],
    ["array", [null, false, 0]],
  ])(
    "restores JSON type %s from the saved variable value when reopening an editor",
    (type, value) => {
      const saved = parsePrecisionPreservingJSON(
        transformPrecisionSafeJSONRequest({
          base_url: "https://api.example.com/",
          variables: { field: { value, sensitive: false } },
        }),
      ) as Record<string, unknown>;
      const editor = renderEditor(saved, true);
      openVariables();
      const control = screen.getByRole("combobox", {
        name: "dataConnect.apiCatalog.variableValue field dataConnect.apiEditor.valueType",
      });
      expect(control.closest(".ant-select")).toHaveTextContent(
        `dataConnect.apiEditor.types.${type}`,
      );
      expect(editor.changed).not.toHaveBeenCalled();
      expect(editor.latest()).not.toHaveProperty("sensitive_variables");
    },
  );

  it("offers five root variable types while preserving the nested null type", async () => {
    renderEditor({
      base_url: "https://api.example.com/",
      variables: { field: { value: { nested: null }, sensitive: false } },
    });
    openVariables();
    const label = "dataConnect.apiCatalog.variableValue field dataConnect.apiEditor.valueType";
    fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
    await screen.findByText("dataConnect.apiEditor.types.string", {
      selector: ".ant-select-item-option-content",
    });
    expect(
      screen.queryByText("dataConnect.apiEditor.types.null", {
        selector: ".ant-select-item-option-content",
      }),
    ).toBeNull();
    fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Escape" });
    const nested = screen.getByRole("combobox", {
      name: "dataConnect.apiCatalog.variableValue field.nested dataConnect.apiEditor.valueType",
    });
    expect(nested.closest(".ant-select")).toHaveTextContent("dataConnect.apiEditor.types.null");
  });

  it("restores a changed numeric variable after its save and edit round trip", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: { amount: { value: "123", sensitive: false } },
    });
    openVariables();
    const label = "dataConnect.apiCatalog.variableValue amount dataConnect.apiEditor.valueType";
    fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
    fireEvent.click(
      await screen.findByText("dataConnect.apiEditor.types.number", {
        selector: ".ant-select-item-option-content",
      }),
    );
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.variableValue amount"), {
      target: { value: "9007199254740993.123456789" },
    });
    const stored = parsePrecisionPreservingJSON(
      transformPrecisionSafeJSONRequest(editor.latest()),
    ) as Record<string, unknown>;
    cleanup();
    const reopened = renderEditor(stored, true);
    openVariables();
    expect(screen.getByRole("combobox", { name: label }).closest(".ant-select")).toHaveTextContent(
      "dataConnect.apiEditor.types.number",
    );
    expect(screen.getByLabelText("dataConnect.apiCatalog.variableValue amount")).toHaveValue(
      "9007199254740993.123456789",
    );
    expect(reopened.changed).not.toHaveBeenCalled();
  });

  it("changes a variable type from the card header and locks it to a masked string when sensitive", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: { amount: { value: "sample", sensitive: false } },
    });
    openVariables();
    const label = "dataConnect.apiCatalog.variableValue amount dataConnect.apiEditor.valueType";
    fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
    fireEvent.click(
      await screen.findByText("dataConnect.apiEditor.types.number", {
        selector: ".ant-select-item-option-content",
      }),
    );
    expect(editor.latest().variables).toEqual({ amount: { value: 0, sensitive: false } });
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.variableValue amount"), {
      target: { value: "9007199254740993" },
    });
    expect(transformPrecisionSafeJSONRequest(editor.latest().variables)).toBe(
      '{"amount":{"value":9007199254740993,"sensitive":false}}',
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "dataConnect.apiCatalog.sensitive" }));
    expect(screen.getByRole("combobox", { name: label })).toBeDisabled();
    expect(screen.getByLabelText("dataConnect.apiCatalog.sensitiveValue amount")).toHaveAttribute(
      "type",
      "password",
    );
    expect(editor.latest()).toMatchObject({
      variables: { amount: { value: "", sensitive: true } },
    });
    expect(screen.queryByText("dataConnect.apiCatalog.storedValue")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "dataConnect.apiCatalog.sensitive" }));
    expect(screen.getByRole("combobox", { name: label })).toBeEnabled();
    expect(editor.latest()).toMatchObject({
      variables: { amount: { value: "", sensitive: false } },
    });
  });

  it("does not label newly added credentials as saved while editing an existing Catalog", () => {
    renderEditor({ base_url: "https://api.example.com/" }, true);
    openVariables();
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.addVariable" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "dataConnect.apiCatalog.sensitive" }));
    expect(screen.getByLabelText("dataConnect.apiCatalog.sensitiveValue variable1")).toHaveValue(
      "",
    );
    expect(screen.queryByText("dataConnect.apiCatalog.storedValue")).toBeNull();
  });

  it("keeps duplicate and illegal variable-name drafts invalid without overwriting stored members", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: {
        first: { value: "one", sensitive: false },
        second: { value: "two", sensitive: false },
      },
    });
    openVariables();
    const secondName = screen.getByLabelText("dataConnect.apiCatalog.variableName 2");
    fireEvent.change(secondName, { target: { value: "first" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(secondName).toHaveValue("first");
    expect(editor.latest().variables).toEqual({
      first: { value: "one", sensitive: false },
      second: { value: "two", sensitive: false },
    });

    fireEvent.change(secondName, { target: { value: "2illegal" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(secondName).toHaveValue("2illegal");
    expect(editor.latest().variables).toEqual({
      first: { value: "one", sensitive: false },
      second: { value: "two", sensitive: false },
    });

    fireEvent.change(secondName, { target: { value: "renamed" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest().variables).toEqual({
      first: { value: "one", sensitive: false },
      renamed: { value: "two", sensitive: false },
    });
  });

  it("propagates an unavailable connector state to nested graphical controls", () => {
    renderEditor(
      {
        base_url: "https://api.example.com/",
        variables: {
          tenant: { value: "demo", sensitive: false },
          count: { value: 1, sensitive: false },
        },
      },
      false,
      true,
    );
    expect(screen.getByLabelText("dataConnect.apiCatalog.baseUrl")).toBeDisabled();
    const summary = screen.getByText("dataConnect.optionEditor.title", { selector: "summary" });
    fireEvent.click(summary);
    expect(screen.getByRole("combobox", { name: "dataConnect.optionEditor.add" })).toBeDisabled();
    openVariables();
    expect(screen.getByLabelText("dataConnect.apiCatalog.variableValue tenant")).toBeDisabled();
    expect(screen.getByLabelText("dataConnect.apiCatalog.variableValue count")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "dataConnect.apiCatalog.addVariable" }),
    ).toBeDisabled();
  });

  it("edits an exact numeric variable while preserving arbitrary JSON and quoted numeric strings", async () => {
    const initial = {
      base_url: "https://api.example.com/",
      variables: {
        precise: { value: new BigNumber("9007199254740993"), sensitive: false },
        object: { value: { flag: false, nested: [null, 0] }, sensitive: false },
        array: { value: [false, "entry", {}], sensitive: false },
        quoted: { value: "9007199254740993", sensitive: false },
      },
    };
    const editor = renderEditor(initial);
    expect(editor.changed).not.toHaveBeenCalled();
    openVariables();
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.variableValue precise"), {
      target: { value: "1234567890.123456789" },
    });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    const variables = editor.latest().variables as Record<
      string,
      { value: unknown; sensitive: boolean }
    >;
    expect(BigNumber.isBigNumber(variables.precise.value)).toBe(true);
    expect(transformPrecisionSafeJSONRequest(variables)).toContain('"value":1234567890.123456789');
    expect(variables.object).toEqual(initial.variables.object);
    expect(variables.array).toEqual(initial.variables.array);
    expect(variables.quoted.value).toBe("9007199254740993");
  });

  it("reports incomplete numeric drafts without submitting the previous value as a newly edited number", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: { amount: { value: 42, sensitive: false } },
    });
    openVariables();
    const amount = screen.getByLabelText("dataConnect.apiCatalog.variableValue amount");
    fireEvent.change(amount, { target: { value: "1e" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(amount).toHaveValue("1e");
    expect(editor.latest().variables).toEqual({ amount: { value: 42, sensitive: false } });
    fireEvent.change(amount, { target: { value: "1e20" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(
      String((editor.latest().variables as Record<string, { value: unknown }>).amount.value),
    ).toBe("100000000000000000000");
  });

  it.each([{}, { value: null }, { value: undefined }])(
    "shows an absent sensitive value as an empty password field and requires reentry: %j",
    (variable) => {
      const editor = renderEditor(
        {
          base_url: "https://api.example.com/",
          variables: {
            tenant: { value: "demo", sensitive: false },
            secret: { ...variable, sensitive: true },
          },
        },
        true,
      );
      expect(editor.changed).not.toHaveBeenCalled();
      openVariables();
      const password = screen.getByLabelText("dataConnect.apiCatalog.sensitiveValue secret");
      expect(password).toHaveAttribute("type", "password");
      expect(password).toHaveValue("");
      expect(screen.getByText("dataConnect.apiCatalog.storedValue")).toBeVisible();
      expect(password).not.toHaveAttribute("placeholder", "dataConnect.apiCatalog.storedValue");
      expect(
        screen.getByRole("combobox", {
          name: "dataConnect.apiCatalog.variableValue secret dataConnect.apiEditor.valueType",
        }),
      ).toBeDisabled();
      expect(editor.latest().variables).toEqual({
        tenant: { value: "demo", sensitive: false },
        secret: { ...variable, sensitive: true },
      });
      fireEvent.change(password, { target: { value: "synthetic-fresh-input" } });
      expect(screen.queryByText("dataConnect.apiCatalog.storedValue")).toBeNull();
      expect(editor.latest()).toMatchObject({
        variables: {
          tenant: { value: "demo", sensitive: false },
          secret: { value: "synthetic-fresh-input", sensitive: true },
        },
      });
    },
  );

  it("removes a sensitive row and its declaration together while retaining other variables", () => {
    const editor = renderEditor(
      {
        base_url: "https://api.example.com/",
        variables: { tenant: { value: "demo", sensitive: false }, secret: { sensitive: true } },
      },
      true,
    );
    openVariables();
    fireEvent.click(
      screen.getByRole("button", { name: "dataConnect.apiCatalog.removeVariable secret" }),
    );
    expect(editor.latest().variables).toEqual({ tenant: { value: "demo", sensitive: false } });
    expect(editor.latest()).not.toHaveProperty("sensitive_variables");
    expect(screen.queryByLabelText("dataConnect.apiCatalog.sensitiveValue secret")).toBeNull();
  });

  it("does not emit configuration on mount or materialize displayed default limits", async () => {
    const editor = renderEditor({ base_url: "https://api.example.com/" });
    expect(editor.changed).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
      }),
    ).toBeNull();
    await addLimit("timeout_seconds");
    await addLimit("max_response_mib");
    expect(editor.changed).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
      }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", {
        name: "dataConnect.optionEditor.labels.httpResponseLimit (max_response_mib)",
      }),
    ).toHaveValue("");
    expect(
      screen.getByPlaceholderText("dataConnect.optionEditor.placeholders.httpTimeout"),
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText("dataConnect.optionEditor.placeholders.httpResponseLimit"),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.baseUrl"), {
      target: { value: "https://api.example.com/v2/" },
    });
    expect(editor.latest()).toEqual({ base_url: "https://api.example.com/v2/" });
  });

  it("removes the options object when explicitly entered limits are cleared", async () => {
    const editor = renderEditor({ base_url: "https://api.example.com/" });
    await addLimit("timeout_seconds");
    const timeout = screen.getByRole("textbox", {
      name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
    });
    fireEvent.change(timeout, { target: { value: "45" } });
    expect(editor.latest().options).toEqual({ timeout_seconds: 45 });
    fireEvent.change(timeout, { target: { value: "" } });
    expect(editor.latest()).not.toHaveProperty("options");
  });

  it("keeps an invalid optional limit draft from being replaced by its last valid number", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      options: { timeout_seconds: 30 },
    });
    const timeout = screen.getByRole("textbox", {
      name: "dataConnect.optionEditor.labels.httpTimeout (timeout_seconds)",
    });
    fireEvent.change(timeout, { target: { value: "-" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(timeout).toHaveValue("-");
    expect(editor.latest().options).toEqual({ timeout_seconds: 30 });
    fireEvent.change(timeout, { target: { value: "60" } });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest().options).toEqual({ timeout_seconds: 60 });
  });

  it("retains an invalid variable value when a preceding equal-valued row is removed", async () => {
    const editor = renderEditor({
      base_url: "https://api.example.com/",
      variables: {
        first: { value: 42, sensitive: false },
        second: { value: 42, sensitive: false },
      },
    });
    openVariables();
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.variableValue second"), {
      target: { value: "1e" },
    });
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(
      screen.getByRole("button", { name: "dataConnect.apiCatalog.removeVariable first" }),
    );
    expect(screen.getByLabelText("dataConnect.apiCatalog.variableValue second")).toHaveValue("1e");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.variableName 1"), {
      target: { value: "renamed" },
    });
    expect(screen.getByLabelText("dataConnect.apiCatalog.variableValue renamed")).toHaveValue("1e");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
  });

  it("retains invalid login numeric drafts across the optional login switch", async () => {
    const login = createApiLoginDefinition();
    login.request = {
      method: "POST",
      path: "login",
      body: { type: "object", properties: { count: { type: "number", value: 42 } } },
    };
    const editor = renderEditor({ base_url: "https://api.example.com/", login_request: login });
    fireEvent.click(screen.getByRole("tab", { name: "dataConnect.apiCatalog.login" }));
    fireEvent.change(
      screen.getByLabelText("dataConnect.apiEditor.body.count dataConnect.apiEditor.fieldValue"),
      {
        target: { value: "-" },
      },
    );
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }));
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }));
    expect(
      screen.getByLabelText("dataConnect.apiEditor.body.count dataConnect.apiEditor.fieldValue"),
    ).toHaveValue("-");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
  });

  it("retains the page-local login draft across disabling and re-enabling without mount-time writes", () => {
    const login = createApiLoginDefinition();
    login.request = { method: "POST", path: "auth/original", headers: {} };
    const editor = renderEditor({ base_url: "https://api.example.com/", login_request: login });
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "dataConnect.apiCatalog.login" }));
    expect(screen.queryByRole("group", { name: "dataConnect.apiCatalog.login" })).toBeNull();
    expect(
      screen.getByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }),
    ).toBeChecked();
    const requestCard = screen.getByRole("group", { name: "dataConnect.apiEditor.request" });
    expect(requestCard).toContainElement(screen.getByLabelText("dataConnect.apiEditor.path"));
    expect(
      within(requestCard).queryByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("dataConnect.apiEditor.path"), {
      target: { value: "auth/modified" },
    });
    const expectedLogin = editor.latest().login_request;
    fireEvent.click(screen.getByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }));
    expect(editor.latest()).not.toHaveProperty("login_request");
    fireEvent.click(screen.getByRole("switch", { name: "dataConnect.apiCatalog.enableLogin" }));
    expect(editor.latest().login_request).toEqual(expectedLogin);
    expect(screen.getByLabelText("dataConnect.apiEditor.path")).toHaveValue("auth/modified");
    expect(editor.changed).toHaveBeenCalledTimes(3);
    expect(document.querySelector("textarea, .monaco-editor")).toBeNull();
  });
});
