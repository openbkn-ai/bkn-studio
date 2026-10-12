/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const BUSINESS_MODULES = ["execution-factory", "execution-factory-lab", "bkn-trace"];

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSources(path);
    }

    if (!/\.tsx?$/.test(entry.name) || /\.(?:test|spec|stories)\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [path];
  });
}

describe("business audit user boundary", () => {
  it("does not depend on the administrator user directory", () => {
    const files = BUSINESS_MODULES.flatMap((moduleName) =>
      productionSources(join(process.cwd(), "src/modules", moduleName)),
    );
    const violations = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("useAuditUserDirectory") ||
        source.includes("@/modules/system-admin/services/admin.service") ||
        source.includes("/admin/users")
        ? [path]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
