/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  "src/modules/knowledge-network/scenes/KnowledgeNetworkListScene.module.css",
  "utf8",
);

describe("KnowledgeNetworkListScene page surface", () => {
  it("keeps the shared page background visible around the business surface", () => {
    expect(styles).toContain(
      'composes: surface from "../../../framework/ui/common/BusinessPageTemplate.module.css";',
    );
    expect(styles).not.toContain(":global(.workspace-shell):has(.page)");
  });
});
