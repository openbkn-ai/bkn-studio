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
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves object operations for every execution-unit list", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [{ box_id: "toolbox-1", box_name: "Toolbox", operations: ["authorize"] }],
          total: 1,
        },
      })
      .mockResolvedValueOnce({
        data: { data: [{ mcp_id: "mcp-1", name: "MCP", operations: ["authorize"] }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ skill_id: "skill-1", name: "Skill", operations: ["authorize"] }],
          total: 1,
        },
      });

    const [{ listToolboxes }, { listMcps }, { listSkills }] = await Promise.all([
      import("./toolbox.service"),
      import("./mcp.service"),
      import("./skill.service"),
    ]);

    const [toolboxes, mcps, skills] = await Promise.all([
      listToolboxes({ page: 1, pageSize: 20 }),
      listMcps({ page: 1, pageSize: 20 }),
      listSkills({ page: 1, pageSize: 20 }),
    ]);

    expect(toolboxes.items[0]?.operations).toEqual(["authorize"]);
    expect(mcps.items[0]?.operations).toEqual(["authorize"]);
    expect(skills.items[0]?.operations).toEqual(["authorize"]);
  });

  it("preserves server operations in detail responses despite a viewer mock selector", async () => {
    getMock
      .mockResolvedValueOnce({
        data: { box_id: "toolbox-1", box_name: "Toolbox", operations: ["modify"] },
      })
      .mockResolvedValueOnce({
        data: { base_info: { mcp_id: "mcp-1", name: "MCP", operations: ["execute"] } },
      })
      .mockResolvedValueOnce({
        data: { skill_id: "skill-1", name: "Skill", operations: ["authorize"] },
      });
    const [{ getToolbox }, { getMcpDetail }, { getSkill }] = await Promise.all([
      import("./toolbox.service"),
      import("./mcp.service"),
      import("./skill.service"),
    ]);

    const [toolbox, mcp, skill] = await Promise.all([
      getToolbox("toolbox-1"),
      getMcpDetail("mcp-1"),
      getSkill("skill-1"),
    ]);

    expect(toolbox.operations).toEqual(["modify"]);
    expect(mcp.operations).toEqual(["execute"]);
    expect(skill.operations).toEqual(["authorize"]);
  });
});

describe("mock execution-unit operation scenarios", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits management and market lists to read operations without changing admin fixtures", async () => {
    const [
      { listToolboxes, listToolboxMarket },
      { listMcps, listMcpMarket },
      { listSkills, listSkillMarket },
    ] = await Promise.all([
      import("./toolbox.service"),
      import("./mcp.service"),
      import("./skill.service"),
    ]);
    const query = { page: 1, pageSize: 20 };
    const listAll = () =>
      Promise.all([
        listToolboxes(query),
        listToolboxMarket(query),
        listMcps(query),
        listMcpMarket(query),
        listSkills(query),
        listSkillMarket(query),
      ]);

    const viewerResults = await listAll();
    for (const result of viewerResults) {
      expect(result.items.length).toBeGreaterThan(0);
      for (const record of result.items) {
        expect(record.operations).toEqual(["view", "view_detail"]);
      }
    }

    vi.stubEnv("VITE_MOCK_USER", "admin");
    const adminResults = await listAll();
    for (const result of adminResults) {
      for (const record of result.items) {
        expect(record.operations).toEqual(["*"]);
      }
    }
    expect(getMock).not.toHaveBeenCalled();
  });

  it("limits every detail endpoint to read operations, including MCP configuration", async () => {
    const [
      { getToolbox, getToolboxMarket },
      { getMcp, getMcpDetail, getMcpMarket },
      { getSkill, getSkillMarket },
    ] = await Promise.all([
      import("./toolbox.service"),
      import("./mcp.service"),
      import("./skill.service"),
    ]);

    const viewerRecords = await Promise.all([
      getToolbox("tb_context_loader"),
      getToolboxMarket("tb_context_loader"),
      getMcp("mcp_sse_demo"),
      getMcpDetail("mcp_sse_demo"),
      getMcpMarket("mcp_sse_demo"),
      getSkill("skill_doc_qa"),
      getSkillMarket("skill_doc_qa"),
    ]);
    for (const record of viewerRecords) {
      expect(record.operations).toEqual(["view", "view_detail"]);
    }

    vi.stubEnv("VITE_MOCK_USER", "admin");
    expect((await getToolbox("tb_context_loader")).operations).toEqual(["*"]);
    expect((await getMcpDetail("mcp_sse_demo")).operations).toEqual(["*"]);
    expect((await getSkill("skill_doc_qa")).operations).toEqual(["*"]);
    expect(getMock).not.toHaveBeenCalled();
  });
});
