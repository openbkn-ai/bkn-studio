/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// rc-util probes this pseudo-element when measuring scrollbars. jsdom cannot
// compute pseudo-element styles and otherwise emits a warning on every probe.
const nativeGetComputedStyle = window.getComputedStyle.bind(window);
const getComputedStyleWithScrollbarFallback: typeof window.getComputedStyle = (
  element,
  pseudoElt,
) => nativeGetComputedStyle(element, pseudoElt === "::-webkit-scrollbar" ? undefined : pseudoElt);
window.getComputedStyle = getComputedStyleWithScrollbarFallback;
globalThis.getComputedStyle = getComputedStyleWithScrollbarFallback;

// antd's CSS-in-JS injects thousands of rules into <head>. jsdom answers every
// getComputedStyle() by matching each of those rules against the element, and
// Testing Library asks for it on every node when a *ByRole query resolves an
// accessible name, so scene tests spent ~90% of their time in selector
// matching. Tests assert behaviour, not antd's look, so the style nodes that
// rc-util injects (always tagged with data-rc-order before the CSS is written)
// are kept empty. Styles a test writes itself are left alone.
const styleInnerHtml = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
// The native accessors are re-invoked below with the style element as `this`.
// eslint-disable-next-line @typescript-eslint/unbound-method
const { get: readInnerHtml, set: writeInnerHtml } = styleInnerHtml ?? {};
if (readInnerHtml && writeInnerHtml) {
  Object.defineProperty(HTMLStyleElement.prototype, "innerHTML", {
    configurable: true,
    enumerable: true,
    get(this: HTMLStyleElement) {
      return readInnerHtml.call(this) as string;
    },
    set(this: HTMLStyleElement, value: string) {
      writeInnerHtml.call(this, this.hasAttribute("data-rc-order") ? "" : value);
    },
  });
}

// The one thing tests do rely on from antd's CSS: a closed dropdown, tooltip,
// popover, drawer or inactive tab pane stays in the DOM and is only hidden by
// a state class. Keep those rules so closed overlays stay out of *ByRole
// queries and toBeVisible() keeps its meaning. The list mirrors the
// `display: none` state classes in antd's component styles.
const antdHiddenStateClasses = [
  "ant-collapse-content-hidden",
  "ant-drawer-content-wrapper-hidden",
  "ant-dropdown-hidden",
  "ant-dropdown-menu-hidden",
  "ant-dropdown-menu-submenu-hidden",
  "ant-mentions-dropdown-hidden",
  "ant-menu-hidden",
  "ant-menu-submenu-hidden",
  "ant-modal-mask-hidden",
  "ant-picker-dropdown-hidden",
  "ant-popover-hidden",
  "ant-select-dropdown-hidden",
  "ant-tabs-dropdown-hidden",
  "ant-tabs-tabpane-hidden",
  "ant-tag-hidden",
  "ant-tooltip-hidden",
  "ant-tour-hidden",
  "ant-upload-hidden",
];
const antdHiddenState = document.createElement("style");
antdHiddenState.dataset.testAntdHiddenState = "";
antdHiddenState.textContent = `${antdHiddenStateClasses
  .map((name) => `.${name}`)
  .join(", ")} { display: none; }`;
document.head.append(antdHiddenState);

afterEach(() => {
  cleanup();
});
