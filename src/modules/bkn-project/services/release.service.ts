/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { isRequestNotFound } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getProject } from "@/modules/bkn-project/services/project.service";
import type {
  NetworkVersion,
  PrepareInput,
  ProjectVersions,
  PublishInput,
  PublishResult,
  Regression,
  ReleaseItem,
  ReleaseQuestion,
  ReleaseReview,
  RollbackPlan,
  RollbackVersion,
} from "@/modules/bkn-project/types/release";

const API_PREFIX = "/bkn-project/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const projectPath = (projectId: string) =>
  `${API_PREFIX}/projects/${encodeURIComponent(projectId)}`;

/** How often a running regression is read again. */
export const REGRESSION_POLL_MS = 10000;

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
  release: {
    base_version: string;
    network_id: string;
    network_name: string;
    running_label?: string;
    running_version?: number;
  };
  risks: {
    copies: number;
    existing: BackendItem[] | null;
    only_additions: boolean;
    orphans: (BackendItem & { orphans: number })[] | null;
    unimplemented_needs?: { id: string; kind: string; name: string }[] | null;
  };
  signature: string;
  version: string;
};

type BackendPrepared = {
  publisher: { id: string } | null;
  publisher_name?: string;
  update_time: number;
  version: string;
};

type BackendVersion = {
  base_version: number;
  publish_time: number;
  label: string;
  notes: string;
  origin: string;
  publisher: { id: string } | null;
  publisher_name?: string;
  release?: string;
  status: string;
  version: number;
};

type BackendVersions = {
  entries: BackendVersion[] | null;
  prepared?: BackendPrepared | null;
  versioning: {
    draft?: { base_version: number; has_changes: boolean; outdated: boolean } | null;
    full_history: boolean;
    previous_version: number;
    running_version: number;
  };
};

type BackendRegression = {
  attempt: number;
  error: string;
  finish_time: number;
  questions:
    | {
        id: string;
        no_record?: boolean;
        tests?: { expect: string; id: string; text: string }[] | null;
        text: string;
      }[]
    | null;
  results:
    | {
        answer?: string;
        error_code?: string;
        missing?: BackendItem[] | null;
        missing_tables?: BackendItem[] | null;
        outcome: string;
        question_id: string;
        reason?: string;
        test_id?: string;
        tool_uses?: { status?: string }[] | null;
      }[]
    | null;
  runner: { id: string } | null;
  start_time: number;
  status: string;
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

const mapQuestions = (questions: BackendReview["questions"]): ReleaseReview["questions"] => ({
  affected: (questions?.affected ?? []).map(mapQuestion),
  answerableNew: (questions?.answerable_new ?? []).map(mapQuestion),
  total: questions?.total ?? 0,
  unanswerable: (questions?.unanswerable ?? []).map(mapQuestion),
  unjudged: questions?.unjudged ?? 0,
});

export function mapReview(review: BackendReview): ReleaseReview {
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
    questions: mapQuestions(review.questions),
    refusals: (review.refusals ?? []).map(({ code }) => code),
    release: {
      baseVersion: review.release.base_version,
      networkId: review.release.network_id,
      networkName: review.release.network_name,
      runningLabel: review.release.running_label ?? "",
      runningVersion: review.release.running_version ?? 0,
    },
    risks: {
      copies: review.risks.copies,
      existing: items(review.risks.existing),
      onlyAdditions: review.risks.only_additions,
      orphans: (review.risks.orphans ?? []).map((orphan) => ({
        ...items([orphan])[0],
        orphans: orphan.orphans,
      })),
      unimplementedNeeds: (review.risks.unimplemented_needs ?? []).map(({ id, kind, name }) => ({
        id,
        kind,
        name,
      })),
    },
    signature: review.signature,
    version: review.version,
  };
}

