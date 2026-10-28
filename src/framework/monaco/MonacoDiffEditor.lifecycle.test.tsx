/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@/app/theme/theme-context";

import { MonacoDiffEditor } from "./MonacoDiffEditor";

const { ensureSetup } = vi.hoisted(() => ({ ensureSetup: vi.fn<() => Promise<void>>() }));
vi.mock("./ensure", () => ({ ensureMonacoSetup: ensureSetup }));
vi.mock("monaco-editor/esm/vs/editor/editor.api.js", () => ({ editor: mockMonaco.editor }));

type Model = {
  text: string;
  language: string;
  getValue: () => string;
  setValue: (text: string) => void;
  getLanguageId: () => string;
  dispose: ReturnType<typeof vi.fn>;
};
type Pair = { original: Model; modified: Model };
const events: string[] = [];
const models: Model[] = [];
const editors: {
  getModel: () => Pair | null;
  dispose: ReturnType<typeof vi.fn>;
  updateOptions: ReturnType<typeof vi.fn>;
}[] = [];

const mockMonaco = {
  editor: {
    createModel: vi.fn((text: string, language: string) => {
      const name = `model-${models.length}`;
      const model: Model = {
        text,
        language,
        getValue: () => model.text,
        setValue: (next) => {
          model.text = next;
        },
        getLanguageId: () => model.language,
        dispose: vi.fn(() => {
          if (editors.some((editor) => Object.values(editor.getModel() ?? {}).includes(model)))
            throw new Error("TextModel got disposed before DiffEditorWidget model got reset");
          events.push(name);
        }),
      };
      models.push(model);
      return model;
    }),
    createDiffEditor: vi.fn(() => {
      let pair: Pair | null = null;
      const editor = {
        getModel: () => pair,
        setModel: (next: Pair | null) => {
          pair = next;
          events.push(next ? "attach" : "detach");
        },
        updateOptions: vi.fn(),
        dispose: vi.fn(() => {
          events.push("editor");
          pair = null;
        }),
      };
      editors.push(editor);
      return editor;
    }),
    setTheme: vi.fn(),
    setModelLanguage: vi.fn((model: Model, language: string) => {
      model.language = language;
    }),
  },
};

beforeEach(() => {
  models.length = 0;
  editors.length = 0;
  events.length = 0;
  vi.clearAllMocks();
  ensureSetup.mockResolvedValue();
});
afterEach(cleanup);

describe("our Monaco DiffEditor lifecycle (#2461)", () => {
  it("does not create an editor when closed before Monaco loads", async () => {
    let finish!: () => void;
    ensureSetup.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(<MonacoDiffEditor fallback="Loading comparison" />);
    expect(screen.getByText("Loading comparison")).toBeTruthy();
    view.unmount();
    await act(async () => {
      finish();
      await import("./MonacoDiffEditorImpl");
    });
    expect(models).toHaveLength(0);
    expect(editors).toHaveLength(0);
  });

  it("detaches and disposes the editor before releasing its models exactly once", async () => {
    const mounted = vi.fn();
    const view = render(<MonacoDiffEditor original="Before" modified="After" onMount={mounted} />);
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(events).toEqual(["attach", "detach", "editor", "model-0", "model-1"]);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(editors[0].dispose).toHaveBeenCalledTimes(1);
  });

  it("releases both models on every open and close cycle", async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const mounted = vi.fn();
      const view = render(
        <MonacoDiffEditor original="Before" modified="After" onMount={mounted} />,
      );
      await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
      view.unmount();
    }
    expect(models).toHaveLength(6);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
    for (const editor of editors) expect(editor.dispose).toHaveBeenCalledTimes(1);
  });

  it("updates texts, language, options and dimensions without recreating models", async () => {
    const mounted = vi.fn();
    const view = render(<MonacoDiffEditor original="v1" modified="v2" onMount={mounted} />);
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
    view.rerender(
      <MonacoDiffEditor
        original="v3"
        modified="v4"
        language="json"
        options={{ readOnly: true }}
        height={420}
        width={600}
        onMount={mounted}
      />,
    );
    expect(models.map((model) => model.text)).toEqual(["v3", "v4"]);
    expect(models.map((model) => model.language)).toEqual(["json", "json"]);
    expect(models).toHaveLength(2);
    expect(editors).toHaveLength(1);
    expect(editors[0].updateOptions).toHaveBeenLastCalledWith({
      automaticLayout: true,
      readOnly: true,
    });
    expect(view.container.firstElementChild?.getAttribute("style")).toContain("height: 420px");
    expect(view.container.firstElementChild?.getAttribute("style")).toContain("width: 600px");
    view.unmount();
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
  });

  it("applies theme changes without replacing the editor", async () => {
    const mounted = vi.fn();
    const view = render(
      <ThemeContext value="light">
        <MonacoDiffEditor onMount={mounted} />
      </ThemeContext>,
    );
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
    expect(mockMonaco.editor.setTheme).toHaveBeenLastCalledWith("bkn-code-light");
    view.rerender(
      <ThemeContext value="dark">
        <MonacoDiffEditor onMount={mounted} />
      </ThemeContext>,
    );
    expect(mockMonaco.editor.setTheme).toHaveBeenLastCalledWith("bkn-code-dark");
    expect(editors).toHaveLength(1);
  });

  it("releases every StrictMode mount without double-disposing a resource", async () => {
    const mounted = vi.fn();
    const view = render(
      <StrictMode>
        <MonacoDiffEditor onMount={mounted} />
      </StrictMode>,
    );
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(models).toHaveLength(4);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
    for (const editor of editors) expect(editor.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases models if editor creation fails", () => {
    mockMonaco.editor.createDiffEditor.mockImplementationOnce(() => {
      throw new Error("Creation failed");
    });
    expect(() => render(<MonacoDiffEditor />)).toThrow("Creation failed");
    expect(models).toHaveLength(2);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases the editor and models if the mount callback throws", () => {
    expect(() =>
      render(
        <MonacoDiffEditor
          onMount={() => {
            throw new Error("Mount failed");
          }}
        />,
      ),
    ).toThrow("Mount failed");
    expect(models).toHaveLength(2);
    expect(editors[0].dispose).toHaveBeenCalledTimes(1);
    for (const model of models) expect(model.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases partially created models if the second model cannot be created", () => {
    mockMonaco.editor.createModel
      .mockImplementationOnce((text, language) => {
        const model: Model = {
          text,
          language,
          getValue: () => text,
          setValue: vi.fn(),
          getLanguageId: () => language,
          dispose: vi.fn(),
        };
        models.push(model);
        return model;
      })
      .mockImplementationOnce(() => {
        throw new Error("Model creation failed");
      });
    expect(() => render(<MonacoDiffEditor />)).toThrow("Model creation failed");
    expect(models).toHaveLength(1);
    expect(models[0].dispose).toHaveBeenCalledTimes(1);
    expect(editors).toHaveLength(0);
  });
});
