/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { cloneToolboxImpexForCreate } from "../../helpers/impex";

test.describe("impex helper payload cloning", () => {
  test("keeps cloned OpenAPI tool source_id aligned with metadata version", () => {
    const cloned = cloneToolboxImpexForCreate(
      {
        toolbox: {
          configs: [
            {
              box_id: "source-box",
              box_name: "source toolbox",
              tools: [
                {
                  tool_id: "source-tool",
                  box_id: "source-box",
                  source_type: "openapi",
                  source_id: "source-metadata-version",
                  metadata: {
                    version: "source-metadata-version",
                    summary: "source tool",
                  },
                },
              ],
            },
          ],
        },
      },
      "cloned toolbox",
    ) as {
      toolbox: {
        configs: Array<{
          tools: Array<{
            source_id?: string;
            metadata?: { version?: string };
          }>;
        }>;
      };
    };

    const clonedTool = cloned.toolbox.configs[0].tools[0];
    expect(clonedTool.metadata?.version).not.toBe("source-metadata-version");
    expect(clonedTool.source_id).toBe(clonedTool.metadata?.version);
  });
});
