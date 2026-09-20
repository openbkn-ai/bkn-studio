/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseVersion = readFileSync(join(root, "VERSION"), "utf8").trim();
const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
  throw new Error(
    `VERSION must be a stable X.Y.Z version; received ${JSON.stringify(releaseVersion)}.`,
  );
}

const prereleasePattern = new RegExp(
  `^${releaseVersion.replaceAll(".", "\\.")}-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*$`,
);

if (packageVersion !== releaseVersion && !prereleasePattern.test(packageVersion)) {
  throw new Error(
    `package.json version ${JSON.stringify(packageVersion)} must equal VERSION ${JSON.stringify(releaseVersion)} or use it as a prerelease prefix (for example, 0.1.5-rc.1).`,
  );
}

console.log(
  `version consistency passed: VERSION=${releaseVersion}, package.json=${packageVersion}`,
);
