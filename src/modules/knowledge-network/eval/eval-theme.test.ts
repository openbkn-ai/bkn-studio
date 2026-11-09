/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "EvalWorkspaceScene.module.css"), "utf8");
const comparisonCss = readFileSync(
  resolve(__dirname, "EvalAgentComparisonWorkspace.module.css"),
  "utf8",
);
const resultCss = readFileSync(resolve(__dirname, "EvalAgentComparisonResult.module.css"), "utf8");
const resourceCss = readFileSync(
  resolve(__dirname, "EvalOverviewResourcesPanel.module.css"),
  "utf8",
);
const systemCss = readFileSync(resolve(__dirname, "../../../styles/global.css"), "utf8");

// JSDOM does not resolve CSS variables; browser checks cover computed colors.
describe("Eval theme contract", () => {
  it("uses only semantic colors defined in both system themes", () => {
    expect(css + comparisonCss + resultCss + resourceCss).not.toMatch(
      /#[0-9a-f]{3,8}\b|rgba?\(|data-theme/i,
    );
    const light = systemCss.split(":root {")[1].split("\n}")[0];
    const dark = systemCss.split(':root[data-theme="dark"] {')[1].split("\n}")[0];
    for (const [, token] of (css + comparisonCss + resultCss + resourceCss).matchAll(
      /var\((--(?:color|shadow)-[\w-]+)\)/g,
    )) {
      expect(light).toContain(`${token}:`);
      expect(dark).toContain(`${token}:`);
    }
  });

  it("keeps the workspace, navigation, and summary on the knowledge-network surface", () => {
    for (const selector of [
      ".root",
      ".tabs > :global(.ant-tabs-nav)",
      ".overviewMetrics > button",
    ]) {
      const rule = css.split(`${selector} {`)[1].split("}")[0];
      expect(rule).toContain("background: var(--color-bg-surface)");
    }
    expect(css).toContain("color: var(--color-text-primary)");
    expect(css).toContain(".overviewMetrics > button:focus-visible");
    expect(css).toContain("outline: 2px solid var(--color-primary-600)");
  });
});
