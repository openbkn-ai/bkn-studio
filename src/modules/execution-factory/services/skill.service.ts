import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import {
  sanitizeDownloadFilename,
  triggerBrowserDownload,
} from "@/modules/execution-factory/utils/download-file";
import type {
  SkillContentResult,
  SkillFilePreviewResult,
  SkillFileSummary,
  SkillHistoryRecord,
  SkillListQuery,
  SkillListResult,
  SkillManagementFileReadResult,
  SkillMetadataEditInput,
  SkillPackageUpdateInput,
  SkillRecord,
  SkillRegisterInput,
  SkillStatus,
} from "@/modules/execution-factory/types/skill";
import {
  isTextPreviewableSkillFile,
  resolveSkillFileFetchUrl,
} from "@/modules/execution-factory/utils/skill-file-preview";

type BackendSkillSummary = {
  category?: string;
  category_name?: string;
  create_time?: number;
  create_user?: string;
  description?: string;
  name: string;
  skill_id: string;
  status?: string;
  update_time?: number;
  version?: string;
};

type BackendSkillListResponse = {
  data?: BackendSkillSummary[];
  page?: number;
  page_size?: number;
  total?: number;
};

type BackendSkillManagementContent = {
  content?: string;
  file_type?: string;
  files?: Array<{
    rel_path?: string;
    file_type?: string;
    size?: number;
    mime_type?: string;
  } | string>;
  url?: string;
};

type BackendReadManagementFileResponse = {
  skill_id?: string;
  rel_path?: string;
  url?: string;
  content?: string;
  mime_type?: string;
  file_type?: string;
  size?: number;
};

function mapSkillFileSummary(
  file: NonNullable<BackendSkillManagementContent["files"]>[number],
): SkillFileSummary | null {
  if (typeof file === "string") {
    return file ? { relPath: file } : null;
  }

  if (!file.rel_path) {
    return null;
  }

  return {
    relPath: file.rel_path,
    fileType: file.file_type,
    mimeType: file.mime_type,
    size: file.size,
  };
}

function buildMockFileSummaries(): SkillFileSummary[] {
  return [
    { relPath: "SKILL.md", fileType: "reference", mimeType: "text/markdown", size: 128 },
    { relPath: "scripts/run.py", fileType: "script", mimeType: "text/x-python", size: 256 },
  ];
}

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

type BackendSkillHistoryInfo = {
  create_time?: number;
  create_user?: string;
  description?: string;
  name: string;
  release_time?: number;
  release_user?: string;
  skill_id: string;
  status?: string;
  version: string;
};

let mockSkillHistory: SkillHistoryRecord[] = [
  {
    skillId: "skill_doc_qa",
    name: "Document QA Skill",
    description: "Answer questions over uploaded documents.",
    version: "0.9.0",
    status: "published",
    releaseUser: "system",
    releaseTime: Date.now() - 604_800_000,
  },
];

let mockSkills: SkillRecord[] = [
  {
    skillId: "skill_doc_qa",
    name: "Document QA Skill",
    description: "Answer questions over uploaded documents.",
    version: "1.0.0",
    status: "published",
    category: "other_category",
    categoryName: "Custom",
    createUser: "system",
    updateTime: Date.now() - 345_600_000,
  },
  {
    skillId: "skill_summarize",
    name: "Summarize Skill",
    description: "Summarize long-form content into concise notes.",
    version: "0.2.1",
    status: "unpublish",
    category: "other_category",
    categoryName: "Custom",
    createUser: "test",
    updateTime: Date.now() - 28_800_000,
  },
];

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

function normalizeTimestamp(value?: number): number | undefined {
  if (!value) {
    return undefined;
  }

  // Backend timestamps are nanoseconds; JS Date expects milliseconds.
  if (value > 1e15) {
    return Math.floor(value / 1_000_000);
  }

  return value;
}

