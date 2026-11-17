/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiResponseEditor } from "./ApiResponseEditor";
import { objectValue, type DefinitionObject } from "./model";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const title = (key: string) => `dataConnect.apiEditor.${key}`;
const response = (description: string, schema: unknown = { type: "object", properties: {} }) => ({
  description,
  schema,
});

function renderEditor(
  statuses: DefinitionObject,
  disabled = false,
  contentType: string | null = "application/json",
) {
  const initial = { ...(contentType === null ? {} : { content_type: contentType }), statuses };
  const changed = vi.fn<(value: DefinitionObject) => void>();
  const validity = vi.fn<(valid: boolean) => void>();
  function Harness() {
    const [value, setValue] = useState<DefinitionObject>(initial);
    return (
      <ApiResponseEditor
        value={value}
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
  const latestResponse = () => changed.mock.lastCall?.[0] ?? initial;
  return {
    changed,
    validity,
    latestResponse,
    latest: () => objectValue(latestResponse().statuses),
  };
}

describe("response status tabs", () => {
  it("writes one shared content type without synthesizing defaults on mount", async () => {
    const editor = renderEditor({ "200": { description: "Success", schema: false } }, false, null);
    expect(editor.changed).not.toHaveBeenCalled();
    const select = screen.getByRole("combobox", { name: title("mediaType") });
    fireEvent.mouseDown(select.closest(".ant-select-selector")!);
    fireEvent.click(
      await screen.findByText("application/json", { selector: ".ant-select-item-option-content" }),
    );
    expect(editor.latestResponse()).toEqual({
      content_type: "application/json",
      statuses: { "200": { description: "Success", schema: false } },
    });
  });

  it("keeps a false Schema when editing the response description", () => {
    const editor = renderEditor({ "200": response("Success", false) });
    fireEvent.change(screen.getByLabelText(`200 ${title("description")}`), {
      target: { value: "Changed" },
    });
    expect(editor.latest()).toEqual({ "200": response("Changed", false) });
    expect(objectValue(editor.latest()["200"])).not.toHaveProperty("content");
  });

  it("labels a JSON-only media selector and offers no media add or remove action", async () => {
    const editor = renderEditor({ "200": response("Success"), "400": response("Failure") });
    const panel = screen.getByRole("group", { name: `${title("responseStatus")} 200` });
    const select = screen.getByRole("combobox", { name: title("mediaType") });
    expect(screen.getAllByRole("combobox", { name: title("mediaType") })).toHaveLength(1);
    expect(panel).not.toContainElement(select);
    expect(screen.getByText(title("mediaType"))).toBeVisible();
    expect(select).toHaveAttribute("readonly");
    expect(select.closest(".ant-select")?.querySelector(".ant-select-clear")).toBeNull();
    fireEvent.mouseDown(select.closest(".ant-select-selector")!);
    expect(await screen.findByRole("option", { name: "application/json" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      within(panel).getAllByRole("button", { name: /dataConnect.apiEditor.remove/ }),
    ).toHaveLength(1);
    // Only the Schema property action remains; there is no media-level add action.
    expect(within(panel).getAllByRole("button", { name: title("addProperty") })).toHaveLength(1);
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("edits flat Schema without losing Schema annotations or response metadata", () => {
    const original = {
      description: "Success",
      headers: { trace: {} },
      result: { rows: "items" },
      schema: { type: "number", minimum: 0, examples: [{ count: 1 }] },
    };
    const editor = renderEditor({ "200": original });
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("200 application/json Schema.description"), {
      target: { value: "Updated Schema" },
    });
    expect(editor.latest()).toEqual({
      "200": {
        ...original,
        schema: { ...original.schema, description: "Updated Schema" },
      },
    });
  });

  it("keeps Schema properties removable while the JSON media remains", () => {
    const editor = renderEditor({
      "200": response("Success", { type: "object", properties: { name: { type: "string" } } }),
    });
    fireEvent.click(screen.getByRole("button", { name: title("remove") }));
    expect(editor.latest()).toEqual({ "200": response("Success") });
    expect(
      screen.getByRole("combobox", { name: title("mediaType") }).closest(".ant-select"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: `${title("remove")} 200` })).toBeEnabled();
  });

  it("switches status panels without changing the response configuration", () => {
    const editor = renderEditor({ "200": response("Success"), "400": response("Bad request") });
    expect(screen.getByRole("tablist", { name: title("response") })).toBeVisible();
    expect(screen.getByRole("tab", { name: "200" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(`200 ${title("description")}`)).toBeVisible();
    expect(screen.getByLabelText(`400 ${title("description")}`)).not.toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "400" }));
    expect(screen.getByLabelText(`400 ${title("description")}`)).toBeVisible();
    expect(screen.getByLabelText(`200 ${title("description")}`)).not.toBeVisible();
    expect(editor.changed).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: title("addResponse") }).closest('[role="tablist"]'),
    ).toBeNull();
  });

  it("adds a unique response, selects it, and preserves other response metadata", () => {
    const original = { ...response("Success"), result: { rows: "items" }, headers: { trace: {} } };
    const editor = renderEditor({ "200": original });
    fireEvent.click(screen.getByRole("button", { name: title("addResponse") }));
    expect(screen.getByRole("tab", { name: "201" })).toHaveAttribute("aria-selected", "true");
    expect(editor.latestResponse()).toEqual({
      content_type: "application/json",
      statuses: { "200": original, "201": response("") },
    });
  });

  it("renames the active status without remounting its editor or losing Schema data", () => {
    const schema = { oneOf: [{ const: 0 }, { const: false }] };
    const editor = renderEditor({ "200": response("Success", schema), default: response("Other") });
    const input = screen.getByLabelText(`${title("responseStatus")} ${title("name")} 200`);
    fireEvent.change(input, { target: { value: "2XX" } });
    fireEvent.blur(input);
    expect(screen.getByRole("tab", { name: "2XX" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(`${title("responseStatus")} ${title("name")} 2XX`)).toBe(input);
    expect(editor.latest()).toEqual({
      "2XX": response("Success", schema),
      default: response("Other"),
    });
  });

  it("keeps an invalid property name draft registered while its response is hidden", async () => {
    const editor = renderEditor({
      "200": response("Success", {
        type: "object",
        properties: { count: { type: "integer" }, other: { type: "string" } },
        required: ["count"],
      }),
      "400": response("Failure"),
    });
    const label = `200 application/json Schema.properties ${title("propertyName")} count`;
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: "other" } });
    fireEvent.blur(input);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("tab", { name: "400" }));
    expect(editor.validity).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("tab", { name: "200" }));
    expect(screen.getByLabelText(label)).toHaveValue("other");
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.blur(input);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(objectValue(editor.latest()["200"]).schema).toMatchObject({
      properties: { renamed: { type: "integer" }, other: { type: "string" } },
      required: ["renamed"],
    });
  });

  it("includes an unvisited response in validity reporting", async () => {
    const editor = renderEditor({
      "200": response("Success"),
      "400": response("Failure", { type: "object", properties: { "": { type: "string" } } }),
    });
    expect(screen.getByRole("tab", { name: "200" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("retains duplicate-name drafts and does not overwrite the other response", async () => {
    const editor = renderEditor({ "200": response("Success"), "400": response("Failure") });
    const label = `${title("responseStatus")} ${title("name")} 200`;
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("tab", { name: "400" }));
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("tab", { name: "200" }));
    expect(screen.getByLabelText(label)).toHaveValue("400");
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "201" } });
    fireEvent.blur(input);
    expect(screen.getByRole("tab", { name: "201" })).toHaveAttribute("aria-selected", "true");
    expect(editor.latest()["400"]).toEqual(response("Failure"));
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
  });

  it("selects an adjacent response on removal and allows adding after the last removal", () => {
    const editor = renderEditor({
      "200": response("Success"),
      "400": response("Failure"),
      default: response("Other"),
    });
    fireEvent.click(screen.getByRole("tab", { name: "400" }));
    fireEvent.click(screen.getByRole("button", { name: `${title("remove")} 400` }));
    expect(screen.getByRole("tab", { name: "default" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: `${title("remove")} default` }));
    expect(screen.getByRole("tab", { name: "200" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: `${title("remove")} 200` }));
    expect(editor.latestResponse()).toEqual({ content_type: "application/json", statuses: {} });
    expect(screen.getByText(title("noResponses"))).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: title("addResponse") }));
    expect(screen.getByRole("tab", { name: "200" })).toHaveAttribute("aria-selected", "true");
  });

  it("allows viewing disabled response tabs while keeping mutations disabled", () => {
    const editor = renderEditor({ "200": response("Success"), "400": response("Failure") }, true);
    expect(screen.getByRole("button", { name: title("addResponse") })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "400" }));
    expect(screen.getByLabelText(`400 ${title("description")}`)).toBeDisabled();
    expect(screen.getByRole("combobox", { name: title("mediaType") })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${title("remove")} 400` })).toBeDisabled();
    expect(editor.changed).not.toHaveBeenCalled();
  });
});
