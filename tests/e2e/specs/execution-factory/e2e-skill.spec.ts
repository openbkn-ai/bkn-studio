/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { apiUrl, assertBackendReady } from "../../helpers/common";
import {
  buildSkillName,
  cleanupSkillViaApi,
  getSkillContentViaApi,
  publishSkillViaApi,
  readSkillManagementFileViaApi,
  registerSkillViaApi,
  registerSkillZipViaApi,
} from "../../helpers/skill";

test.describe("Execution Factory — Skill E2E flows", () => {
  let backendReady = false;
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
    while (createdSkillIds.length > 0) {
      const skillId = createdSkillIds.pop();
      if (!skillId) continue;
      try {
        await cleanupSkillViaApi(request, skillId);
      } catch (error) {
        console.warn(`Cleanup failed for skill ${skillId}: ${String(error)}`);
      }
    }
  });

  test.beforeEach(() => {
    test.skip(!backendReady, "execution-factory backend is not running on :9000");
  });

  test("SK-01: import skill via SKILL.md upload", async ({ request }) => {
    const skill = await registerSkillViaApi(request);
    createdSkillIds.push(skill.skillId);

    expect(skill.skillId).toBeTruthy();
    expect(skill.name).toContain("e2e");
  });

  test("SK-02: read skill management content", async ({ request }) => {
    const skill = await registerSkillViaApi(request);
    createdSkillIds.push(skill.skillId);

    const content = await getSkillContentViaApi(request, skill.skillId);
    expect(content).toBeTruthy();
  });

  test("SK-03: publish skill and verify market listing", async ({ request }) => {
    const skill = await registerSkillViaApi(
      request,
      `---\nname: ${buildSkillName("market")}\ndescription: market skill\n---\nBody`,
    );
    createdSkillIds.push(skill.skillId);

    await publishSkillViaApi(request, skill.skillId);

    const market = await request.get(apiUrl("/skills/market?page=1&page_size=20"), {
      headers: { "x-business-domain": "bd_public" },
    });
    expect(market.ok()).toBeTruthy();
    const body = (await market.json()) as { data?: Array<{ skill_id: string }> };
    expect(body.data?.some((item) => item.skill_id === skill.skillId)).toBeTruthy();
  });

  test("SK-04: import skill via zip package upload", async ({ request }) => {
    const skill = await registerSkillZipViaApi(request, buildSkillName("zip"));
    createdSkillIds.push(skill.skillId);
    expect(skill.skillId).toBeTruthy();
  });

  test("SK-05: read zip skill management file via files/read", async ({ request }) => {
    const skill = await registerSkillZipViaApi(request, buildSkillName("file_read"));
    createdSkillIds.push(skill.skillId);

    const content = (await getSkillContentViaApi(request, skill.skillId)) as {
      files?: Array<{ rel_path?: string } | string>;
    };
    const relPaths = (content.files ?? [])
      .map((file) => (typeof file === "string" ? file : file.rel_path))
      .filter(Boolean) as string[];
    expect(relPaths.some((path) => path.includes("refs/guide.md"))).toBeTruthy();

    const fileMeta = await readSkillManagementFileViaApi(request, skill.skillId, "refs/guide.md");
    expect(fileMeta.url).toBeTruthy();

    const fileContent = await readSkillManagementFileViaApi(
      request,
      skill.skillId,
      "refs/guide.md",
      { responseMode: "content" },
    );
    expect(fileContent.content).toContain("# Guide");
  });
});
