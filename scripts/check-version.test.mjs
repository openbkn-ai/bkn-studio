/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

describe("the package version contract", () => {
  const roots = [];
  const checker = join(dirname(fileURLToPath(import.meta.url)), "check-version.mjs");

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  const check = (packageVersion) => {
    const root = mkdtempSync(join(tmpdir(), "bkn-studio-version-"));
    roots.push(root);
    mkdirSync(join(root, "scripts"));
    cpSync(checker, join(root, "scripts/check-version.mjs"));
    writeFileSync(join(root, "VERSION"), "0.1.5\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: packageVersion }));
    return spawnSync(process.execPath, [join(root, "scripts/check-version.mjs")], {
      encoding: "utf8",
    });
  };

  it.each(["0.1.5", "0.1.5-rc1", "0.1.5-rc.1"])("accepts %s", (version) => {
    expect(check(version).status).toBe(0);
  });

  it.each(["0.1.5-", "0.1.5-_x", "0.1.6-rc.1"])("rejects %s", (version) => {
    const result = check(version);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must equal VERSION");
  });
});
