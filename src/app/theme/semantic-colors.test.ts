/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  createSemanticColors,
  defaultSemanticColors,
  semanticColorVariableNames,
} from "@/app/theme/semantic-colors";

describe("semantic colors", () => {
  it.each(["light", "dark"] as const)(
    "keeps every primary action state above the WCAG AA text contrast in %s mode",
    (mode) => {
      const colors = defaultSemanticColors[mode];

      expect(contrastRatio(colors.actionPrimaryText, colors.actionPrimary)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(colors.actionPrimaryText, colors.actionPrimaryHover),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.actionPrimaryText, colors.actionPrimaryActive),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ["light", "#ffffff"],
    ["dark", "#111318"],
  ] as const)("keeps links readable on the %s page surface", (mode, surface) => {
    const colors = defaultSemanticColors[mode];

    expect(contrastRatio(colors.link, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.linkHover, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["#facc15", "#ff00ff", "#777777"])(
    "derives accessible action and accent roles from the custom brand color %s",
    (brandColor) => {
      for (const mode of ["light", "dark"] as const) {
        const colors = createSemanticColors(brandColor, mode);
        const surface = mode === "dark" ? "#111318" : "#ffffff";

        for (const actionColor of [
          colors.actionPrimary,
          colors.actionPrimaryHover,
          colors.actionPrimaryActive,
        ]) {
          expect(contrastRatio(colors.actionPrimaryText, actionColor)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrastRatio(colors.link, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.linkHover, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("keeps the static first-paint CSS defaults aligned with the TypeScript token source", () => {
    const globalCss = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");
    const lightBlock = globalCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
    const darkBlock = globalCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1];

    expect(lightBlock).toBeDefined();
    expect(darkBlock).toBeDefined();

    for (const [mode, block] of [
      ["light", lightBlock],
      ["dark", darkBlock],
    ] as const) {
      for (const [name, variable] of Object.entries(semanticColorVariableNames)) {
        const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cssValue = block?.match(new RegExp(`${escapedVariable}:\\s*([^;]+)`))?.[1].trim();

        expect(cssValue, `${mode} ${variable}`).toBe(
          defaultSemanticColors[mode][name as keyof (typeof defaultSemanticColors)[typeof mode]],
        );
      }
    }
  });

  it("keeps shared business surfaces and migrated controls on semantic interaction roles", () => {
    const readStyle = (relativePath: string) =>
      readFileSync(resolve(process.cwd(), relativePath), "utf8");
    const businessTemplate = readStyle("src/framework/ui/common/BusinessPageTemplate.module.css");
    const adminTemplate = readStyle("src/modules/system-admin/scenes/admin.module.css");
    const conversation = readStyle(
      "src/modules/knowledge-network/components/shared/AiConversationPanel.module.css",
    );
    const objectMetricForm = readStyle(
      "src/modules/knowledge-network/scenes/ObjectMetricFormScene.tsx",
    );
    const jsonEditor = readStyle("src/modules/execution-factory/components/JsonEditor.module.css");
    const resourceDetail = readStyle(
      "src/modules/data-catalog/components/ResourceDetailPanel.module.css",
    );

    expect(businessTemplate).toContain("--business-color-primary: var(--color-action-primary);");
    expect(businessTemplate).toContain(
      "--business-color-selection: var(--color-selection-accent);",
    );
    expect(adminTemplate).toContain("--admin-color-primary: var(--color-selection-accent);");
    expect(objectMetricForm).toContain("<AiConversationPanel");
    expect(conversation).toContain("background: var(--color-action-primary);");
    expect(conversation).toContain("color: var(--color-action-primary-text);");
    expect(conversation).not.toMatch(/#[0-9a-f]{3,8}\b|data-theme/i);
    expect(jsonEditor).toContain("border-color: var(--color-focus-ring);");
    expect(resourceDetail.match(/border-color: var\(--color-focus-ring\);/g)).toHaveLength(2);
  });
});