export const mapRegression = (regression: BackendRegression): Regression => ({
  attempt: regression.attempt,
  error: regression.error,
  finishTime: regression.finish_time,
  questions: (regression.questions ?? []).map((question) => ({
    id: question.id,
    noRecord: question.no_record ?? false,
    tests: (question.tests ?? []).map(({ expect, id, text }) => ({ expect, id, text })),
    text: question.text,
  })),
  results: (regression.results ?? []).map((result) => ({
    answer: result.answer ?? "",
    errorCode: result.error_code ?? "",
    missing: items(result.missing),
    missingTables: items(result.missing_tables),
    outcome: result.outcome,
    questionId: result.question_id,
    reason: result.reason ?? "",
    testId: result.test_id ?? "",
    toolStatuses: (result.tool_uses ?? []).map((use) => use.status ?? ""),
  })),
  runnerId: regression.runner?.id ?? "",
  startTime: regression.start_time,
  status: regression.status,
  version: regression.version,
});

const mapVersion = (version: BackendVersion): NetworkVersion => ({
  baseVersion: version.base_version,
  createTime: version.publish_time,
  label: version.label,
  notes: version.notes,
  origin: version.origin,
  publisherId: version.publisher?.id ?? "",
  publisherName: version.publisher_name,
  release: version.release ?? "",
  status: version.status,
  version: version.version,
});

