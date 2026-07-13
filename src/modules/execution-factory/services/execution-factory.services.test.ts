/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeFunction, generateFunction, getFunctionPrompt } from "@/modules/execution-factory/services/function.service";
import { debugMcpTool, listMcpTools, listMcps } from "@/modules/execution-factory/services/mcp.service";
import { listOperators, operatorDetailToFormValues, resolveOperatorDescription } from "@/modules/execution-factory/services/operator.service";
import {
  getSkillReleaseHistory,
  listSkills,
  republishSkillHistory,
  updateSkillMetadata,
} from "@/modules/execution-factory/services/skill.service";

describe("execution-factory services (mock mode)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  it("lists operators from mock data", async () => {
    const result = await listOperators({ page: 1, pageSize: 10 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items[0]?.operatorId).toBeTruthy();
  });

  it("lists skills and updates metadata in mock mode", async () => {
    const listResult = await listSkills({ page: 1, pageSize: 10 });
    const skillId = listResult.items[0]?.skillId;

    expect(skillId).toBeTruthy();

    const updated = await updateSkillMetadata(skillId, {
      category: "other_category",
      description: "Updated in vitest",
      name: "Vitest Skill",
    });

    expect(updated.name).toBe("Vitest Skill");
  });

  it("returns skill release history and supports republish in mock mode", async () => {
    const listResult = await listSkills({ page: 1, pageSize: 10 });
    const skillId = listResult.items[0]?.skillId;

    const history = await getSkillReleaseHistory(skillId);
    expect(history.length).toBeGreaterThan(0);

    const republished = await republishSkillHistory(skillId, history[0].version);
    expect(republished.skillId).toBe(skillId);
  });

  it("lists mcps and proxy tools in mock mode", async () => {
    const mcpList = await listMcps({ page: 1, pageSize: 10 });
    const mcpId = mcpList.items[0]?.mcpId;

    expect(mcpId).toBeTruthy();

    const tools = await listMcpTools(mcpId);
    expect(tools.length).toBeGreaterThan(0);

    const debugResult = await debugMcpTool(mcpId, tools[0].name, {
      arguments: { query: "test" },
    });

    expect(debugResult.isError).toBe(false);
  });

  it("executes and AI-generates functions in mock mode", async () => {
    const executeResult = await executeFunction({
      code: "def handler(event):\n    return event",
      event: { ok: true },
    });

    expect(executeResult.output).toBeTruthy();

    const prompt = await getFunctionPrompt("python_function_generator");
    expect(prompt.prompt).toBeTruthy();

    const generated = await generateFunction({
      query: "uppercase message",
      type: "python_function_generator",
    });

    expect(generated.content).toBeTruthy();
  });
});

describe("operator description mapping", () => {
  it("reads metadata.description from API payload", () => {
    expect(
      resolveOperatorDescription({
        metadata: { description: "test" },
        operator_id: "e0b56d33-31e8-4646-a32d-8bac094073c5",
        version: "44fe8ef6-6f60-43ef-a62a-44bc5fe08796",
      }),
    ).toBe("test");
  });

  it("builds form values without undefined description", () => {
    const values = operatorDetailToFormValues({
      description: "test",
      metadataType: "openapi",
      name: "加法",
      operatorId: "e0b56d33-31e8-4646-a32d-8bac094073c5",
      status: "unpublish",
      version: "44fe8ef6-6f60-43ef-a62a-44bc5fe08796",
    });

    expect(values.description).toBe("test");
    expect(values.metadataType).toBe("openapi");
  });
});
