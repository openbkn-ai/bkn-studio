/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { StrictMode, useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Monaco } from "@monaco-editor/react";
import { CodeEditor } from "./CodeEditor";

const { defaults } = vi.hoisted(() => {
  const defaults = {
    diagnosticsOptions: {
      validate: true,
      allowComments: false,
      schemas: [{ uri: "external", fileMatch: ["external.json"], schema: { type: "string" } }],
    },
    setDiagnosticsOptions: vi.fn(),
  };
  defaults.setDiagnosticsOptions.mockImplementation((value) => {
    defaults.diagnosticsOptions = value as typeof defaults.diagnosticsOptions;
  });
  return { defaults };
});
vi.mock("@/framework/monaco/MonacoEditor", () => ({
  MonacoEditor: ({
    beforeMount,
    path,
    value,
    onChange,
    options,
  }: {
    beforeMount: (monaco: Monaco) => void;
    path?: string;
    value: string;
    onChange: (value: string) => void;
    options: { ariaLabel?: string; readOnly?: boolean };
  }) => {
    useEffect(() => {
      beforeMount({ languages: { json: { jsonDefaults: defaults } } } as unknown as Monaco);
    }, [beforeMount]);
    return (
      <textarea
        data-model={path}
        aria-label={options.ariaLabel}
        value={value}
        readOnly={options.readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));

describe("shared code editor schema lifecycle", () => {
  it("isolates schemas and models, updates one instance, and preserves external registrations on unmount", async () => {
    const schemaA = { type: "object", properties: { a: { type: "string" } } };
    const schemaB = { type: "object", properties: { b: { type: "integer" } } };
    const first = render(<CodeEditor language="json" ariaLabel="first" jsonSchema={schemaA} />);
    const second = render(<CodeEditor language="json" ariaLabel="second" jsonSchema={schemaB} />);
    const plain = render(<CodeEditor language="json" ariaLabel="plain" />);
    await waitFor(() => expect(defaults.diagnosticsOptions.schemas).toHaveLength(3));
    const paths = screen.getAllByRole("textbox").map((node) => node.getAttribute("data-model"));
    expect(new Set(paths).size).toBe(3);
    first.rerender(<CodeEditor language="json" ariaLabel="first" jsonSchema={{ type: "array" }} />);
    expect(defaults.diagnosticsOptions.schemas.map((s) => s.schema)).toContainEqual(schemaB);
    expect(defaults.diagnosticsOptions.schemas.map((s) => s.schema)).toContainEqual({
      type: "array",
    });
    first.rerender(<CodeEditor language="json" ariaLabel="first" />);
    expect(defaults.diagnosticsOptions.schemas).toHaveLength(2);
    plain.unmount();
    expect(defaults.diagnosticsOptions.schemas).toHaveLength(2);
    first.unmount();
    second.unmount();
    expect(defaults.diagnosticsOptions.schemas).toEqual([
      { uri: "external", fileMatch: ["external.json"], schema: { type: "string" } },
    ]);
    expect(defaults.diagnosticsOptions.allowComments).toBe(false);
  });
  it("preserves JSON text while editing and does not leak registrations under StrictMode", async () => {
    const changed = vi.fn();
    const view = render(
      <StrictMode>
        <CodeEditor
          language="json"
          ariaLabel="value"
          jsonSchema={{ type: "object" }}
          value="{}"
          onChange={changed}
        />
      </StrictMode>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "value" }), {
      target: { value: '{"id":9007199254740993,' },
    });
    expect(changed).toHaveBeenLastCalledWith('{"id":9007199254740993,');
    await waitFor(() => expect(defaults.diagnosticsOptions.schemas).toHaveLength(2));
    view.unmount();
    expect(defaults.diagnosticsOptions.schemas).toHaveLength(1);
  });
});
