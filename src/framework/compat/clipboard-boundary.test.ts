/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return /\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test.")
      ? [entryPath]
      : [];
  });
}

describe("clipboard compatibility boundary", () => {
  it("keeps direct Clipboard API access inside the compatibility adapter", () => {
    const sourceRoot = path.resolve("src");
    const adapterPath = path.resolve("src/framework/compat/clipboard.ts");
    const violations = sourceFiles(sourceRoot)
      .filter((file) => file !== adapterPath)
      .flatMap((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            line.includes("navigator.clipboard")
              ? [`${path.relative(sourceRoot, file)}:${index + 1}`]
              : [],
          ),
      );

    expect(violations).toEqual([]);
  });
});
