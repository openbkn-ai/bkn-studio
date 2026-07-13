/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  buildMcpName,
  cleanupMcpViaApi,
  createToolImportedMcpViaApi,
  offlineMcpViaApi,
  publishMcpViaApi,
} from "../../helpers/mcp";
import {
  buildOperatorName,
  cleanupOperatorViaApi,
  getOperatorDetailViaApi,
  listOperatorHistoryViaApi,
  offlineOperatorViaApi,
  publishOperatorViaApi,
  refreshOperatorViaApi,
  registerOperatorViaApi,
  unpublishOperatorViaApi,
  updateOperatorViaApi,
  type RegisteredOperator,
} from "../../helpers/operator";
import {
  buildSkillName,
  cleanupSkillViaApi,
  getSkillHistoryViaApi,
  publishSkillViaApi,
  registerSkillViaApi,
  republishSkillHistoryViaApi,
} from "../../helpers/skill";
import {
  buildToolboxName,
  cleanupToolboxViaApi,
  createToolViaApi,
  createToolboxViaApi,
  offlineToolboxViaApi,
  publishToolboxViaApi,
} from "../../helpers/toolbox";

test.describe("Execution Factory — Version & status E2E flows", () => {
  let backendReady = false;
  const createdOperators: RegisteredOperator[] = [];
  const createdBoxIds: string[] = [];
  const createdMcpIds: string[] = [];
  const createdSkillIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    try {
      await assertBackendReady(request);
      backendReady = true;
    } catch (error) {
      backendReady = false;
      console.warn(String(error));
    }
  });

  test.afterEach(async ({ request }) => {
    while (createdMcpIds.length > 0) {
      const mcpId = createdMcpIds.pop();
      if (!mcpId) continue;
      try {
        await cleanupMcpViaApi(request, mcpId);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdSkillIds.length > 0) {
      const skillId = createdSkillIds.pop();
      if (!skillId) continue;
      try {
        await cleanupSkillViaApi(request, skillId);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdOperators.length > 0) {
      const operator = createdOperators.pop();
      if (!operator) continue;
      try {
        await cleanupOperatorViaApi(request, operator);
      } catch (error) {
        console.warn(String(error));
      }
    }

    while (createdBoxIds.length > 0) {
      const boxId = createdBoxIds.pop();
      if (!boxId) continue;
      try {
        await cleanupToolboxViaApi(request, boxId);
      } catch (error) {
        console.warn(String(error));
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("VER-01: operator publish creates version history", async ({ request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("hist"));
    createdOperators.push(operator);

    await publishOperatorViaApi(request, operator);
    const refreshed = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = refreshed;

    const history = await listOperatorHistoryViaApi(request, operator.operatorId);
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((item: { version?: string }) => item.version === refreshed.version)).toBeTruthy();
  });

  test("VER-02: operator edit and republish adds history entries", async ({ request }) => {
    const name = buildOperatorName("hist_edit");
    let operator = await registerOperatorViaApi(request, name);
    createdOperators.push(operator);

    await publishOperatorViaApi(request, operator);
    operator = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = operator;

    const updatedName = `${name}_v2`;
    await updateOperatorViaApi(request, operator, updatedName);
    operator = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = operator;

    await publishOperatorViaApi(request, operator);

    const history = await listOperatorHistoryViaApi(request, operator.operatorId);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  test("VER-03: operator offline and unpublish status transitions", async ({ request }) => {
    const operator = await registerOperatorViaApi(request, buildOperatorName("status"));
    createdOperators.push(operator);

    await publishOperatorViaApi(request, operator);
    let current = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = current;

    await offlineOperatorViaApi(request, current);
    current = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = current;
    let detail = await getOperatorDetailViaApi(request, operator.operatorId);
    expect(detail.version).toBeTruthy();

    await publishOperatorViaApi(request, current);
    current = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = current;

    await offlineOperatorViaApi(request, current);
    current = await refreshOperatorViaApi(request, operator);
    createdOperators[createdOperators.length - 1] = current;

    await unpublishOperatorViaApi(request, current);
    detail = await getOperatorDetailViaApi(request, operator.operatorId);
    expect(detail.version).toBeTruthy();
  });

  test("VER-04: toolbox and MCP publish then offline", async ({ request }) => {
    const toolbox = await createToolboxViaApi(request, buildToolboxName("status_box"));
    createdBoxIds.push(toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);
    await offlineToolboxViaApi(request, toolbox.boxId);
    await publishToolboxViaApi(request, toolbox.boxId);
    await offlineToolboxViaApi(request, toolbox.boxId);

    const tool = await createToolViaApi(request, toolbox.boxId, buildToolboxName("status_tool"));
    const mcp = await createToolImportedMcpViaApi(
      request,
      buildMcpName("status"),
      toolbox,
      tool,
    );
    createdMcpIds.push(mcp.mcpId);
    await publishMcpViaApi(request, mcp.mcpId);
    await offlineMcpViaApi(request, mcp.mcpId);
    await publishMcpViaApi(request, mcp.mcpId);
    await offlineMcpViaApi(request, mcp.mcpId);

    const mcpDetail = await request.get(apiUrl(`/mcp/${mcp.mcpId}`), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(mcpDetail.ok()).toBeTruthy();
  });

  test("VER-05: skill publish history and republish draft", async ({ request }) => {
    const skill = await registerSkillViaApi(
      request,
      `---\nname: ${buildSkillName("hist")}\ndescription: history skill\n---\nBody v1`,
    );
    createdSkillIds.push(skill.skillId);

    await publishSkillViaApi(request, skill.skillId);
    let history = await getSkillHistoryViaApi(request, skill.skillId);
    expect(history.length).toBeGreaterThan(0);

    const publishedVersion = history[0]?.version as string | undefined;
    expect(publishedVersion).toBeTruthy();

    await republishSkillHistoryViaApi(request, skill.skillId, publishedVersion!);

    history = await getSkillHistoryViaApi(request, skill.skillId);
    expect(history.length).toBeGreaterThan(0);
  });
});
