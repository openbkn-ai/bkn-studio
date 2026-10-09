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
  it.each([".attempt pre", ".answerDocument :global(pre)", ".timeInspector pre"])(
    "%s separates code from the surrounding light surface",
    (selector) => {
      const css = readFileSync(
        "src/modules/bkn-trace/evidence-chain/BusinessProvenance016.module.css",
        "utf8",
      );
      const rule = css.split(`${selector} {`)[1]?.split("}")[0];
      expect(rule).toBeDefined();
      expect(rule).toMatch(/\bborder:\s*1px solid var\(--color-border\)/);
    },
  );

  it("keeps technical step outlines quieter than secondary text", () => {
    const css = readFileSync(
      "src/modules/bkn-trace/evidence-chain/BusinessProvenance016.module.css",
      "utf8",
    );
    const rule = css.split(".graphNode.node_step {")[1]?.split("}")[0];
    expect(rule).toBeDefined();
    expect(rule).not.toMatch(/border-color:\s*var\(--color-text-(?:primary|secondary)\)/);
  });
});
