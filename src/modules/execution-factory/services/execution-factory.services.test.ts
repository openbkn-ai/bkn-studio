import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeFunction, generateFunction, getFunctionPrompt } from "@/modules/execution-factory/services/function.service";
import { debugMcpTool, listMcpTools, listMcps } from "@/modules/execution-factory/services/mcp.service";
import { listOperators } from "@/modules/execution-factory/services/operator.service";
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

    const updated = await updateSkillMetadata(skillId!, {
      category: "other_category",
      description: "Updated in vitest",
      name: "Vitest Skill",
    });

    expect(updated.name).toBe("Vitest Skill");
  });

  it("returns skill release history and supports republish in mock mode", async () => {
    const listResult = await listSkills({ page: 1, pageSize: 10 });
    const skillId = listResult.items[0]?.skillId;

    const history = await getSkillReleaseHistory(skillId!);
    expect(history.length).toBeGreaterThan(0);

    const republished = await republishSkillHistory(skillId!, history[0]!.version);
    expect(republished.skillId).toBe(skillId);
  });

  it("lists mcps and proxy tools in mock mode", async () => {
    const mcpList = await listMcps({ page: 1, pageSize: 10 });
    const mcpId = mcpList.items[0]?.mcpId;

    expect(mcpId).toBeTruthy();

    const tools = await listMcpTools(mcpId!);
    expect(tools.length).toBeGreaterThan(0);

    const debugResult = await debugMcpTool(mcpId!, tools[0]!.name, {
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
