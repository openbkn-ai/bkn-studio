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

afterEach(() => {
  cleanup();
});
