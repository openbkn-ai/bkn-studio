/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getProject } from "@/modules/bkn-project/services/project.service";
import type {
  LineageRelease,
  PublishInput,
  ReleaseItem,
  ReleaseQuestion,
  ReleaseReview,
  SwitchPlan,
} from "@/modules/bkn-project/types/release";

const API_PREFIX = "/bkn-project/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const projectPath = (projectId: string) =>
  `${API_PREFIX}/projects/${encodeURIComponent(projectId)}`;

/* ------------------------------- Backend shapes ------------------------------- */

type BackendItem = { id: string; kind: string; name: string };

type BackendQuestion = {
  id: string;
  missing?: BackendItem[] | null;
  text: string;
  unconnected?: { from: BackendItem; to: BackendItem }[] | null;
};

type BackendReview = {
  accepts: string[] | null;
  blocked: boolean;
  capabilities:
    { copy: boolean; id: string; kind: string; name: string; reasons: string[] | null }[] | null;
  changes: {
    added: BackendItem[] | null;
    changed: BackendItem[] | null;
    other: number;
    removed: BackendItem[] | null;
  };
  checks: { accept?: string; code: string; details?: unknown; passed: boolean; reason?: string }[];
  questions?: {
    affected: BackendQuestion[] | null;
    answerable_new: BackendQuestion[] | null;
    total: number;
    unanswerable: BackendQuestion[] | null;
    unjudged: number;
  };
  refusals: { code: string }[] | null;
  release: { base_version: string; network_id: string; network_name: string };
  risks: {
    copies: number;
    existing: BackendItem[] | null;
    only_additions: boolean;
    orphans: (BackendItem & { orphans: number })[] | null;
  };
  signature: string;
  version: string;
};

type BackendRelease = {
  create_time: number;
  network_id: string;
  notes: string;
  project_id: string;
  publisher: { id: string } | null;
  state: string;
  version: string;
};

const items = (list: BackendItem[] | null | undefined): ReleaseItem[] =>
  (list ?? []).map(({ id, kind, name }) => ({ id, kind, name }));

const mapQuestion = (question: BackendQuestion): ReleaseQuestion => ({
  id: question.id,
  missing: items(question.missing),
  text: question.text,
  unconnected: (question.unconnected ?? []).map(({ from, to }) => ({
    from: items([from])[0],
    to: items([to])[0],
  })),
});

export function mapReview(review: BackendReview): ReleaseReview {
  const questions = review.questions;
  return {
    accepts: review.accepts ?? [],
    blocked: review.blocked,
    capabilities: (review.capabilities ?? []).map((capability) => ({
      copy: capability.copy,
      id: capability.id,
      kind: capability.kind,
      name: capability.name,
      reasons: capability.reasons ?? [],
    })),
    changes: {
      added: items(review.changes.added),
      changed: items(review.changes.changed),
      other: review.changes.other,
      removed: items(review.changes.removed),
    },
    checks: review.checks.map((check) => ({
      code: check.code,
      passed: check.passed,
      ...(check.reason ? { reason: check.reason } : {}),
      ...(check.accept ? { accept: check.accept } : {}),
      ...(check.details === undefined ? {} : { details: check.details }),
    })),
    questions: {
      affected: (questions?.affected ?? []).map(mapQuestion),
      answerableNew: (questions?.answerable_new ?? []).map(mapQuestion),
      total: questions?.total ?? 0,
      unanswerable: (questions?.unanswerable ?? []).map(mapQuestion),
      unjudged: questions?.unjudged ?? 0,
    },
    refusals: (review.refusals ?? []).map(({ code }) => code),
    release: {
      baseVersion: review.release.base_version,
      networkId: review.release.network_id,
      networkName: review.release.network_name,
    },
    risks: {
      copies: review.risks.copies,
      existing: items(review.risks.existing),
      onlyAdditions: review.risks.only_additions,
      orphans: (review.risks.orphans ?? []).map((orphan) => ({
        ...items([orphan])[0],
        orphans: orphan.orphans,
      })),
    },
    signature: review.signature,
    version: review.version,
  };
}

