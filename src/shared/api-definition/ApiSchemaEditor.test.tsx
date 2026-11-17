/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiSchemaEditor } from "./ApiSchemaEditor";
import { objectValue } from "./model";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const title = (key: string) => `dataConnect.apiEditor.${key}`;

function renderEditor(initial: unknown, disabled = false) {
  const changed = vi.fn<(value: unknown) => void>();
  const validity = vi.fn<(valid: boolean) => void>();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <ApiSchemaEditor
        value={value}
        label="Schema"
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
  return { changed, validity, latest: () => changed.mock.lastCall?.[0] ?? initial };
}

async function choose(label: string, option: string) {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.mouseDown(input.closest(".ant-select-selector")!);
  fireEvent.click(await screen.findByText(option, { selector: ".ant-select-item-option-content" }));
}

describe("Schema property cards", () => {
  it.each(["string", "integer", "number", "boolean"])(
    "hides stale structural fields for scalar %s without writing on mount",
    (type) => {
      const initial = {
        type,
        description: "Before",
        properties: { stale: { type: "string" } },
        required: ["stale"],
        items: { type: "object", properties: { staleItem: { type: "string" } } },
        "x-vendor": { preserve: true },
      };
      const editor = renderEditor(initial);
      expect(editor.changed).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: title("addProperty") })).toBeNull();
      expect(screen.queryByText(title("arrayElement"))).toBeNull();
      fireEvent.change(screen.getByLabelText("Schema.description"), {
        target: { value: "After" },
      });
      expect(editor.latest()).toEqual({
        type,
        description: "After",
        items: initial.items,
        "x-vendor": initial["x-vendor"],
      });
      expect(initial.properties).toEqual({ stale: { type: "string" } });
    },
  );

  it.each(["string", "integer", "number", "boolean"])(
    "keeps root scalar %s selectable and removes object properties and required",
    async (type) => {
      const editor = renderEditor({
        type: "object",
        description: "Response",
        properties: { token: { type: "string" } },
        required: ["token", "external"],
        examples: [{ token: "example" }],
        "x-vendor": { keep: true },
      });
      await choose(`Schema ${title("schemaType")}`, title(`types.${type}`));
      expect(editor.latest()).toEqual({
        type,
        description: "Response",
        examples: [{ token: "example" }],
        "x-vendor": { keep: true },
      });
      expect(screen.queryByRole("button", { name: title("addProperty") })).toBeNull();
      await choose(`Schema ${title("schemaType")}`, title("types.object"));
      expect(editor.latest()).toMatchObject({ type: "object", properties: {} });
      expect(editor.latest()).not.toHaveProperty("required");
    },
  );

  it("removes only the nested scalar's object fields while keeping its parent required", async () => {
    const editor = renderEditor({
      type: "object",
      required: ["profile"],
      properties: {
        profile: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
        other: { type: "string" },
      },
    });
    await choose(`Schema.profile ${title("schemaType")}`, title("types.string"));
    expect(editor.latest()).toEqual({
      type: "object",
      required: ["profile"],
      properties: { profile: { type: "string" }, other: { type: "string" } },
    });
    const card = screen.getByRole("group", { name: "Schema.profile" });
    expect(within(card).queryByRole("button", { name: title("addProperty") })).toBeNull();
    expect(
      within(card).getByRole("checkbox", { name: `Schema.profile ${title("required")}` }),
    ).toBeChecked();
  });

  it("allows scalar array items without object property controls", async () => {
    const editor = renderEditor({
      type: "array",
      items: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
    });
    await choose(`Schema.items ${title("schemaType")}`, title("types.boolean"));
    expect(editor.latest()).toEqual({ type: "array", items: { type: "boolean" } });
    expect(screen.queryByRole("button", { name: title("addProperty") })).toBeNull();
    expect(screen.getByText(title("arrayElement"))).toBeVisible();
  });

  it("removes object fields when the last object branch is removed from a union", async () => {
    const editor = renderEditor({
      type: ["object", "string"],
      properties: { name: { type: "string" } },
      required: ["name"],
      default: "text",
    });
    await choose(`Schema ${title("schemaType")}`, title("types.object"));
    expect(editor.latest()).toEqual({ type: ["string"], default: "text" });
    expect(screen.queryByRole("button", { name: title("addProperty") })).toBeNull();
  });

  it("keeps object properties while a union still contains object", async () => {
    const initial = {
      type: ["object", "null"],
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    const editor = renderEditor(initial);
    await choose(`Schema ${title("schemaType")}`, title("types.string"));
    expect(editor.latest()).toEqual({ ...initial, type: ["object", "null", "string"] });
    expect(screen.getByRole("button", { name: title("addProperty") })).toBeVisible();
  });

  it("clears object fields when switching to array and initializes its items", async () => {
    const editor = renderEditor({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
    await choose(`Schema ${title("schemaType")}`, title("types.array"));
    expect(editor.latest()).toEqual({ type: "array", items: { type: "string" } });
    expect(screen.queryByRole("button", { name: title("addProperty") })).toBeNull();
    expect(screen.getByText(title("arrayElement"))).toBeVisible();
  });

  it("unregisters invalid object drafts when their node becomes scalar", async () => {
    const editor = renderEditor({
      type: "object",
      properties: { first: { type: "string" }, second: { type: "string" } },
    });
    const name = screen.getByLabelText(`Schema.properties ${title("propertyName")} first`);
    fireEvent.change(name, { target: { value: "second" } });
    fireEvent.blur(name);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    await choose(`Schema ${title("schemaType")}`, title("types.string"));
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest()).toEqual({ type: "string" });
  });

  it("keeps keyword-based editors for a Schema without an explicit type", () => {
    const editor = renderEditor({ properties: { name: { type: "string" } }, required: ["name"] });
    expect(screen.getByRole("button", { name: title("addProperty") })).toBeVisible();
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Schema.description"), { target: { value: "Untyped" } });
    expect(editor.latest()).toEqual({
      properties: { name: { type: "string" } },
      required: ["name"],
      description: "Untyped",
    });
  });

  it("adds a focused field definition with one type control, required checkbox and description", async () => {
    const editor = renderEditor({ type: "object", properties: {} });
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: title("addProperty") }));
    const name = screen.getByLabelText(`Schema.properties ${title("propertyName")} field`);
    await waitFor(() => expect(name).toHaveFocus());
    const card = screen.getByRole("group", { name: "Schema.field" });
    expect(
      within(card).getByRole("combobox", { name: `Schema.field ${title("schemaType")}` }),
    ).toBeEnabled();
    expect(
      within(card).getByRole("checkbox", { name: `Schema.field ${title("required")}` }),
    ).not.toBeChecked();
    expect(within(card).getByLabelText("Schema.field.description")).toBeVisible();
    expect(
      within(card).getAllByRole("combobox", { name: `Schema.field ${title("schemaType")}` }),
    ).toHaveLength(1);
    expect(editor.latest()).toEqual({ type: "object", properties: { field: { type: "string" } } });
  });

  it("renames and removes the matching required entry while retaining required-only members", () => {
    const editor = renderEditor({
      type: "object",
      properties: { token: { type: "string", format: "uuid" } },
      required: ["token", "external"],
      additionalProperties: false,
    });
    const input = screen.getByLabelText(`Schema.properties ${title("propertyName")} token`);
    fireEvent.change(input, { target: { value: "credential" } });
    fireEvent.blur(input);
    expect(screen.getByLabelText(`Schema.properties ${title("propertyName")} credential`)).toBe(
      input,
    );
    expect(editor.latest()).toEqual({
      type: "object",
      properties: { credential: { type: "string", format: "uuid" } },
      required: ["credential", "external"],
      additionalProperties: false,
    });
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Schema.credential" }).children[0] as HTMLElement,
      ).getByRole("button", {
        name: title("remove"),
      }),
    );
    expect(editor.latest()).toEqual({
      type: "object",
      properties: {},
      required: ["external"],
      additionalProperties: false,
    });
  });

  it("stores required on the parent and omits an emptied list", () => {
    const editor = renderEditor({ type: "object", properties: { token: { type: "string" } } });
    const required = screen.getByRole("checkbox", { name: `Schema.token ${title("required")}` });
    fireEvent.click(required);
    expect(objectValue(editor.latest()).required).toEqual(["token"]);
    expect(
      objectValue(objectValue(objectValue(editor.latest()).properties).token),
    ).not.toHaveProperty("required");
    fireEvent.click(required);
    expect(editor.latest()).not.toHaveProperty("required");
  });

  it("does not duplicate an existing required-only name when renaming a property", () => {
    const editor = renderEditor({
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token", "credential"],
    });
    const input = screen.getByLabelText(`Schema.properties ${title("propertyName")} token`);
    fireEvent.change(input, { target: { value: "credential" } });
    fireEvent.blur(input);
    expect(objectValue(editor.latest()).required).toEqual(["credential"]);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Schema.credential" })).getByRole("button", {
        name: title("remove"),
      }),
    );
    expect(editor.latest()).not.toHaveProperty("required");
  });

  it("keeps duplicate name drafts invalid without overwriting siblings", async () => {
    const initial = {
      type: "object",
      properties: { token: { type: "string" }, other: { type: "boolean" } },
      required: ["token"],
    };
    const editor = renderEditor(initial);
    const input = screen.getByLabelText(`Schema.properties ${title("propertyName")} token`);
    fireEvent.change(input, { target: { value: "other" } });
    fireEvent.blur(input);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Schema.other.description"), {
      target: { value: "Flag" },
    });
    expect(input).toHaveValue("other");
    expect(objectValue(editor.latest()).required).toEqual(["token"]);
    fireEvent.change(input, { target: { value: "credential" } });
    fireEvent.blur(input);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(objectValue(editor.latest()).required).toEqual(["credential"]);
  });

  it("edits array item properties as Schema definitions without introducing value fields", () => {
    const editor = renderEditor({
      type: "array",
      items: { type: "object", properties: { id: { type: "integer" } } },
      prefixItems: [{ const: "header" }],
    });
    const input = screen.getByLabelText(`Schema.items.properties ${title("propertyName")} id`);
    fireEvent.change(input, { target: { value: "code" } });
    fireEvent.blur(input);
    expect(editor.latest()).toEqual({
      type: "array",
      items: { type: "object", properties: { code: { type: "integer" } } },
      prefixItems: [{ const: "header" }],
    });
    expect(screen.getByText(title("arrayElement"))).toBeVisible();
  });

  it("omits constraint editors while preserving existing keywords through a type edit", async () => {
    const initial = {
      type: "string",
      minLength: 2,
      enum: ["a", "b"],
      oneOf: [{ const: "a" }],
      "x-vendor": { keep: true },
    };
    const editor = renderEditor(initial);
    expect(screen.queryByText(title("advancedSchema"))).toBeNull();
    expect(screen.queryByRole("combobox", { name: `Schema ${title("addConstraint")}` })).toBeNull();
    expect(screen.queryByLabelText("Schema.minLength")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
    expect(editor.changed).not.toHaveBeenCalled();
    await choose(`Schema ${title("schemaType")}`, title("types.number"));
    expect(editor.latest()).toEqual({ ...initial, type: "number" });
  });

  it("initializes a new array's item definition only on an explicit type change", async () => {
    const editor = renderEditor({ type: "string", description: "Keep" });
    expect(editor.changed).not.toHaveBeenCalled();
    await choose(`Schema ${title("schemaType")}`, title("types.array"));
    expect(editor.latest()).toEqual({
      type: "array",
      description: "Keep",
      items: { type: "string" },
    });
  });

  it("preserves boolean schemas, union types and complex keywords on an unrelated edit", () => {
    const initial = {
      type: "object",
      properties: {
        allowed: true,
        blocked: false,
        nullable: { type: ["string", "null"], oneOf: [{ const: "x" }, { const: null }] },
      },
      required: ["allowed"],
    };
    const editor = renderEditor(initial);
    expect(editor.changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Schema.description"), {
      target: { value: "Response" },
    });
    expect(editor.latest()).toEqual({ ...initial, description: "Response" });
    expect(
      screen.getByRole("checkbox", { name: `Schema.allowed ${title("required")}` }),
    ).toBeChecked();
  });

  it.each([true, false])(
    "keeps boolean Schema %s editable as a regular typed definition",
    async (schema) => {
      const editor = renderEditor(schema);
      expect(editor.changed).not.toHaveBeenCalled();
      await choose(`Schema ${title("schemaType")}`, title("types.object"));
      expect(editor.latest()).toEqual({ type: "object", properties: {} });
    },
  );

  it("edits an existing union without flattening it or changing other metadata", async () => {
    const editor = renderEditor({ type: ["string", "null"], default: null });
    expect(editor.changed).not.toHaveBeenCalled();
    await choose(`Schema ${title("schemaType")}`, title("types.number"));
    expect(editor.latest()).toEqual({ type: ["string", "null", "number"], default: null });
  });

  it("adds object properties inside a nullable union without flattening the union", () => {
    const editor = renderEditor({ type: ["object", "null"], default: null });
    fireEvent.click(screen.getByRole("button", { name: title("addProperty") }));
    expect(editor.latest()).toEqual({
      type: ["object", "null"],
      default: null,
      properties: { field: { type: "string" } },
    });
  });

  it("disables property mutations and leaves the configuration untouched", () => {
    const editor = renderEditor(
      { type: "object", properties: { token: { type: "string" } } },
      true,
    );
    expect(
      screen.getByLabelText(`Schema.properties ${title("propertyName")} token`),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: `Schema.token ${title("required")}` }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Schema.token.description")).toBeDisabled();
    expect(screen.getByRole("button", { name: title("addProperty") })).toBeDisabled();
    expect(screen.getByRole("button", { name: title("remove") })).toBeDisabled();
    expect(editor.changed).not.toHaveBeenCalled();
  });
});
