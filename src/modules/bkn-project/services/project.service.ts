/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import {
  parseContentDispositionFilename,
  sanitizeDownloadFilename,
  triggerBrowserDownload,
} from "@/framework/download/file-download";
import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import { getCatalogResources } from "@/modules/data-catalog/services/resource.service";
import { getKnowledgeNetworkStatistics } from "@/modules/knowledge-network/services/network.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";
import type {
  CreateProjectInput,
  ImportProjectInput,
  Project,
  ProjectListQuery,
  ProjectListResult,
  ProjectNamingLanguage,
  ProjectNetwork,
  ProjectPackagePreview,
  ProjectRelease,
} from "@/modules/bkn-project/types/project";
import { SYSTEM_OBJECT_TYPE_IDS } from "@/modules/bkn-project/types/project";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendProject = {
  archived: boolean;
  baseline_network_id: string;
  branch: string;
  can_manage?: boolean;
  catalog_ids: string[] | null;
  create_time: number;
  id: string;
  kn_id: string;
  name: string;
  naming_language?: string;
  other_projects: number;
  owner: { id: string; type: string };
  owner_name?: string;
  update_time: number;
};

type BackendProjectList = {
  entries: BackendProject[] | null;
  total: number;
};

/** Projects made before content languages were chosen have none: they are in Chinese. */
function namingLanguage(value: string | undefined): ProjectNamingLanguage {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function mapProject(item: BackendProject): Project {
  return {
    archived: item.archived,
    baselineNetworkId: item.baseline_network_id,
    branch: item.branch,
    canManage: item.can_manage ?? false,
    catalogIds: item.catalog_ids ?? [],
    createTime: item.create_time,
    id: item.id,
    knId: item.kn_id,
    name: item.name,
    namingLanguage: namingLanguage(item.naming_language),
    otherProjects: item.other_projects,
    owner: item.owner,
    ownerName: item.owner_name,
    updateTime: item.update_time,
  };
}

/* ----------------------------- Mock (local development) ----------------------------- */
// The development user owns its own mock projects, so the owner-only actions show up locally.
const mockOwner = { id: defaultDevRuntimeUser.id ?? "mock-user", type: "user" };

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const mockNetworks: ProjectNetwork[] = [
  { id: "supply_chain", name: "Supply Chain" },
  { id: "finance_ar", name: "Accounts Receivable" },
];

const mockProjects: BackendProject[] = [
  {
    archived: false,
    baseline_network_id: "supply_chain_v1_0_0",
    branch: "project/p-001",
    can_manage: true,
    catalog_ids: ["cat-001"],
    create_time: Date.parse("2026-10-20T09:00:00Z"),
    id: "p-001",
    kn_id: "supply_chain",
    name: "Delivery Delay Warning",
    naming_language: "en-US",
    other_projects: 1,
    owner: mockOwner,
    update_time: Date.parse("2026-10-26T10:00:00Z"),
  },
  {
    archived: false,
    baseline_network_id: "supply_chain_v1_0_0",
    branch: "project/p-002",
    can_manage: false,
    catalog_ids: ["fi_ar_receipts"],
    create_time: Date.parse("2026-10-22T09:00:00Z"),
    id: "p-002",
    kn_id: "supply_chain",
    name: "Receipts Matching",
    naming_language: "zh-CN",
    other_projects: 1,
    owner: { id: "another-user", type: "user" },
    update_time: Date.parse("2026-10-25T10:00:00Z"),
  },
];

/** The 404 bkn-project answers for a project that is missing or not visible. */
function mockNotFound(id: string) {
  const response = {
    data: { description: `project ${id} not found`, error_code: "BknProject.Project.NotFound" },
    status: 404,
  } as AxiosResponse;
  return new AxiosError(
    `project ${id} not found`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    response,
  );
}

function mockOtherProjects(project: BackendProject): number {
  return mockProjects.filter(
    (other) => other.id !== project.id && other.kn_id === project.kn_id && !other.archived,
  ).length;
}

function mockList(query: ProjectListQuery): ProjectListResult {
  const name = query.name.trim().toLowerCase();
  const items = mockProjects
    .filter((project) => !name || project.name.toLowerCase().includes(name))
    .sort((left, right) => right.create_time - left.create_time)
    .map((project) => mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  return { items: items.slice(query.offset, query.offset + query.limit), total: items.length };
}

/* ------------------------------- API ------------------------------- */

/** Lists the projects of the networks the caller can see, newest first, a numbered page at a time. */
export async function listProjects(query: ProjectListQuery): Promise<ProjectListResult> {
  if (useMock) {
    return wait(mockList(query));
  }
  const response = await http.get<BackendProjectList>(API_PREFIX, {
    skipErrorToast: true,
    params: {
      limit: query.limit,
      name: query.name.trim() || undefined,
      offset: query.offset || undefined,
    },
  });
  return {
    items: (response.data.entries ?? []).map(mapProject),
    total: response.data.total,
  };
}

/** Networks of the mock that keep versions; a project of another one turns versioning on. */
const mockVersioned = new Set(["supply_chain"]);

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (useMock) {
    if (input.knId && !mockVersioned.has(input.knId)) {
      if (!input.enableVersioning) {
        throw new AxiosError("versioning required", "ERR_BAD_REQUEST", undefined, undefined, {
          data: {
            description: "versioning required",
            error_code: "BknProject.Project.VersioningRequired",
          },
          status: 409,
        } as AxiosResponse);
      }
      mockVersioned.add(input.knId);
    }
    const now = Date.now();
    const knId = input.knId ?? `new_${now}`;
    const created: BackendProject = {
      archived: false,
      baseline_network_id: knId,
      branch: `project/mock-${now}`,
      can_manage: true,
      catalog_ids: input.catalogIds,
      create_time: now,
      id: `mock-${now}`,
      kn_id: knId,
      name: input.name.trim(),
      naming_language: input.namingLanguage,
      other_projects: 0,
      owner: mockOwner,
      update_time: now,
    };
    if (input.newKnName) {
      mockVersioned.add(knId);
      mockNetworks.unshift({ id: knId, name: input.newKnName.trim() });
    }
    mockProjects.unshift(created);
    return wait(mapProject({ ...created, other_projects: mockOtherProjects(created) }));
  }
  // The dialog words every refusal, versioning ones included.
  const response = await http.post<BackendProject>(
    API_PREFIX,
    {
      catalog_ids: input.catalogIds,
      enable_versioning: input.enableVersioning || undefined,
      kn_id: input.knId || undefined,
      name: input.name.trim(),
      naming_language: input.namingLanguage,
      new_kn: input.newKnName ? { name: input.newKnName.trim() } : undefined,
    },
    { skipErrorToast: true },
  );
  return mapProject(response.data);
}

function mockProject(id: string) {
  const project = mockProjects.find((item) => item.id === id);
  if (!project) {
    throw mockNotFound(id);
  }
  return project;
}

/** Renames a project; its owner or an administrator may. */
export async function renameProject(id: string, name: string): Promise<Project> {
  if (useMock) {
    const project = mockProject(id);
    project.name = name.trim();
    project.update_time = Date.now();
    return wait(mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  }
  const response = await http.patch<BackendProject>(
    `${API_PREFIX}/${encodeURIComponent(id)}`,
    { name: name.trim() },
    { skipErrorToast: true },
  );
  return mapProject(response.data);
}

/**
 * Deletes a project's own material and withdraws its unpublished prepared release. The knowledge
 * network and its published versions stay.
 */
export async function deleteProject(id: string): Promise<void> {
  if (useMock) {
    mockProject(id);
    mockProjects.splice(
      mockProjects.findIndex((item) => item.id === id),
      1,
    );
    await wait(null);
    return;
  }
  await http.delete(`${API_PREFIX}/${encodeURIComponent(id)}`, { skipErrorToast: true });
}

/** Downloads a project as a package file, named as bkn-project names it. */
export async function exportProject(project: Pick<Project, "id" | "name">): Promise<void> {
  const fallback = sanitizeDownloadFilename(`${project.name}.bknproj`, "project.bknproj");
  if (useMock) {
    mockProject(project.id);
    await wait(null);
    triggerBrowserDownload(new Blob([project.id], { type: "application/zip" }), fallback);
    return;
  }
  const response = await http.get<Blob>(`${API_PREFIX}/${encodeURIComponent(project.id)}/export`, {
    responseType: "blob",
    skipErrorToast: true,
  });
  triggerBrowserDownload(
    response.data,
    parseContentDispositionFilename(
      response.headers["content-disposition"] as string | undefined,
    ) ?? fallback,
  );
}

type BackendPackagePreview = {
  catalogs: { id: string; name: string }[] | null;
  contents: {
    confirmed_files: number;
    documents: number;
    draft: boolean;
    editions: string[] | null;
    requirement: boolean;
  };
  format_version: number;
  kn: { id: string; name: string };
  name: string;
  naming_language: string;
};

function packageForm(file: File, options?: object) {
  const form = new FormData();
  form.append("file", file);
  if (options) {
    form.append("options", JSON.stringify(options));
  }
  return form;
}

/** Reads what a project package holds, before importing it. */
export async function previewProjectPackage(file: File): Promise<ProjectPackagePreview> {
  const item: BackendPackagePreview = useMock
    ? await wait({
        catalogs: [{ id: "cat-001", name: "ERP" }],
        contents: {
          confirmed_files: 0,
          documents: 2,
          draft: true,
          editions: [],
          requirement: true,
        },
        format_version: 1,
        kn: { id: "supply_chain", name: "Supply Chain" },
        name: file.name.replace(/\.bknproj$/i, ""),
        naming_language: "en-US",
      })
    : (
        await http.post<BackendPackagePreview>(
          "/bkn-project/v1/project-packages/preview",
          packageForm(file),
          { skipErrorToast: true },
        )
      ).data;
  return {
    catalogs: (item.catalogs ?? []).map(({ id, name }) => ({ id, name })),
    contents: {
      confirmedFiles: item.contents.confirmed_files,
      documents: item.contents.documents,
      draft: item.contents.draft,
      editions: item.contents.editions ?? [],
      requirement: item.contents.requirement,
    },
    formatVersion: item.format_version,
    kn: item.kn,
    name: item.name,
    namingLanguage: namingLanguage(item.naming_language),
  };
}

/** Creates a project from a package, on the chosen network and with its catalogs mapped. */
export async function importProjectPackage(
  file: File,
  input: ImportProjectInput,
): Promise<Project> {
  const options = {
    catalog_mapping: input.catalogMapping,
    enable_versioning: input.enableVersioning || undefined,
    kn_id: input.knId || undefined,
    name: input.name.trim(),
    new_kn: input.newKnName ? { name: input.newKnName.trim() } : undefined,
  };
  if (useMock) {
    return createProject({
      catalogIds: Object.values(input.catalogMapping),
      enableVersioning: input.enableVersioning,
      knId: input.knId,
      name: input.name,
      namingLanguage: (await previewProjectPackage(file)).namingLanguage,
      newKnName: input.newKnName,
    });
  }
  const response = await http.post<BackendProject>(
    "/bkn-project/v1/project-packages/import",
    packageForm(file, options),
    { skipErrorToast: true },
  );
  return mapProject(response.data);
}

/**
 * Replaces the data catalogs the project drafts from; only its owner may. The draft is kept:
 * drafting again reads the new catalogs.
 */
export async function setProjectCatalogs(id: string, catalogIds: string[]): Promise<Project> {
  if (useMock) {
    const project = mockProjects.find((item) => item.id === id);
    if (!project) {
      throw mockNotFound(id);
    }
    project.catalog_ids = [...new Set(catalogIds)];
    project.update_time = Date.now();
    return wait(mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  }
  const response = await http.put<BackendProject>(
    `${API_PREFIX}/${encodeURIComponent(id)}/catalogs`,
    { catalog_ids: catalogIds },
    { skipErrorToast: true },
  );
  return mapProject(response.data);
}

/** Adds catalogs to a mock project, as adding them to its draft does; for the draft's mock. */
export function mockAddProjectCatalogs(id: string, catalogIds: string[]) {
  const project = mockProjects.find((item) => item.id === id);
  if (project) {
    project.catalog_ids = [...new Set([...(project.catalog_ids ?? []), ...catalogIds])];
    project.update_time = Date.now();
  }
}

/**
 * Lists every knowledge network the caller can see, in one request: bkn-backend filters by
 * permission, the same way bkn-project decides which projects are visible.
 */
export async function listProjectNetworks(): Promise<ProjectNetwork[]> {
  if (useMock) {
    return wait([...mockNetworks]);
  }
  const response = await http.get<{ entries: ProjectNetwork[] | null }>(
    "/bkn-backend/v1/knowledge-networks",
    { skipErrorToast: true, params: { limit: -1, sort: "update_time", direction: "desc" } },
  );
  return (response.data.entries ?? []).map(({ id, name }) => ({ id, name }));
}

export async function getProject(id: string): Promise<Project> {
  if (useMock) {
    const project = mockProjects.find((item) => item.id === id);
    if (!project) {
      throw mockNotFound(id);
    }
    return wait(mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  }
  const response = await http.get<BackendProject>(`${API_PREFIX}/${encodeURIComponent(id)}`, {
    skipErrorToast: true,
  });
  return mapProject(response.data);
}

/** Returns a network the caller can see, or null when it cannot be read. */
export async function getProjectNetwork(knId: string): Promise<ProjectNetwork | null> {
  if (useMock) {
    return wait(mockNetworks.find((network) => network.id === knId) ?? null);
  }
  try {
    const response = await http.get<ProjectNetwork>(
      `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knId)}`,
      { skipErrorToast: true },
    );
    return { id: response.data.id, name: response.data.name };
  } catch {
    return null;
  }
}

/** Returns the newest release of the network's lineage, or null before the first one. */
export async function getLatestRelease(knId: string): Promise<ProjectRelease | null> {
  if (useMock) {
    return wait(
      knId === "supply_chain"
        ? {
            createTime: Date.parse("2026-10-20T09:00:00Z"),
            networkId: "supply_chain_v1_0_0",
            version: "1.0.0",
          }
        : null,
    );
  }
  const response = await http.get<{
    entries: { create_time: number; network_id: string; version: string }[] | null;
  }>(`/bkn-project/v1/lineages/${encodeURIComponent(knId)}/releases`, {
    params: { limit: 1 },
    skipErrorToast: true,
  });
  const newest = response.data.entries?.[0];
  return newest
    ? { createTime: newest.create_time, networkId: newest.network_id, version: newest.version }
    : null;
}

/** What an existing network brings to a new project: how much it models and the catalogs it reads. */
export type ExistingNetworkStart = {
  actionTypes: number;
  catalogIds: string[];
  conceptGroups: number;
  functions: number;
  objectTypes: number;
  relationTypes: number;
  skills: number;
};

/** Reads what a project created on the existing network would start from. */
export async function getExistingNetworkStart(networkId: string): Promise<ExistingNetworkStart> {
  const [statistics, listed] = await Promise.all([
    getKnowledgeNetworkStatistics(networkId),
    listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true }),
  ]);
  // The network's system object types are no content it brings, nor are the catalogs they read.
  const objectTypes = listed.filter((item) => !SYSTEM_OBJECT_TYPE_IDS.has(item.id));
  const systemCount = listed.length - objectTypes.length;
  const resourceIds = objectTypes
    .map((item) =>
      item.dataSource?.type === "resource" || !item.dataSource?.type ? item.dataSource?.id : "",
    )
    .filter((id): id is string => Boolean(id));
  const resources = await getCatalogResources(resourceIds);
  return {
    actionTypes: statistics?.actionTypesTotal ?? 0,
    catalogIds: Array.from(
      new Set(resources.map((resource) => resource.catalogId).filter(Boolean)),
    ),
    conceptGroups: statistics?.conceptGroupsTotal ?? 0,
    functions: statistics?.functionsTotal ?? 0,
    objectTypes: statistics
      ? Math.max(statistics.objectTypesTotal - systemCount, 0)
      : objectTypes.length,
    relationTypes: statistics?.relationTypesTotal ?? 0,
    skills: statistics?.skillsTotal ?? 0,
  };
}
