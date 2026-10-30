/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form } from "antd";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { DataConnectConfigForm } from "./DataConnectConfigForm";
import { ConnectorOptionsEditor } from "./ConnectorOptionsEditor";
import { getConnectorOptionDefinitions, validateConnectorOptions } from "../lib/connector-options";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

function renderForm(type: string, options?: unknown, { fullConfigForm = false } = {}) {
  const onFinish = vi.fn<(values: { connectorConfig: Record<string, unknown> }) => void>();
  const connector: DataConnectConnectorType = {
    available: true,
    category: "table",
    description: "",
    enabled: true,
    fieldConfig: { options: { encrypted: false, required: false, type: "object" } },
    mode: "local",
    name: type,
    type,
  };
  render(
    <Form
      initialValues={{
        name: "Catalog",
        enabled: true,
        healthCheckSchedule: { mode: "inherit" },
        connectorConfig: options === undefined ? {} : { options },
      }}
      onFinish={onFinish}
    >
      {fullConfigForm || !getConnectorOptionDefinitions(type) ? (
        <DataConnectConfigForm selectedConnectorType={connector} />
      ) : (
        <Form.Item
          name={["connectorConfig", "options"]}
          help={false}
          rules={[
            {
              validator: (_: unknown, value: unknown) => {
                const invalid = validateConnectorOptions(type, value);
                return invalid ? Promise.reject(new Error(invalid.error)) : Promise.resolve();
              },
            },
          ]}
        >
          <ConnectorOptionsEditor connectorType={type} />
        </Form.Item>
      )}
      <button type="submit">Submit</button>
    </Form>,
  );
  return onFinish;
}

async function selectOption(label: string, choice: string) {
  fireEvent.mouseDown(screen.getByLabelText(label, { selector: "input" }));
  fireEvent.click(await screen.findByText(choice, { selector: ".ant-select-item-option-content" }));
}

async function submit(onFinish: ReturnType<typeof renderForm>, options: unknown, omitted = false) {
  onFinish.mockClear();
  fireEvent.click(screen.getByText("Submit", { selector: "button" }));
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
  expect(onFinish.mock.lastCall?.[0]).toMatchObject({
    connectorConfig: omitted ? {} : { options },
  });
  if (omitted) expect(onFinish.mock.lastCall?.[0].connectorConfig.options).toBeUndefined();
}

