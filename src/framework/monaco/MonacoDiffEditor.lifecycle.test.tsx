/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DiffEditor, loader } from "@monaco-editor/react";
import { cleanup, render, waitFor } from "@testing-library/react";
import type * as Monaco from "monaco-editor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the installed React adapter, including its own unmount cleanup.
// The model mock enforces Monaco's rule that an attached model cannot be disposed.
type Model = { text: string; dispose: ReturnType<typeof vi.fn>; setValue: (text: string) => void };
type Pair = { original: Model; modified: Model };
const events: string[] = [];
const models: Model[] = [];
const editors: { getModel: () => Pair | null; dispose: ReturnType<typeof vi.fn> }[] = [];

function createEditor() {
  let pair: Pair | null = null;
  const editor = {
    getModel: () => pair,
    setModel: (next: Pair | null) => {
      pair = next;
      events.push(next ? "attach" : "detach");
    },
    getOriginalEditor: () => ({ getModel: () => pair?.original }),
    getModifiedEditor: () => ({
      getModel: () => pair?.modified,
      getOption: () => true,
      setValue: (text: string) => pair?.modified.setValue(text),
    }),
    updateOptions: vi.fn(),
    dispose: vi.fn(() => {
      events.push("editor");
      pair = null;
    }),
  };
  editors.push(editor);
  return editor;
}

const monaco = {
  Uri: { parse: (path: string) => path },
  editor: {
    EditorOption: { readOnly: 0 },
    createDiffEditor: createEditor,
    getModel: () => null,
    createModel: (text: string) => {
      const name = `model-${models.length}`;
      const model: Model = {
        text,
        setValue: (next: string) => {
          model.text = next;
        },
        dispose: vi.fn(() => {
          if (editors.some((editor) => Object.values(editor.getModel() ?? {}).includes(model)))
            throw new Error("TextModel got disposed before DiffEditorWidget model got reset");
          events.push(name);
        }),
      };
      models.push(model);
      return model;
    },
    setTheme: vi.fn(),
    setModelLanguage: vi.fn(),
  },
};
loader.config({ monaco: monaco as unknown as typeof Monaco });

beforeEach(() => {
  models.length = 0;
  editors.length = 0;
  events.length = 0;
});
afterEach(cleanup);

describe("Monaco DiffEditor model lifecycle (#2461)", () => {
  it.each([
    { keepCurrentOriginalModel: false, keepCurrentModifiedModel: false },
    { keepCurrentOriginalModel: true, keepCurrentModifiedModel: false },
    { keepCurrentOriginalModel: false, keepCurrentModifiedModel: true },
    { keepCurrentOriginalModel: true, keepCurrentModifiedModel: true },
  ])("detaches before disposing with retention flags %j", async (props) => {
    const mounted = vi.fn();
    const view = render(
      <DiffEditor original="Before" modified="After" onMount={mounted} {...props} />,
    );
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));

    view.unmount();

    expect(events[1]).toBe("detach");
    expect(models[0].dispose).toHaveBeenCalledTimes(props.keepCurrentOriginalModel ? 0 : 1);
    expect(models[1].dispose).toHaveBeenCalledTimes(props.keepCurrentModifiedModel ? 0 : 1);
    expect(editors[0].dispose).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toBe("editor");
  });

  it("releases both models on every open and close cycle", async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const mounted = vi.fn();
      const view = render(<DiffEditor original="Before" modified="After" onMount={mounted} />);
      await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
      view.unmount();
    }
    expect(models).toHaveLength(6);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
    for (const editor of editors) expect(editor.dispose).toHaveBeenCalledTimes(1);
  });

  it("updates compared content and releases the current models on close", async () => {
    const mounted = vi.fn();
    const view = render(<DiffEditor original="v1" modified="v2" onMount={mounted} />);
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
    view.rerender(<DiffEditor original="v3" modified="v4" onMount={mounted} />);
    expect(models.map((model) => model.text)).toEqual(["v3", "v4"]);
    view.unmount();
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
  });

  it("can close before editor creation without allocating models", () => {
    const view = render(<DiffEditor original="Before" modified="After" />);
    view.unmount();
    expect(models).toHaveLength(0);
    expect(editors).toHaveLength(0);
  });
});