const mapRelease = (release: BackendRelease): LineageRelease => ({
  createTime: release.create_time,
  networkId: release.network_id,
  notes: release.notes,
  projectId: release.project_id,
  publisherId: release.publisher?.id ?? "",
  state: release.state,
  version: release.version,
});

/* ------------------------------------ API ------------------------------------ */

/** What publishing the project's branch as `version` would bring; nothing is changed. */
export async function getReleaseReview(projectId: string, version: string): Promise<ReleaseReview> {
  if (useMock) {
    return wait(await mockReview(projectId, version));
  }
  const response = await http.get<BackendReview>(`${projectPath(projectId)}/release-review`, {
    params: { version },
    skipErrorToast: true,
  });
  return mapReview(response.data);
}

/**
 * Publishes the project's branch once its review still stands and what did not pass is
 * accepted. The release's regression then starts in the background. Replies the new network.
 */
export async function publishRelease(
  projectId: string,
  input: PublishInput,
): Promise<{ networkId: string }> {
  if (useMock) {
    return wait(await mockPublish(projectId, input));
  }
  const response = await http.post<{ network_id: string }>(
    `${projectPath(projectId)}/releases`,
    {
      accepts: input.accepts,
      notes: input.notes,
      signature: input.signature,
      version: input.version,
    },
    { skipErrorToast: true },
  );
  return { networkId: response.data.network_id };
}

/** Brings the live version into the project's branch. */
export async function syncBranch(projectId: string): Promise<void> {
  if (useMock) {
    await wait(null);
    return;
  }
  await http.post(`${projectPath(projectId)}/branch:sync`, undefined, { skipErrorToast: true });
}

/** Commits what was edited on the live network, then brings it into the project's branch. */
export async function commitDrift(projectId: string): Promise<void> {
  if (useMock) {
    await wait(null);
    return;
  }
  await http.post(`${projectPath(projectId)}/drift:commit`, undefined, { skipErrorToast: true });
}

/** The releases of a network's lineage, newest first, by any project. */
export async function listReleases(lineageId: string): Promise<LineageRelease[]> {
  if (useMock) {
    return wait([...mockReleases].reverse());
  }
  const releases: LineageRelease[] = [];
  let cursor: string | null = null;
  do {
    const response: AxiosResponse<{
      entries: BackendRelease[] | null;
      next_cursor: string | null;
    }> = await http.get(`${API_PREFIX}/lineages/${encodeURIComponent(lineageId)}/releases`, {
      params: { limit: 100, ...(cursor ? { cursor } : {}) },
      skipErrorToast: true,
    });
    releases.push(...(response.data.entries ?? []).map(mapRelease));
    cursor = response.data.next_cursor;
  } while (cursor);
  return releases;
}

/** What switching consumers to a release of the project would move. */
export async function getSwitchPlan(projectId: string, toNetworkId: string): Promise<SwitchPlan> {
  if (useMock) {
    return wait({
      fromNetworkId: mockInUse,
      schedules: [{ id: "s1", name: "Nightly delay warning" }],
      toNetworkId,
    });
  }
  const response = await http.get<{
    from_network_id: string;
    schedules: { id?: string; name: string }[] | null;
    to_network_id: string;
  }>(`${projectPath(projectId)}/switch-plan`, {
    params: { to_network_id: toNetworkId },
    skipErrorToast: true,
  });
  return {
    fromNetworkId: response.data.from_network_id,
    schedules: (response.data.schedules ?? []).map((schedule, index) => ({
      id: schedule.id ?? String(index),
      name: schedule.name,
    })),
    toNetworkId: response.data.to_network_id,
  };
}

/** Switches consumers to a release of the project. */
export async function switchConsumers(projectId: string, toNetworkId: string): Promise<void> {
  if (useMock) {
    await wait(null);
    mockInUse = toNetworkId;
    return;
  }
  await http.post(
    `${projectPath(projectId)}/switches`,
    { to_network_id: toNetworkId },
    { skipErrorToast: true },
  );
}

