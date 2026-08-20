/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("prototype production boundary", () => {
  it("keeps review prototypes out of Vite public assets", () => {
    const publicFiles = fs.readdirSync(path.resolve("public"));

    expect(publicFiles.some((file) => file.includes("prototype"))).toBe(false);
  });
});