function mapSkill(item: BackendSkillSummary): SkillRecord {
  return {
    skillId: item.skill_id,
    name: item.name,
    description: item.description,
    version: item.version,
    status: (item.status ?? "unpublish") as SkillStatus,
    category: item.category,
    categoryName: item.category_name,
    createUser: item.create_user,
    createTime: normalizeTimestamp(item.create_time),
    updateTime: normalizeTimestamp(item.update_time),
  };
}

function filterMockSkills(query: SkillListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();

  return mockSkills.filter((item) => {
    if (query.status && item.status !== query.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.skillId.toLowerCase().includes(keyword)
    );
  });
}

async function fetchSkillList(
  path: string,
  query: SkillListQuery,
): Promise<SkillListResult> {
  const response = await http.get<BackendSkillListResponse>(path, {
    headers: getBusinessDomainHeaders(),
    params: {
      page: query.page,
      page_size: query.pageSize,
      name: query.keyword || undefined,
      status: query.status,
      category: query.category || undefined,
      sort_by: "update_time",
      sort_order: "desc",
    },
    skipErrorToast: true,
  });

  const data = response.data;

  return {
    items: (data.data ?? []).map(mapSkill),
    total: data.total ?? 0,
    page: data.page ?? query.page,
    pageSize: data.page_size ?? query.pageSize,
  };
}

export async function listSkills(query: SkillListQuery): Promise<SkillListResult> {
  if (useMock) {
    return buildMockSkillList(query);
  }

  return fetchSkillList(`${API_PREFIX}/skills`, query);
}

export async function listSkillMarket(query: SkillListQuery): Promise<SkillListResult> {
  if (useMock) {
    return buildMockSkillList({ ...query, status: "published" });
  }

  return fetchSkillList(`${API_PREFIX}/skills/market`, query);
}