/* ----------------------------- Mock (local development) ----------------------------- */
// One lineage, supply_chain, which both mock projects publish to.

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const mockOwnerId = defaultDevRuntimeUser.id ?? "mock-user";

const mockReleases: LineageRelease[] = [
  {
    createTime: Date.parse("2026-10-20T09:00:00Z"),
    networkId: "supply_chain_v1_0_0",
    notes: "",
    projectId: "p-002",
    publisherId: "another-user",
    state: "live",
    version: "1.0.0",
  },
];
let mockInUse = "supply_chain_v1_0_0";

/** The newest mock release of a project, and whether consumers use it; for the mock status. */
export function mockProjectRelease(projectId: string) {
  const latest = mockReleases[mockReleases.length - 1];
  return latest.projectId === projectId
    ? { createTime: latest.createTime, inUse: mockInUse === latest.networkId, latest }
    : null;
}

export const mockNextVersion = () => {
  const [major, minor, patch] = mockReleases[mockReleases.length - 1].version
    .split(".")
    .map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

const refused = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

async function mockReview(projectId: string, version: string): Promise<ReleaseReview> {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw refused(400, "Release.InvalidVersion");
  }
  const draft = await getDraft(projectId);
  const objects = draft?.items.objectTypes.filter((item) => item.adopted) ?? [];
  const relations = draft?.items.relationTypes.filter((item) => item.adopted) ?? [];
  const exists = mockReleases.some((release) => release.version === version);
  return {
    accepts: ["index_not_ready"],
    blocked: exists,
    capabilities: [],
    changes: {
      added: [
        ...objects.map(({ id, name }) => ({ id, kind: "object_type", name })),
        ...relations.map(({ id, name }) => ({ id, kind: "relation_type", name })),
      ],
      changed: [],
      other: 0,
      removed: [],
    },
    checks: [
      { code: "confirmed", passed: true },
      { code: "mapped", passed: true },
      { code: "names", passed: true },
      { code: "drift", passed: true },
      { code: "check", passed: true },
      {
        accept: "index_not_ready",
        code: "index",
        details: { not_configured: 1, ready: Math.max(objects.length - 1, 0) },
        passed: false,
        reason: "index_not_ready",
      },
      { code: "baseline", passed: true },
    ],
    questions: {
      affected: [],
      answerableNew: [{ id: "q1", missing: [], text: "Which orders are late?", unconnected: [] }],
      total: 2,
      unanswerable: [
        {
          id: "q3",
          missing: [{ id: "material_bom", kind: "object_type", name: "material_bom" }],
          text: "Which products use part P-100?",
          unconnected: [],
        },
      ],
      unjudged: 0,
    },
    refusals: exists ? ["Release.VersionExists"] : [],
    release: {
      baseVersion: mockReleases[mockReleases.length - 1].version,
      networkId: `supply_chain_v${version.replaceAll(".", "_")}`,
      networkName: `Supply Chain · ${version}`,
    },
    risks: { copies: 0, existing: [], onlyAdditions: true, orphans: [] },
    signature: `mock-${draft?.updateTime ?? 0}-${mockReleases.length}`,
    version,
  };
}

async function mockPublish(projectId: string, input: PublishInput) {
  const project = await getProject(projectId).catch(() => null);
  if (project?.owner.id !== mockOwnerId) {
    throw refused(403, "Release.NotOwner");
  }
  const review = await mockReview(projectId, input.version);
  if (review.signature !== input.signature) {
    throw refused(409, "Release.ReviewOutdated");
  }
  if (review.blocked || !review.accepts.every((accept) => input.accepts.includes(accept))) {
    throw refused(409, "Release.ChecksFailed");
  }
  mockReleases.forEach((release) => (release.state = "archived"));
  const accepted = input.accepts.length ? `Accepted: ${input.accepts.join(", ")}` : "";
  mockReleases.push({
    createTime: Date.now(),
    networkId: review.release.networkId,
    notes: [input.notes.trim(), accepted].filter(Boolean).join("\n\n"),
    projectId,
    publisherId: mockOwnerId,
    state: "live",
    version: input.version,
  });
  return { networkId: review.release.networkId };
}
