import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import {
  sanitizeDownloadFilename,
  triggerBrowserDownload,
} from "@/modules/execution-factory/utils/download-file";
import type {
  SkillContentResult,
  SkillHistoryRecord,
  SkillListQuery,
  SkillListResult,
  SkillMetadataEditInput,
  SkillPackageUpdateInput,
  SkillRecord,
  SkillRegisterInput,
  SkillStatus,
} from "@/modules/execution-factory/types/skill";

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
  files?: Array<{ rel_path?: string } | string>;
  url?: string;
};

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
      files: ["SKILL.md", "scripts/run.py"],
    };
  }

  const response = await http.get<BackendSkillManagementContent>(
    `${API_PREFIX}/skills/${skillId}/management/content`,
    {
      headers: getBusinessDomainHeaders(),
      params: { response_mode: "content" },
    },
  );

  const files = response.data.files?.map((file) =>
    typeof file === "string" ? file : (file.rel_path ?? ""),
  );

  return {
    content: response.data.content,
    files: files?.filter(Boolean),
    downloadUrl: response.data.url,
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