function buildMockSkillList(query: SkillListQuery): SkillListResult {
  const filtered = filterMockSkills(query);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSkill(skillId: string): Promise<SkillRecord> {
  if (useMock) {
    const record = mockSkills.find((item) => item.skillId === skillId);

    if (!record) {
      throw new Error("Skill not found");
    }

    return record;
  }

  const response = await http.get<BackendSkillSummary>(
    `${API_PREFIX}/skills/${skillId}`,
    {
      headers: getBusinessDomainHeaders(),
    },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill not found");
  }

  return mapSkill(response.data);
}

export async function getSkillMarket(skillId: string): Promise<SkillRecord> {
  if (useMock) {
    return getSkill(skillId);
  }

  const response = await http.get<BackendSkillSummary>(
    `${API_PREFIX}/skills/market/${skillId}`,
    {
      headers: getBusinessDomainHeaders(),
    },
  );

  if (!response.data.skill_id) {
    throw new Error("Market skill not found");
  }

  return mapSkill(response.data);
}

export async function registerSkill(input: SkillRegisterInput): Promise<SkillRecord> {
  if (useMock) {
    const record: SkillRecord = {
      skillId: `skill_${Date.now()}`,
      name: `Skill ${Date.now()}`,
      description: "Registered from mock upload.",
      version: "0.1.0",
      status: "unpublish",
      category: "other_category",
      categoryName: "Custom",
      createUser: "local-admin",
      updateTime: Date.now(),
    };
    mockSkills = [record, ...mockSkills];
    return record;
  }

  const formData = new FormData();
  formData.append("file_type", input.fileType);

  if (typeof input.file === "string") {
    formData.append("file", new Blob([input.file], { type: "text/plain" }));
  } else {
    formData.append("file", input.file);
  }

  if (input.category) {
    formData.append("category", input.category);
  }

  if (input.source) {
    formData.append("source", input.source);
  }

  const response = await http.post<BackendSkillSummary>(
    `${API_PREFIX}/skills`,
    formData,
    {
      headers: {
        ...getBusinessDomainHeaders(),
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill registration failed");
  }

  return mapSkill(response.data);
}

async function fetchSkillMarketPackageBlob(skillId: string): Promise<Blob> {
  if (useMock) {
    return new Blob(["mock skill package"], { type: "application/zip" });
  }

  const response = await http.get<Blob>(
    `${API_PREFIX}/skills/market/${skillId}/management/download`,
    {
      headers: getBusinessDomainHeaders(),
      responseType: "blob",
    },
  );

  return response.data;
}

export async function installSkillFromMarket(skillId: string): Promise<SkillRecord> {
  const blob = await fetchSkillMarketPackageBlob(skillId);
  const file = new File([blob], `${skillId}.zip`, { type: "application/zip" });

  return registerSkill({
    file,
    fileType: "zip",
    source: "internal",
  });
}

export async function syncSkillFromMarket(skillId: string): Promise<SkillRecord> {
  const blob = await fetchSkillMarketPackageBlob(skillId);
  const file = new File([blob], `${skillId}.zip`, { type: "application/zip" });

  return updateSkillPackage(skillId, {
    file,
    fileType: "zip",
  });
}

export async function downloadSkillPackage(
  skillId: string,
  displayName?: string,
): Promise<void> {
  if (useMock) {
    const blob = new Blob(["mock skill package"], { type: "application/zip" });
    triggerBrowserDownload(
      blob,
      `${sanitizeDownloadFilename(displayName ?? skillId, skillId)}.zip`,
    );
    return;
  }

  const response = await http.get<Blob>(
    `${API_PREFIX}/skills/${skillId}/management/download`,
    {
      headers: getBusinessDomainHeaders(),
      responseType: "blob",
    },
  );

  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const filename =
    filenameMatch?.[1] ??
    `${sanitizeDownloadFilename(displayName ?? skillId, skillId)}.zip`;

  triggerBrowserDownload(response.data, filename);
}

export async function getSkillManagementContent(
  skillId: string,
): Promise<SkillContentResult> {
  if (useMock) {
    return {
      content: "# Mock SKILL.md\n\nThis is a mock skill content preview.",
      fileSummaries: buildMockFileSummaries(),
      files: buildMockFileSummaries().map((item) => item.relPath),
      fileType: "zip",
    };
  }

  const response = await http.get<BackendSkillManagementContent>(
    `${API_PREFIX}/skills/${skillId}/management/content`,
    {
      headers: getBusinessDomainHeaders(),
      params: { response_mode: "content" },
    },
  );

  const fileSummaries = (response.data.files ?? [])
    .map(mapSkillFileSummary)
    .filter((item): item is SkillFileSummary => Boolean(item));

  return {
    content: response.data.content,
    fileSummaries,
    files: fileSummaries.map((item) => item.relPath),
    downloadUrl: response.data.url,
    fileType: response.data.file_type,
  };
}

export async function readSkillManagementFile(
  skillId: string,
  relPath: string,
  options?: { responseMode?: "url" | "content" },
): Promise<SkillManagementFileReadResult> {
  if (useMock) {
    const mockContents: Record<string, string> = {
      "SKILL.md": "# Mock SKILL.md\n\nThis is a mock skill content preview.",
      "scripts/run.py": "def main():\n    return 'ok'\n",
      "refs/guide.md": "# Guide\n",
    };

    const content = mockContents[relPath];
    if (options?.responseMode === "content") {
      return {
        skillId,
        relPath,
        content: content ?? "",
        mimeType: relPath.endsWith(".py") ? "text/x-python" : "text/markdown",
        fileType: relPath.endsWith(".py") ? "script" : "reference",
        size: content?.length ?? 0,
      };
    }

    return {
      skillId,
      relPath,
      url: `mock://skill-file/${encodeURIComponent(relPath)}`,
      mimeType: relPath.endsWith(".py") ? "text/x-python" : "text/markdown",
      fileType: relPath.endsWith(".py") ? "script" : "reference",
      size: content?.length ?? 0,
    };
  }

  const responseMode = options?.responseMode ?? "url";
  const response = await http.post<BackendReadManagementFileResponse>(
    `${API_PREFIX}/skills/${skillId}/management/files/read?response_mode=${responseMode}`,
    { rel_path: relPath },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    skillId: response.data.skill_id ?? skillId,
    relPath: response.data.rel_path ?? relPath,
    url: response.data.url,
    content: response.data.content,
    mimeType: response.data.mime_type,
    fileType: response.data.file_type,
    size: response.data.size,
  };
}

async function fetchSkillFileTextFromUrl(url: string): Promise<string> {
  if (url.startsWith("mock://")) {
    const relPath = decodeURIComponent(url.split("/").pop() ?? "");
    const mockContents: Record<string, string> = {
      "SKILL.md": "# Mock SKILL.md\n\nThis is a mock skill content preview.",
      "scripts/run.py": "def main():\n    return 'ok'\n",
    };
    return mockContents[relPath] ?? "";
  }

  const response = await fetch(
    resolveSkillFileFetchUrl(url, getRuntimeConfig().apiBaseUrl),
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch skill file content (${response.status})`);
  }

  return response.text();
}

export async function previewSkillManagementFile(
  skillId: string,
  relPath: string,
  options?: { skillMdContent?: string },
): Promise<SkillFilePreviewResult> {
  if (relPath === "SKILL.md") {
    if (options?.skillMdContent) {
      return { kind: "text", content: options.skillMdContent };
    }

    const mgmtContent = await getSkillManagementContent(skillId);
    if (mgmtContent.content) {
      return { kind: "text", content: mgmtContent.content };
    }
  }

  const fileMeta = await readSkillManagementFile(skillId, relPath, {
    responseMode: isTextPreviewableSkillFile(undefined, relPath) ? "content" : "url",
  });

  if (isTextPreviewableSkillFile(fileMeta.mimeType, relPath)) {
    if (fileMeta.content !== undefined) {
      return {
        kind: "text",
        content: fileMeta.content,
      };
    }

    if (!fileMeta.url) {
      throw new Error("Skill file preview content is unavailable");
    }

    return {
      kind: "text",
      content: await fetchSkillFileTextFromUrl(fileMeta.url),
    };
  }

  if (!fileMeta.url) {
    throw new Error("Skill file preview URL is unavailable");
  }

  return {
    kind: "binary",
    url: resolveSkillFileFetchUrl(fileMeta.url, getRuntimeConfig().apiBaseUrl),
    mimeType: fileMeta.mimeType,
    size: fileMeta.size,
  };
}

export async function updateSkillStatus(
  skillId: string,
  status: SkillStatus,
): Promise<void> {
  if (useMock) {
    mockSkills = mockSkills.map((item) =>
      item.skillId === skillId ? { ...item, status, updateTime: Date.now() } : item,
    );
    return;
  }

  await http.put(
    `${API_PREFIX}/skills/${skillId}/status`,
    { status },
    { headers: getBusinessDomainHeaders() },
  );
}

export async function deleteSkill(skillId: string): Promise<void> {
  if (useMock) {
    mockSkills = mockSkills.filter((item) => item.skillId !== skillId);
    mockSkillHistory = mockSkillHistory.filter((item) => item.skillId !== skillId);
    return;
  }

  await http.delete(`${API_PREFIX}/skills/${skillId}`, {
    headers: getBusinessDomainHeaders(),
  });
}

function mapSkillHistory(item: BackendSkillHistoryInfo): SkillHistoryRecord {
  return {
    skillId: item.skill_id,
    name: item.name,
    description: item.description,
    version: item.version,
    status: (item.status ?? "published") as SkillHistoryRecord["status"],
    releaseUser: item.release_user,
    releaseTime: normalizeTimestamp(item.release_time),
  };
}

export async function updateSkillMetadata(
  skillId: string,
  input: SkillMetadataEditInput,
): Promise<SkillRecord> {
  if (useMock) {
    mockSkills = mockSkills.map((item) =>
      item.skillId === skillId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            category: input.category,
            updateTime: Date.now(),
          }
        : item,
    );
    const record = mockSkills.find((item) => item.skillId === skillId);

    if (!record) {
      throw new Error("Skill not found");
    }

    return record;
  }

  const response = await http.put<BackendSkillSummary>(
    `${API_PREFIX}/skills/${skillId}/metadata`,
    {
      category: input.category,
      description: input.description,
      name: input.name,
      source: input.source,
    },
    { headers: getBusinessDomainHeaders() },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill metadata update failed");
  }

  return mapSkill(response.data);
}

export async function updateSkillPackage(
  skillId: string,
  input: SkillPackageUpdateInput,
): Promise<SkillRecord> {
  if (useMock) {
    mockSkills = mockSkills.map((item) =>
      item.skillId === skillId
        ? {
            ...item,
            version: `${item.version ?? "0.1.0"}-draft`,
            updateTime: Date.now(),
          }
        : item,
    );
    const record = mockSkills.find((item) => item.skillId === skillId);

    if (!record) {
      throw new Error("Skill not found");
    }

    return record;
  }

  const formData = new FormData();
  formData.append("file_type", input.fileType);

  if (typeof input.file === "string") {
    formData.append("file", new Blob([input.file], { type: "text/plain" }));
  } else {
    formData.append("file", input.file);
  }

  const response = await http.put<BackendSkillSummary>(
    `${API_PREFIX}/skills/${skillId}/package`,
    formData,
    {
      headers: {
        ...getBusinessDomainHeaders(),
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill package update failed");
  }

  return mapSkill(response.data);
}

export async function getSkillReleaseHistory(
  skillId: string,
): Promise<SkillHistoryRecord[]> {
  if (useMock) {
    return mockSkillHistory.filter((item) => item.skillId === skillId);
  }

  const response = await http.get<BackendSkillHistoryInfo[]>(
    `${API_PREFIX}/skills/${skillId}/history`,
    {
      headers: getBusinessDomainHeaders(),
    },
  );

  const history = Array.isArray(response.data) ? response.data : [];

  return history.map(mapSkillHistory);
}

export async function republishSkillHistory(
  skillId: string,
  version: string,
): Promise<SkillRecord> {
  if (useMock) {
    const history = mockSkillHistory.find(
      (item) => item.skillId === skillId && item.version === version,
    );

    if (!history) {
      throw new Error("Skill history version not found");
    }

    mockSkills = mockSkills.map((item) =>
      item.skillId === skillId
        ? {
            ...item,
            name: history.name,
            description: history.description,
            version: history.version,
            status: "unpublish",
            updateTime: Date.now(),
          }
        : item,
    );

    const record = mockSkills.find((item) => item.skillId === skillId);

    if (!record) {
      throw new Error("Skill not found");
    }

    return record;
  }

  const response = await http.post<BackendSkillSummary>(
    `${API_PREFIX}/skills/${skillId}/history/republish`,
    { version },
    { headers: getBusinessDomainHeaders() },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill history republish failed");
  }

  return mapSkill(response.data);
}

export async function publishSkillHistory(
  skillId: string,
  version: string,
): Promise<SkillRecord> {
  if (useMock) {
    const history = mockSkillHistory.find(
      (item) => item.skillId === skillId && item.version === version,
    );

    if (!history) {
      throw new Error("Skill history version not found");
    }

    mockSkills = mockSkills.map((item) =>
      item.skillId === skillId
        ? {
            ...item,
            name: history.name,
            description: history.description,
            version: history.version,
            status: "published",
            updateTime: Date.now(),
          }
        : item,
    );

    const record = mockSkills.find((item) => item.skillId === skillId);

    if (!record) {
      throw new Error("Skill not found");
    }

    return record;
  }

  const response = await http.post<BackendSkillSummary>(
    `${API_PREFIX}/skills/${skillId}/history/publish`,
    { version },
    { headers: getBusinessDomainHeaders() },
  );

  if (!response.data.skill_id) {
    throw new Error("Skill history publish failed");
  }

  return mapSkill(response.data);
}