export const mapVersions = (data: BackendVersions): ProjectVersions => ({
  entries: (data.entries ?? []).map(mapVersion),
  prepared: data.prepared
    ? {
        publisherId: data.prepared.publisher?.id ?? "",
        publisherName: data.prepared.publisher_name,
        updateTime: data.prepared.update_time,
        version: data.prepared.version,
      }
    : null,
  versioning: {
    draft: {
      baseVersion: data.versioning.draft?.base_version ?? 0,
      hasChanges: data.versioning.draft?.has_changes ?? false,
      outdated: data.versioning.draft?.outdated ?? false,
    },
    fullHistory: data.versioning.full_history,
    previousVersion: data.versioning.previous_version,
    runningVersion: data.versioning.running_version,
  },
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
 * Writes the reviewed release into the network's draft, once its review still stands and what did
 * not pass is accepted, and starts its scenario regression there. The running version stays.
 */
export async function prepareRelease(projectId: string, input: PrepareInput): Promise<void> {
  if (useMock) {
    await wait(await mockPrepare(projectId, input));
    return;
  }
  await http.post(
    `${projectPath(projectId)}/releases/${encodeURIComponent(input.version)}/prepare`,
    {
      accepts: input.accepts,
      overwrite_draft_changes: input.overwriteDraftChanges,
      signature: input.signature,
    },
    { skipErrorToast: true },
  );
}

/** Publishes the prepared release as the network's running version. */
export async function publishRelease(
  projectId: string,
  input: PublishInput,
): Promise<PublishResult> {
  if (useMock) {
    return wait(await mockPublish(projectId, input));
  }
  const response = await http.post<{ kn_version: number; purged_version?: number }>(
    `${projectPath(projectId)}/releases`,
    { allow_outdated_base: input.allowOutdatedBase, notes: input.notes, version: input.version },
    { skipErrorToast: true },
  );
  return {
    knVersion: response.data.kn_version,
    purgedVersion: response.data.purged_version ?? 0,
  };
}

/** Brings the live version into the project's branch. */
export async function syncBranch(projectId: string): Promise<void> {
  if (useMock) {
    await wait(null);
    return;
  }
  await http.post(`${projectPath(projectId)}/branch:sync`, undefined, { skipErrorToast: true });
}

/** Commits what was edited on the network outside the project, then brings it into the project. */
export async function commitDrift(projectId: string): Promise<void> {
  if (useMock) {
    mockDraft.hasChanges = false;
    await wait(null);
    return;
  }
  await http.post(`${projectPath(projectId)}/drift:commit`, undefined, { skipErrorToast: true });
}

/** The versions of the project's network, newest first, its draft and the prepared release. */
export async function getProjectVersions(projectId: string): Promise<ProjectVersions> {
  if (useMock) {
    return wait(mockVersionsOf(projectId));
  }
  const response = await http.get<BackendVersions>(`${projectPath(projectId)}/versions`, {
    skipErrorToast: true,
  });
  return mapVersions(response.data);
}

/** Puts a version's content back into the project, and into the network's draft when it is kept. */
export async function copyVersion(
  projectId: string,
  knVersion: number,
  overwriteDraftChanges: boolean,
): Promise<void> {
  if (useMock) {
    await wait(mockCopy(knVersion, overwriteDraftChanges));
    return;
  }
  await http.post(
    `${projectPath(projectId)}/versions/${knVersion}/copy`,
    { overwrite_draft_changes: overwriteDraftChanges },
    { skipErrorToast: true },
  );
}

type BackendRollbackVersion = { kn_version: number; label: string; version?: string };

const rollbackVersion = (version: BackendRollbackVersion): RollbackVersion => ({
  knVersion: version.kn_version,
  label: version.label,
  version: version.version ?? "",
});

/**
 * What switching the running version back to `toVersion` would do, or to the previous version
 * without it; changes nothing.
 */
export async function getRollbackPlan(
  projectId: string,
  toVersion?: number,
): Promise<RollbackPlan> {
  if (useMock) {
    return wait(mockRollbackPlan(toVersion));
  }
  const response = await http.get<{
    from: BackendRollbackVersion;
    full_history: boolean;
    questions?: BackendReview["questions"];
    refusals: { code: string }[] | null;
    signature: string;
    to?: BackendRollbackVersion | null;
  }>(`${projectPath(projectId)}/rollback-plan`, {
    params: toVersion ? { to_version: toVersion } : undefined,
    skipErrorToast: true,
  });
  const plan = response.data;
  return {
    from: rollbackVersion(plan.from),
    fullHistory: plan.full_history,
    questions: mapQuestions(plan.questions),
    refusals: (plan.refusals ?? []).map(({ code }) => code),
    signature: plan.signature,
    to: plan.to ? rollbackVersion(plan.to) : null,
  };
}

/** Switches the running version as the plan read said, while it still stands, for every consumer. */
export async function rollBack(
  projectId: string,
  signature: string,
  toVersion: number,
): Promise<void> {
  if (useMock) {
    const plan = mockRollbackPlan(toVersion);
    if (plan.signature !== signature) {
      throw refused(409, "Rollback.PlanOutdated");
    }
    await wait(null);
    mockActivate(plan.to?.knVersion ?? mockRunning);
    return;
  }
  await http.post(
    `${projectPath(projectId)}/rollbacks`,
    { signature, to_version: toVersion },
    { skipErrorToast: true },
  );
}

/** The regression of a release of the project, by its version, or null before one exists. */
export async function getRegression(
  projectId: string,
  version: string,
): Promise<Regression | null> {
  if (useMock) {
    return wait(mockRegression(version));
  }
  try {
    const response = await http.get<BackendRegression>(
      `${projectPath(projectId)}/releases/${encodeURIComponent(version)}/regression`,
      { skipErrorToast: true },
    );
    return mapRegression(response.data);
  } catch (error) {
    // Release.RegressionNotFound before the first run.
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Runs the regression of a release again, with the questions the requirements have now. */
export async function runRegression(projectId: string, version: string): Promise<Regression> {
  if (useMock) {
    mockRegressionStarts[version] = Date.now();
    return wait(mockRegression(version)!);
  }
  const response = await http.post<BackendRegression>(
    `${projectPath(projectId)}/releases/${encodeURIComponent(version)}/regression:run`,
    undefined,
    { skipErrorToast: true },
  );
  return mapRegression(response.data);
}

/* ----------------------------- Mock (local development) ----------------------------- */
// One lineage, supply_chain, which both mock projects publish to.

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const mockOwnerId = defaultDevRuntimeUser.id ?? "mock-user";

/** A release of the mock lineage, prepared or published. */
type MockRelease = {
  createTime: number;
  knVersion: number;
  projectId: string;
  publisherId: string;
  version: string;
};

/** The published releases, oldest first. */
const mockReleases: MockRelease[] = [
  {
    createTime: Date.parse("2026-10-20T09:00:00Z"),
    knVersion: 1,
    projectId: "p-002",
    publisherId: "another-user",
    version: "1.0.0",
  },
];
/** The versions of the mock network, oldest first. */
const mockVersions: NetworkVersion[] = [
  {
    baseVersion: 0,
    createTime: Date.parse("2026-10-20T09:00:00Z"),
    label: "v1.0.0",
    notes: "",
    origin: "other_project",
    publisherId: "another-user",
    release: "1.0.0",
    status: "running",
    version: 1,
  },
];
let mockRunning = 1;
let mockPrevious = 0;
const mockDraft = { baseVersion: 1, hasChanges: false, outdated: false };
let mockPrepared: (MockRelease & { updateTime: number }) | null = null;

function mockVersionsOf(projectId: string): ProjectVersions {
  return {
    entries: [...mockVersions].reverse().map((entry) => {
      const release = mockReleases.find((item) => item.knVersion === entry.version);
      return {
        ...entry,
        origin: release
          ? release.projectId === projectId
            ? "project"
            : "other_project"
          : "workspace",
        status:
          entry.version === mockRunning
            ? "running"
            : entry.status === "running"
              ? "history"
              : entry.status,
      };
    }),
    prepared:
      mockPrepared?.projectId === projectId
        ? {
            publisherId: mockPrepared.publisherId,
            updateTime: mockPrepared.updateTime,
            version: mockPrepared.version,
          }
        : null,
    versioning: {
      draft: { ...mockDraft },
      fullHistory: true,
      previousVersion: mockPrevious,
      runningVersion: mockRunning,
    },
  };
}

/** The newest mock release of a project, for the mock status. */
export function mockProjectRelease(projectId: string) {
  const latest = mockReleases[mockReleases.length - 1];
  const rolledBack = latest.knVersion !== mockRunning;
  const running = mockVersions.find((entry) => entry.version === mockRunning);
  return latest.projectId === projectId
    ? {
        createTime: latest.createTime,
        latest: {
          knVersion: latest.knVersion,
          networkId: "supply_chain",
          rolledBack,
          running: rolledBack ? { knVersion: mockRunning, label: running?.label ?? "" } : null,
          version: latest.version,
        },
      }
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
      networkId: "supply_chain",
      networkName: `Supply Chain · ${version}`,
      runningLabel: "",
      runningVersion: 0,
    },
    risks: {
      copies: 0,
      existing: [],
      onlyAdditions: true,
      orphans: [],
      unimplementedNeeds: [{ id: "n2", kind: "skill", name: "Late order triage" }],
    },
    signature: `mock-${draft?.updateTime ?? 0}-${mockReleases.length}`,
    version,
  };
}

async function mockOwned(projectId: string) {
  const project = await getProject(projectId).catch(() => null);
  if (project?.owner.id !== mockOwnerId) {
    throw refused(403, "Release.NotOwner");
  }
}

async function mockPrepare(projectId: string, input: PrepareInput) {
  await mockOwned(projectId);
  const review = await mockReview(projectId, input.version);
  if (review.signature !== input.signature) {
    throw refused(409, "Release.ReviewOutdated");
  }
  if (review.blocked || !review.accepts.every((accept) => input.accepts.includes(accept))) {
    throw refused(409, "Release.ChecksFailed");
  }
  if (mockDraft.hasChanges && !input.overwriteDraftChanges) {
    throw refused(409, "Release.DraftHasChanges");
  }
  const now = Date.now();
  mockPrepared = {
    createTime: now,
    knVersion: 0,
    projectId,
    publisherId: mockOwnerId,
    updateTime: now,
    version: input.version,
  };
  mockRegressionStarts[input.version] = now;
  return null;
}

async function mockPublish(projectId: string, input: PublishInput): Promise<PublishResult> {
  await mockOwned(projectId);
  if (mockPrepared?.projectId !== projectId || mockPrepared.version !== input.version) {
    throw refused(409, "Release.NotPrepared");
  }
  if (mockDraft.outdated && !input.allowOutdatedBase) {
    throw refused(409, "Release.DraftOutdated");
  }
  const knVersion = mockVersions[mockVersions.length - 1].version + 1;
  const now = Date.now();
  mockVersions.push({
    baseVersion: mockDraft.baseVersion,
    createTime: now,
    label: `v${input.version}`,
    notes: input.notes.trim(),
    origin: "project",
    publisherId: mockOwnerId,
    release: input.version,
    status: "running",
    version: knVersion,
  });
  mockReleases.push({ ...mockPrepared, createTime: now, knVersion });
  mockPrepared = null;
  mockDraft.baseVersion = knVersion;
  mockActivate(knVersion);
  return { knVersion, purgedVersion: 0 };
}

function mockActivate(knVersion: number) {
  if (knVersion !== mockRunning) {
    mockPrevious = mockRunning;
    mockRunning = knVersion;
  }
  mockVersions.forEach((entry) => {
    if (entry.status === "running" && entry.version !== knVersion) {
      entry.status = "history";
    }
  });
  // The draft started from a version the running one was switched back from.
  mockDraft.outdated = mockDraft.baseVersion !== mockRunning;
}

function mockRollbackPlan(toVersion?: number): RollbackPlan {
  const asVersion = (knVersion: number): RollbackVersion => {
    const entry = mockVersions.find((item) => item.version === knVersion);
    return { knVersion, label: entry?.label ?? "", version: entry?.release ?? "" };
  };
  const to = toVersion || mockPrevious;
  return {
    from: asVersion(mockRunning),
    fullHistory: true,
    questions: { affected: [], answerableNew: [], total: 0, unanswerable: [], unjudged: 0 },
    refusals: to ? [] : ["Rollback.NoPrevious"],
    signature: `mock-${mockRunning}-${to}`,
    to: to ? asVersion(to) : null,
  };
}

function mockCopy(knVersion: number, overwrite: boolean) {
  if (!mockVersions.some((entry) => entry.version === knVersion)) {
    throw refused(410, "Release.VersionPurged");
  }
  if (mockDraft.hasChanges && !overwrite) {
    throw refused(409, "Release.DraftHasChanges");
  }
  return null;
}

/** When the mock's regressions started; each runs for a few seconds. */
const mockRegressionStarts: Record<string, number> = {};
const MOCK_REGRESSION_MS = 4000;

function mockRegression(version: string): Regression | null {
  const release =
    mockPrepared?.version === version
      ? mockPrepared
      : mockReleases.find((entry) => entry.version === version);
  if (!release || release.projectId === "p-002") {
    return null;
  }
  const start = (mockRegressionStarts[version] ??= release.createTime);
  const running = Date.now() - start < MOCK_REGRESSION_MS;
  return {
    attempt: 1,
    error: "",
    finishTime: running ? 0 : start + MOCK_REGRESSION_MS,
    questions: [
      {
        id: "q1",
        noRecord: false,
        tests: [
          { expect: "exists", id: "t1", text: "Which orders of customer C-001 are late?" },
          { expect: "not_exists", id: "t2", text: "Which orders of customer C-999 are late?" },
        ],
        text: "Which orders of a customer are late?",
      },
      { id: "q3", noRecord: false, tests: [], text: "Which products use part P-100?" },
    ],
    results: running
      ? []
      : [
          {
            answer: "Orders **SO-1** and **SO-7** are late.",
            errorCode: "",
            missing: [],
            missingTables: [],
            outcome: "passed",
            questionId: "q1",
            reason: "The answer lists the late orders from the network.",
            testId: "t1",
            toolStatuses: ["succeeded", "succeeded"],
          },
          {
            answer: "There is no customer C-999.",
            errorCode: "",
            missing: [],
            missingTables: [],
            outcome: "passed",
            questionId: "q1",
            reason: "The customer does not exist, as expected.",
            testId: "t2",
            toolStatuses: ["succeeded"],
          },
          {
            answer: "",
            errorCode: "",
            missing: [{ id: "material_bom", kind: "object_type", name: "material_bom" }],
            missingTables: [],
            outcome: "missing",
            questionId: "q3",
            reason: "",
            testId: "",
            toolStatuses: [],
          },
        ],
    runnerId: release.publisherId,
    startTime: start,
    status: running ? "running" : "not_passed",
    version: release.version,
  };
}
