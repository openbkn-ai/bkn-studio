import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AdmZip from "adm-zip";
import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, buildUniqueName, defaultApiHeaders, expectOk } from "./common";

export type SkillRecord = {
  skillId: string;
  name: string;
  version?: string;
};

export function buildSkillName(suffix?: string) {
  return buildUniqueName(suffix ? `at_e2e_skill_${suffix}` : "at_e2e_skill");
}

export function loadSkillFixture() {
  return readFileSync(resolve(__dirname, "../fixtures/skill.md"), "utf8");
}

export function buildSkillZipBuffer(skillName: string) {
  const zip = new AdmZip();
  const markdown = [
    "---",
    `name: ${skillName}`,
    "description: E2E zip skill fixture",
    "---",
    "Zip-packaged skill body for E2E.",
  ].join("\n");
  zip.addFile("SKILL.md", Buffer.from(markdown, "utf8"));
  zip.addFile("refs/guide.md", Buffer.from("# Guide\n", "utf8"));
  return zip.toBuffer();
}

export async function registerSkillZipViaApi(
  request: APIRequestContext,
  skillName?: string,
): Promise<SkillRecord> {
  const name = skillName ?? buildSkillName("zip");
  const zipBuffer = buildSkillZipBuffer(name);

  const response = await request.post(`${API_PREFIX}/skills`, {
    headers: defaultApiHeaders(),
    multipart: {
      file_type: "zip",
      category: "other_category",
      source: "custom",
      file: {
        name: "skill.zip",
        mimeType: "application/zip",
        buffer: zipBuffer,
      },
    },
  });

  await expectOk(response, "Register skill zip");

  const body = (await response.json()) as {
    skill_id?: string;
    name?: string;
    version?: string;
  };

  if (!body.skill_id) {
    throw new Error(`Register skill zip failed: ${JSON.stringify(body)}`);
  }

  return {
    skillId: body.skill_id,
    name: body.name ?? name,
    version: body.version,
  };
}

export async function registerSkillViaApi(
  request: APIRequestContext,
  skillMarkdown?: string,
): Promise<SkillRecord> {
  const content = skillMarkdown ?? loadSkillFixture();

  const response = await request.post(`${API_PREFIX}/skills`, {
    headers: defaultApiHeaders(),
    multipart: {
      file_type: "content",
      category: "other_category",
      source: "custom",
      file: {
        name: "SKILL.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(content),
      },
    },
  });

  await expectOk(response, "Register skill");

  const body = (await response.json()) as {
    skill_id?: string;
    name?: string;
    version?: string;
  };

  if (!body.skill_id) {
    throw new Error(`Register skill failed: ${JSON.stringify(body)}`);
  }

  return {
    skillId: body.skill_id,
    name: body.name ?? body.skill_id,
    version: body.version,
  };
}

export async function publishSkillViaApi(request: APIRequestContext, skillId: string) {
  const response = await request.put(`${API_PREFIX}/skills/${skillId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "published" },
  });
  await expectOk(response, "Publish skill");
}

export async function getSkillContentViaApi(request: APIRequestContext, skillId: string) {
  const response = await request.get(
    `${API_PREFIX}/skills/${skillId}/management/content?response_mode=content`,
    { headers: defaultApiHeaders() },
  );
  await expectOk(response, "Get skill content");
  return response.json();
}

export async function readSkillManagementFileViaApi(
  request: APIRequestContext,
  skillId: string,
  relPath: string,
  options?: { responseMode?: "url" | "content" },
) {
  const responseMode = options?.responseMode ?? "url";
  const response = await request.post(
    `${API_PREFIX}/skills/${skillId}/management/files/read?response_mode=${responseMode}`,
    {
      headers: {
        ...defaultApiHeaders(),
        "Content-Type": "application/json",
      },
      data: { rel_path: relPath },
    },
  );
  await expectOk(response, "Read skill management file");
  return response.json() as Promise<{
    rel_path?: string;
    url?: string;
    content?: string;
    mime_type?: string;
    size?: number;
  }>;
}

export async function getSkillHistoryViaApi(request: APIRequestContext, skillId: string) {
  const response = await request.get(`${API_PREFIX}/skills/${skillId}/history`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Get skill history");
  const body = await response.json();
  return Array.isArray(body) ? body : [];
}

export async function republishSkillHistoryViaApi(
  request: APIRequestContext,
  skillId: string,
  version: string,
) {
  const response = await request.post(`${API_PREFIX}/skills/${skillId}/history/republish`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { version },
  });
  await expectOk(response, "Republish skill history");
  return response.json();
}

export async function offlineSkillViaApi(request: APIRequestContext, skillId: string) {
  const response = await request.put(`${API_PREFIX}/skills/${skillId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "offline" },
  });
  await expectOk(response, "Offline skill");
}

export async function deleteSkillViaApi(request: APIRequestContext, skillId: string) {
  try {
    await publishSkillViaApi(request, skillId);
  } catch {
    // Ignore when already published or publish is unavailable.
  }

  try {
    await offlineSkillViaApi(request, skillId);
  } catch {
    // Ignore when already offline or unpublish.
  }

  const response = await request.delete(`${API_PREFIX}/skills/${skillId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Delete skill");
}

export async function updateSkillPackageViaApi(
  request: APIRequestContext,
  skillId: string,
  zipBuffer: Buffer,
) {
  const response = await request.put(`${API_PREFIX}/skills/${skillId}/package`, {
    headers: defaultApiHeaders(),
    multipart: {
      file_type: "zip",
      file: {
        name: "skill.zip",
        mimeType: "application/zip",
        buffer: zipBuffer,
      },
    },
  });
  await expectOk(response, "Update skill package");
  return response.json();
}

export async function cleanupSkillViaApi(request: APIRequestContext, skillId: string) {
  await deleteSkillViaApi(request, skillId);
}
