/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import type {
  CreateProjectInput,
  Project,
  ProjectListQuery,
  ProjectListResult,
  ProjectNetwork,
  ProjectRelease,
} from "@/modules/bkn-project/types/project";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendProject = {
  archived: boolean;
  baseline_network_id: string;
  branch: string;
  catalog_ids: string[] | null;
  create_time: number;
  id: string;
  kn_id: string;
  name: string;
  other_projects: number;
  owner: { id: string; type: string };
  update_time: number;
};

type BackendProjectList = {
  entries: BackendProject[] | null;
  next_cursor: string | null;
  total: number;
};

export function mapProject(item: BackendProject): Project {
  return {
    archived: item.archived,
    baselineNetworkId: item.baseline_network_id,
    branch: item.branch,
    catalogIds: item.catalog_ids ?? [],
    createTime: item.create_time,
    id: item.id,
    knId: item.kn_id,
    name: item.name,
    otherProjects: item.other_projects,
    owner: item.owner,
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
    catalog_ids: ["cat-001"],
    create_time: Date.parse("2026-10-20T09:00:00Z"),
    id: "p-001",
    kn_id: "supply_chain",
    name: "Delivery Delay Warning",
    other_projects: 1,
    owner: mockOwner,
    update_time: Date.parse("2026-10-26T10:00:00Z"),
  },
  {
    archived: false,
    baseline_network_id: "supply_chain_v1_0_0",
    branch: "project/p-002",
    catalog_ids: ["fi_ar_receipts"],
    create_time: Date.parse("2026-10-22T09:00:00Z"),
    id: "p-002",
    kn_id: "supply_chain",
    name: "Receipts Matching",
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
    .filter((project) => query.archived === "all" || String(project.archived) === query.archived)
    .filter((project) => !name || project.name.toLowerCase().includes(name))
    .sort((left, right) => right.create_time - left.create_time)
    .map((project) => mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  return { items: items.slice(0, query.limit), nextCursor: null, total: items.length };
}

/* ------------------------------- API ------------------------------- */

/** Lists the projects of the networks the caller can see, newest first, a cursor page at a time. */
export async function listProjects(query: ProjectListQuery): Promise<ProjectListResult> {
  if (useMock) {
    return wait(mockList(query));
  }
  const response = await http.get<BackendProjectList>(API_PREFIX, {
    skipErrorToast: true,
    params: {
      archived: query.archived,
      cursor: query.cursor || undefined,
      limit: query.limit,
      name: query.name.trim() || undefined,
    },
  });
  return {
    items: (response.data.entries ?? []).map(mapProject),
    nextCursor: response.data.next_cursor,
    total: response.data.total,
  };
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (useMock) {
    const now = Date.now();
    const knId = input.knId ?? `new_${now}`;
    const created: BackendProject = {
      archived: false,
      baseline_network_id: knId,
      branch: `project/mock-${now}`,
      catalog_ids: input.catalogIds,
      create_time: now,
      id: `mock-${now}`,
      kn_id: knId,
      name: input.name.trim(),
      other_projects: 0,
      owner: mockOwner,
      update_time: now,
    };
    if (input.newKnName) {
      mockNetworks.unshift({ id: knId, name: input.newKnName.trim() });
    }
    mockProjects.unshift(created);
    return wait(mapProject({ ...created, other_projects: mockOtherProjects(created) }));
  }
  const response = await http.post<BackendProject>(API_PREFIX, {
    catalog_ids: input.catalogIds,
    kn_id: input.knId || undefined,
    name: input.name.trim(),
    new_kn: input.newKnName ? { name: input.newKnName.trim() } : undefined,
  });
  return mapProject(response.data);
}

/** Archives or unarchives a project; only its owner may. */
export async function setProjectArchived(id: string, archived: boolean): Promise<Project> {
  if (useMock) {
    const project = mockProjects.find((item) => item.id === id);
    if (!project) {
      throw mockNotFound(id);
    }
    project.archived = archived;
    project.update_time = Date.now();
    return wait(mapProject({ ...project, other_projects: mockOtherProjects(project) }));
  }
  const action = archived ? "archive" : "unarchive";
  const response = await http.post<BackendProject>(
    `${API_PREFIX}/${encodeURIComponent(id)}:${action}`,
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

/**
 * Adds data catalogs to a project with a ready draft. bkn-project drafts the new catalogs' tables
 * in the background, leaving what people decided as it is; read the draft again to follow it.
 */
export async function addProjectCatalogs(id: string, catalogIds: string[]): Promise<void> {
  if (useMock) {
    const project = mockProjects.find((item) => item.id === id);
    if (!project) {
      throw mockNotFound(id);
    }
    project.catalog_ids = [...new Set([...(project.catalog_ids ?? []), ...catalogIds])];
    project.update_time = Date.now();
    return wait(undefined);
  }
  await http.post(
    `${API_PREFIX}/${encodeURIComponent(id)}/catalogs:add`,
    { catalog_ids: catalogIds },
    { skipErrorToast: true },
  );
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
