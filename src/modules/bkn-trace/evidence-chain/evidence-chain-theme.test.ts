/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// JSDOM does not resolve theme variables. Guard the local stylesheet contract;
// computed colors and contrast are verified in a real browser.
describe("evidence chain theme surfaces", () => {
  it.each(["BusinessProvenance016", "CurrentExplanationPanel"])(
    "%s keeps colors in the semantic theme system",
    (name) => {
      const css = readFileSync(`src/modules/bkn-trace/evidence-chain/${name}.module.css`, "utf8");
      const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(declarations).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
      expect(declarations).not.toMatch(/data-theme/);
    },
  );
});
