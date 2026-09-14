/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("execution-unit list operation mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves object operations for every execution-unit list", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [{ name: "Operator", operator_id: "operator-1", operations: ["authorize"], version: "1" }],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: { data: [{ box_id: "toolbox-1", box_name: "Toolbox", operations: ["authorize"] }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ mcp_id: "mcp-1", name: "MCP", operations: ["authorize"] }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ skill_id: "skill-1", name: "Skill", operations: ["authorize"] }], total: 1 },
      });

    const [{ listOperators }, { listToolboxes }, { listMcps }, { listSkills }] = await Promise.all([
      import("./operator.service"),
      import("./toolbox.service"),
      import("./mcp.service"),
      import("./skill.service"),
    ]);

    const [operators, toolboxes, mcps, skills] = await Promise.all([
      listOperators({ page: 1, pageSize: 20 }),
      listToolboxes({ page: 1, pageSize: 20 }),
      listMcps({ page: 1, pageSize: 20 }),
      listSkills({ page: 1, pageSize: 20 }),
    ]);

    expect(operators.items[0]?.operations).toEqual(["authorize"]);
    expect(toolboxes.items[0]?.operations).toEqual(["authorize"]);
    expect(mcps.items[0]?.operations).toEqual(["authorize"]);
    expect(skills.items[0]?.operations).toEqual(["authorize"]);
  });
});
