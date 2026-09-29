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

const query = { page: 1, pageSize: 20 };

describe("execution-factory audit user name mapping", () => {
  beforeEach(() => {
    getMock.mockReset();
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves names returned in the existing user fields", async () => {
    const { listOperators } = await import("@/modules/execution-factory/services/operator.service");

    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            operator_id: "operator-a",
            name: "Operator A",
            version: "1.0.0",
            create_user: "Alice Zhang",
            update_user: "Bob Li",
            release_user: "Carol Wang",
          },
        ],
        total: 1,
      },
    });

    expect((await listOperators(query)).items[0]).toMatchObject({
      createUser: "Alice Zhang",
      updateUser: "Bob Li",
      releaseUser: "Carol Wang",
    });
  });

  it("maps user name snapshots for operators, toolboxes, MCPs, skills, and tools", async () => {
    const { listOperators } = await import("@/modules/execution-factory/services/operator.service");
    const { listToolboxes } = await import("@/modules/execution-factory/services/toolbox.service");
    const { listMcps } = await import("@/modules/execution-factory/services/mcp.service");
    const { listSkills } = await import("@/modules/execution-factory/services/skill.service");
    const { listTools } = await import("@/modules/execution-factory/services/tool.service");

    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              operator_id: "operator-a",
              name: "Operator A",
              version: "1.0.0",
              create_user: "user-a",
              create_user_name: "Alice",
              update_user: "user-b",
              update_user_name: "Bob",
              release_user: "user-c",
              release_user_name: "Carol",
            },
          ],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              box_id: "box-a",
              box_name: "Box A",
              create_user: "user-a",
              create_user_name: "Alice",
              update_user: "user-b",
              update_user_name: "Bob",
              release_user: "user-c",
              release_user_name: "Carol",
            },
          ],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              mcp_id: "mcp-a",
              name: "MCP A",
              create_user: "user-a",
              create_user_name: "Alice",
              update_user: "user-b",
              update_user_name: "Bob",
              release_user: "user-c",
              release_user_name: "Carol",
            },
          ],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              skill_id: "skill-a",
              name: "Skill A",
              create_user: "user-a",
              create_user_name: "Alice",
              update_user: "user-b",
              update_user_name: "Bob",
              release_user: "user-c",
              release_user_name: "Carol",
            },
          ],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          box_id: "box-a",
          tools: [
            {
              tool_id: "tool-a",
              name: "Tool A",
              create_user: "user-a",
              create_user_name: "Alice",
              update_user: "user-b",
              update_user_name: "Bob",
            },
          ],
          total: 1,
        },
      });

    const operator = (await listOperators(query)).items[0];
    const toolbox = (await listToolboxes(query)).items[0];
    const mcp = (await listMcps(query)).items[0];
    const skill = (await listSkills(query)).items[0];
    const tool = (await listTools("box-a", query)).items[0];

    for (const record of [operator, toolbox, mcp, skill]) {
      expect(record).toMatchObject({
        createUserName: "Alice",
        updateUserName: "Bob",
        releaseUserName: "Carol",
      });
    }
    expect(tool).toMatchObject({ createUserName: "Alice", updateUserName: "Bob" });
  });
});
