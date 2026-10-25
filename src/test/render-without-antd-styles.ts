/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { StyleProvider } from "@ant-design/cssinjs";
import { render, type RenderOptions } from "@testing-library/react";
import { createElement, type PropsWithChildren, type ReactElement } from "react";

// Ant Design injects its CSS-in-JS rules as <style> tags (about 480 KB for one
// page with a form, date pickers and a table). jsdom matches every rule on each
// getComputedStyle call, and Testing Library calls it for every candidate
// element and its ancestors in a non-hidden *ByRole query, so a single query
// takes seconds and a polling findByRole can exceed the test timeout under CI
// load. Server mode keeps the rules in the style cache instead of the document.
// Hidden checks still see the hidden attribute, aria-hidden and inline styles.
// A caller's own wrapper renders inside the provider instead of replacing it.
export function renderWithoutAntdStyles(ui: ReactElement, options?: RenderOptions) {
  const { wrapper: Outer, ...rest } = options ?? {};
  function WithoutAntdStyles({ children }: PropsWithChildren) {
    return createElement(
      StyleProvider,
      { mock: "server" },
      Outer ? createElement(Outer, null, children) : children,
    );
  }
  return render(ui, { ...rest, wrapper: WithoutAntdStyles });
}
