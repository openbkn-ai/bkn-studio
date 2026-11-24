/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BigNumber from "bignumber.js";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApiSuccessRuleEditor } from "./ApiSuccessRuleEditor";
import { createApiLoginDefinition } from "./index";
import type { DefinitionObject } from "./model";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const title = (key: string) => `dataConnect.apiEditor.${key}`;

function renderEditor(initial: DefinitionObject, disabled = false) {
  const changed = vi.fn<(value: DefinitionObject) => void>();
  const validity = vi.fn<(valid: boolean) => void>();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <ApiSuccessRuleEditor
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
  return { changed, validity, latest: () => changed.mock.lastCall?.[0] ?? initial };
}

function addStatus(code: string) {
  const input = screen.getByRole("combobox", { name: title("allowedStatuses") });
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
}

const tags = () =>
  screen
    .getByRole("combobox", { name: title("allowedStatuses") })
    .closest(".ant-select")!
    .querySelectorAll(".ant-select-selection-item");

describe("Success HTTP status tags", () => {
  it("shows the default 200 as a tag without changing the definition on mount", () => {
    const editor = renderEditor(createApiLoginDefinition().success_rule as DefinitionObject);
    expect(tags()).toHaveLength(1);
    expect(tags()[0]).toHaveTextContent("200");
    expect(screen.getByRole("combobox", { name: title("allowedStatuses") })).toBeRequired();
    expect(screen.queryByText(title("valueType"))).toBeNull();
    expect(screen.queryByRole("button", { name: title("addItem") })).toBeNull();
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("adds trimmed numeric codes, deduplicates and preserves the body condition and metadata", () => {
    const initial = {
      http_status: [200],
      body_filter_condition: { operation: "eq", field: "code", value: 0 },
      "x-vendor": { keep: true },
    };
    const editor = renderEditor(initial);
    for (const code of [" 201 ", "200", " 201 ", "100", "599", "202", "204"]) addStatus(code);
    expect(editor.latest()).toEqual({ ...initial, http_status: [200, 201, 100, 599, 202, 204] });
    expect(tags()).toHaveLength(6);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["99", "600", "200.5", "2XX", "default", "text", "0200", "2e2", "   "])(
    "rejects invalid candidate %j without replacing selected codes",
    (candidate) => {
      const editor = renderEditor({ http_status: [200] });
      addStatus(candidate);
      expect(screen.getByRole("alert")).toHaveTextContent(title("errors.status"));
      expect(tags()).toHaveLength(1);
      expect(editor.changed).not.toHaveBeenCalled();
      addStatus("201");
      expect(editor.latest().http_status).toEqual([200, 201]);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("allows an empty draft but reports it invalid until a code is added", async () => {
    const editor = renderEditor({ http_status: [200] });
    fireEvent.click(document.querySelector(".ant-select-selection-item-remove")!);
    expect(editor.latest().http_status).toEqual([]);
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
    const input = screen.getByRole("combobox", { name: title("allowedStatuses") });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(title("errors.status"));
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    addStatus("204");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.latest().http_status).toEqual([204]);
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([{}, { http_status: [] }, { http_status: ["200"] }])(
    "does not fill or rewrite invalid loaded values %j on mount",
    async (initial) => {
      const editor = renderEditor(initial);
      await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
      expect(editor.changed).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("keeps duplicate loaded codes invalid until the user edits the tags", async () => {
    const consoleError = vi.spyOn(console, "error");
    try {
      const initial = { http_status: [200, 200] };
      const editor = renderEditor(initial);
      const input = screen.getByRole("combobox", { name: title("allowedStatuses") });
      await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(false));
      expect(editor.changed).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(consoleError.mock.calls).not.toContainEqual(
        expect.arrayContaining([
          expect.stringContaining("Encountered two children with the same key"),
        ]),
      );
      expect(tags()).toHaveLength(1);
      expect(tags()[0]).toHaveTextContent("200");

      fireEvent.blur(input);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent(title("errors.status"));
      expect(editor.latest()).toEqual({ http_status: [200, 200] });

      addStatus("201");
      expect(editor.latest()).toEqual({ http_status: [200, 201] });
      await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("displays a precision-preserving loaded number without rewriting it", async () => {
    const editor = renderEditor({ http_status: [new BigNumber(200)] });
    expect(tags()[0]).toHaveTextContent("200");
    await waitFor(() => expect(editor.validity).toHaveBeenLastCalledWith(true));
    expect(editor.changed).not.toHaveBeenCalled();
  });

  it("disables adding and removing codes without changing the definition", () => {
    const editor = renderEditor({ http_status: [200, 201] }, true);
    expect(screen.getByRole("combobox", { name: title("allowedStatuses") })).toBeDisabled();
    expect(document.querySelector(".ant-select-selection-item-remove")).toBeNull();
    expect(editor.changed).not.toHaveBeenCalled();
  });
});