describe("structured connector options in the configuration form", () => {
  beforeEach(async () => {
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
    await i18n.changeLanguage("en-US");
  });
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it.each([
    [
      "mysql",
      { charset: "" },
      "textbox",
      "Character set (charset)",
      "utf8mb4",
      { charset: "utf8mb4" },
    ],
    [
      "sqlserver",
      { encrypt: "invalid" },
      "combobox",
      "Encrypt connection (encrypt)",
      "Off",
      { encrypt: false },
    ],
    [
      "sqlserver",
      { tlsmin: "invalid" },
      "combobox",
      "Minimum TLS version (tlsmin)",
      "1.2",
      { tlsmin: "1.2" },
    ],
    [
      "postgresql",
      { connect_timeout: -1 },
      "spinbutton",
      "Connect timeout (connect_timeout)",
      "30",
      { connect_timeout: 30 },
    ],
  ] as const)(
    "associates %s %j control errors and clears the association when corrected",
    async (type, options, role, name, correction, expected) => {
      const onFinish = renderForm(type, options);
      const input = screen.getByRole(role, { name });
      expect(input.id).not.toBe("");
      expect(input).toHaveAttribute("aria-invalid", "true");
      const errorId = input
        .getAttribute("aria-describedby")
        ?.split(" ")
        .find(
          (descriptionId) =>
            document.getElementById(descriptionId)?.getAttribute("role") === "alert",
        );
      expect(errorId).toBeTruthy();
      expect(document.getElementById(errorId!)).toHaveAttribute("role", "alert");
      expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(errorId);
      if (role === "combobox") await selectOption(name, correction);
      else fireEvent.change(input, { target: { value: correction } });
      await submit(onFinish, expected);
      expect(input).not.toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")?.split(" ") ?? []).not.toContain(errorId);
      expect(document.getElementById(errorId!)).toBeNull();
    },
  );

  it("keeps input IDs stable and links descriptions separately from errors", async () => {
    const onFinish = renderForm("mysql", { time_zone: "", charset: "" });
    const input = screen.getByRole("textbox", { name: "Character set (charset)" });
    const id = input.id;
    const descriptionIds = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(descriptionIds).toHaveLength(2);
    expect(descriptionIds.every((descriptionId) => document.getElementById(descriptionId))).toBe(
      true,
    );
    expect(input).toHaveAccessibleDescription(/Defaults to utf8mb4/);
    fireEvent.click(screen.getByRole("button", { name: "Remove time_zone" }));
    expect(input.id).toBe(id);
    fireEvent.change(input, { target: { value: "utf8mb4" } });
    await submit(onFinish, { charset: "utf8mb4" });
    expect(input.id).toBe(id);
    expect(input).toHaveAccessibleDescription(
      "Defaults to utf8mb4 when omitted. Enter a character set supported by the database.",
    );
  });

  it("associates malformed JSON with its repair input", () => {
    renderForm("mysql", "{broken");
    const input = screen.getByRole("textbox", { name: "Repair connection options JSON" });
    expect(input.id).not.toBe("");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent("Enter a valid JSON object.");
  });

  it("shows a validation error only in its parameter card and expands it on invalid submission", async () => {
    const onFinish = renderForm("mysql", { time_zone: "", charset: "" }, { fullConfigForm: true });
    fireEvent.click(screen.getByText("Added options (2)"));
    expect(document.querySelector("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.querySelector(".ant-form-item-has-error")).not.toBeNull());
    expect(screen.getAllByText(/Enter a non-empty string/)).toHaveLength(1);
    expect(document.querySelector("details")).toHaveAttribute("open");
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Character set (charset)" }), {
      target: { value: "utf8mb4" },
    });
    await submit(onFinish, { time_zone: "", charset: "utf8mb4" });
    expect(screen.queryByText(/Enter a non-empty string/)).toBeNull();
  });

  it("keeps normalized duplicate-key errors visible in the corresponding card", async () => {
    const onFinish = renderForm("sqlserver", { Encrypt: true, encrypt: false });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.querySelector(".ant-form-item-has-error")).not.toBeNull());
    const errors = screen.getAllByText(/This parameter duplicates another key/);
    expect(errors).toHaveLength(1);
    expect(errors[0].closest("[class*='_optionRow_']")).not.toBeNull();
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove encrypt" }));
    await submit(onFinish, { Encrypt: true });
  });

  it("shows malformed options JSON once and continues to validate it", async () => {
    const onFinish = renderForm("mysql", "{broken");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.querySelector(".ant-form-item-has-error")).not.toBeNull());
    expect(screen.getAllByText(/Enter a valid JSON object/)).toHaveLength(1);
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Repair connection options JSON" }), {
      target: { value: "{}" },
    });
    await submit(onFinish, "{}");
  });

  it("keeps defaults omitted, adds a boolean explicitly, and removes it without sending false implicitly", async () => {
    const onFinish = renderForm("sqlserver");
    expect(document.querySelector("details")).not.toHaveAttribute("open");
    await submit(onFinish, undefined, true);
    fireEvent.click(screen.getByText("Added options (0)"));
    await selectOption("Add parameter", "Encrypt connection (encrypt)");
    onFinish.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.querySelector(".ant-form-item-has-error")).not.toBeNull());
    expect(screen.getAllByText("Choose enabled or disabled.")).toHaveLength(1);
    expect(onFinish).not.toHaveBeenCalled();
    await selectOption("Encrypt connection (encrypt)", "Off");
    await submit(onFinish, { encrypt: false });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Add parameter" }));
    expect(
      document.querySelector('.ant-select-item-option[title="Encrypt connection (encrypt)"]'),
    ).toBeNull();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Add parameter" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Remove encrypt" }));
    await submit(onFinish, null);
  });

  it.each(["mysql", "postgresql"])(
    "distinguishes omitted, empty and native timezone values for %s",
    async (type) => {
      const key = type === "mysql" ? "time_zone" : "timezone";
      const onFinish = renderForm(type);
      fireEvent.click(screen.getByText("Added options (0)"));
      await selectOption("Add parameter", `Session time zone (${key})`);
      await submit(onFinish, { [key]: "" });
      fireEvent.change(screen.getByRole("textbox", { name: `Session time zone (${key})` }), {
        target: { value: "-08:00" },
      });
      await submit(onFinish, { [key]: "-08:00" });
      fireEvent.click(screen.getByRole("button", { name: `Remove ${key}` }));
      await submit(onFinish, null);
    },
  );

  it("preserves legacy option keys, numeric strings, booleans, and future parameters on an untouched save", async () => {
    const options = {
      " Encrypt ": false,
      "connection timeout": "0",
      future: { nested: [false, 0, ""] },
    };
    const onFinish = renderForm("sqlserver", JSON.stringify(options));
    expect(
      screen.getByRole("spinbutton", { name: "Connect timeout (connection timeout)" }),
    ).toHaveValue("0");
    expect(screen.getByText(/This parameter is not described/)).toBeInTheDocument();
    // The existing scene may supply JSON strings; rendering must not rewrite them.
    await submit(onFinish, JSON.stringify(options));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Connect timeout (connection timeout)" }),
      { target: { value: "15" } },
    );
    await submit(onFinish, { ...options, "connection timeout": 15 });
    fireEvent.click(screen.getByRole("button", { name: "Remove future" }));
    await submit(onFinish, { " Encrypt ": false, "connection timeout": 15 });
  });

  it("reports dependencies and reevaluates them after changing or removing TLS", async () => {
    const onFinish = renderForm("hana", { TLSServerName: "db.example", tls: false });
    expect(
      screen.getByText("Enable tls before configuring the certificate server name."),
    ).toBeInTheDocument();
    await selectOption("TLS (tls)", "On");
    expect(
      screen.queryByText("Enable tls before configuring the certificate server name."),
    ).toBeNull();
    await submit(onFinish, { TLSServerName: "db.example", tls: true });
    fireEvent.click(screen.getByRole("button", { name: "Remove tls" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(document.querySelector(".ant-form-item-has-error")).not.toBeNull());
    expect(
      screen.getAllByText("Enable tls before configuring the certificate server name."),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove TLSServerName" }));
    await submit(onFinish, null);
  });

  it("uses enum controls and retains valid zero values", async () => {
    const onFinish = renderForm("sqlserver", { tlsmin: "1.2", "connection timeout": 0 });
    await selectOption("Minimum TLS version (tlsmin)", "1.3");
    await submit(onFinish, { tlsmin: "1.3", "connection timeout": 0 });
  });

  it("validates duration input before submission and switches copy with the locale", async () => {
    const onFinish = renderForm("doris", { timeout: "0s" });
    expect(
      screen.getByText("Enter a positive duration within the driver range, such as 30s."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Connect timeout (timeout)" }), {
      target: { value: "250ms" },
    });
    await submit(onFinish, { timeout: "250ms" });
    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    expect(screen.getByRole("textbox", { name: "建连超时 (timeout)" })).toHaveValue("250ms");
    expect(screen.getByText("已添加（1）")).toBeInTheDocument();
  });

  it("keeps raw JSON editing and syntax validation for untemplated connectors", async () => {
    const onFinish = renderForm("custom", '{"customFlag":true}');
    const editor = screen.getByDisplayValue('{"customFlag":true}');
    expect(editor.tagName).toBe("TEXTAREA");
    fireEvent.change(editor, { target: { value: "{broken" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Enter a valid JSON object.")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
