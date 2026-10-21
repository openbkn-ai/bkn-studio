/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type * as Monaco from "monaco-editor";

export const MONACO_LIGHT_THEME = "bkn-code-light";
export const MONACO_DARK_THEME = "bkn-code-dark";

export function monacoThemeFor(resolvedTheme: "dark" | "light") {
  return resolvedTheme === "dark" ? MONACO_DARK_THEME : MONACO_LIGHT_THEME;
}

/**
 * Monaco's built-in vs / vs-dark themes use pure white and near-black backgrounds that clash with
 * the console's gray layers. These keep the editor on the same surface scale as the cards around it.
 */
export function defineMonacoThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme(MONACO_LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      // A faint inset gray (slate-50) so the editor reads as a field inside white cards.
      "editor.background": "#f8fafc",
      "editorGutter.background": "#f8fafc",
      "editorLineNumber.foreground": "#c3ccdb",
      "editorLineNumber.activeForeground": "#64748b",
      "editor.lineHighlightBackground": "#f1f5f9",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#eaeef6",
      "editorIndentGuide.activeBackground1": "#cfd8e8",
    },
  });

  monaco.editor.defineTheme(MONACO_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      // Matches --color-bg-raised / --color-bg-surface / --color-hover in global.css.
      "editor.background": "#1d2027",
      "editorGutter.background": "#1d2027",
      "editorLineNumber.foreground": "#565d69",
      "editorLineNumber.activeForeground": "#a8afba",
      "editor.lineHighlightBackground": "#23262d",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#2b2f37",
      "editorIndentGuide.activeBackground1": "#454b56",
      "editorWidget.background": "#20232a",
      "editorSuggestWidget.background": "#20232a",
      "editorSuggestWidget.border": "#2b2f37",
      "editorHoverWidget.background": "#20232a",
      "editorHoverWidget.border": "#2b2f37",
    },
  });
}
