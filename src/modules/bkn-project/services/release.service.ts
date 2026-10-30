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
  LineageRelease,
  PublishInput,
  Regression,
  ReleaseItem,
  ReleaseQuestion,
  ReleaseReview,
  RollbackNetwork,
  RollbackPlan,
  SwitchPlan,
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

type BackendRegression = {
  attempt: number;
  error: string;
  finish_time: number;
  network_id: string;
  questions:
    | {
        id: string;
        tests?: { expect: string; id: string; text: string }[] | null;
        text: string;
      }[]
    | null;
  results:
    | {
        answer?: string;
        error_code?: string;
        missing?: BackendItem[] | null;
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

export const mapRegression = (regression: BackendRegression): Regression => ({
  attempt: regression.attempt,
  error: regression.error,
  finishTime: regression.finish_time,
  networkId: regression.network_id,
  questions: (regression.questions ?? []).map((question) => ({
    id: question.id,
    tests: (question.tests ?? []).map(({ expect, id, text }) => ({ expect, id, text })),
    text: question.text,
  })),
  results: (regression.results ?? []).map((result) => ({
    answer: result.answer ?? "",
    errorCode: result.error_code ?? "",
    missing: items(result.missing),
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
  const seen = new Set<string>();
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
    // A cursor that does not move on would page forever: stop at one seen before.
    if (cursor && seen.has(cursor)) {
      break;
    }
    if (cursor) {
      seen.add(cursor);
    }
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

type BackendRollbackNetwork = { base: boolean; network_id: string; version?: string };

const rollbackNetwork = (network: BackendRollbackNetwork): RollbackNetwork => ({
  base: network.base,
  networkId: network.network_id,
  version: network.version ?? "",
});

/** What rolling consumers back to the network before the one in use would do; changes nothing. */
export async function getRollbackPlan(projectId: string): Promise<RollbackPlan> {
  if (useMock) {
    const at = mockReleases.findIndex((release) => release.networkId === mockInUse);
    const previous = at > 0 ? mockReleases[at - 1] : null;
    return wait({
      consumers: ["agents", "mcp", "workshop", "eval"],
      from: { base: at < 0, networkId: mockInUse, version: at < 0 ? "" : mockReleases[at].version },
      questions: { affected: [], answerableNew: [], total: 0, unanswerable: [], unjudged: 0 },
      refusals: at < 0 ? ["Rollback.NoPrevious"] : [],
      schedules: [{ id: "s1", name: "Nightly delay warning" }],
      signature: `mock-${mockInUse}`,
      to: previous
        ? { base: false, networkId: previous.networkId, version: previous.version }
        : at === 0
          ? { base: true, networkId: "supply_chain", version: "" }
          : null,
    });
  }
  const response = await http.get<{
    consumers: string[] | null;
    from: BackendRollbackNetwork;
    questions?: BackendReview["questions"];
    refusals: { code: string }[] | null;
    schedules: { id?: string; name: string }[] | null;
    signature: string;
    to?: BackendRollbackNetwork | null;
  }>(`${projectPath(projectId)}/rollback-plan`, { skipErrorToast: true });
  const plan = response.data;
  return {
    consumers: plan.consumers ?? [],
    from: rollbackNetwork(plan.from),
    questions: mapQuestions(plan.questions),
    refusals: (plan.refusals ?? []).map(({ code }) => code),
    schedules: (plan.schedules ?? []).map((schedule, index) => ({
      id: schedule.id ?? String(index),
      name: schedule.name,
    })),
    signature: plan.signature,
    to: plan.to ? rollbackNetwork(plan.to) : null,
  };
}

/**
 * Switches consumers back as the plan read said, while it still stands. Only schedules move and
 * the switch is recorded: no data or definitions are rewritten.
 */
export async function rollBack(projectId: string, signature: string): Promise<void> {
  if (useMock) {
    const plan = await getRollbackPlan(projectId);
    if (plan.signature !== signature) {
      throw refused(409, "Rollback.PlanOutdated");
    }
    mockInUse = plan.to?.networkId ?? mockInUse;
    return;
  }
  await http.post(`${projectPath(projectId)}/rollbacks`, { signature }, { skipErrorToast: true });
}

/** The regression of a release of the project, or null before one exists. */
export async function getRegression(
  projectId: string,
  networkId: string,
): Promise<Regression | null> {
  if (useMock) {
    return wait(mockRegression(networkId));
  }
  try {
    const response = await http.get<BackendRegression>(
      `${projectPath(projectId)}/releases/${encodeURIComponent(networkId)}/regression`,
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
export async function runRegression(projectId: string, networkId: string): Promise<Regression> {
  if (useMock) {
    mockRegressionStarts[networkId] = Date.now();
    return wait(mockRegression(networkId)!);
  }
  const response = await http.post<BackendRegression>(
    `${projectPath(projectId)}/releases/${encodeURIComponent(networkId)}/regression:run`,
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

/** When the mock's regressions started; each runs for a few seconds. */
const mockRegressionStarts: Record<string, number> = {};
const MOCK_REGRESSION_MS = 4000;

function mockRegression(networkId: string): Regression | null {
  const release = mockReleases.find((entry) => entry.networkId === networkId);
  if (!release || release.projectId === "p-002") {
    return null;
  }
  const start = (mockRegressionStarts[networkId] ??= release.createTime);
  const running = Date.now() - start < MOCK_REGRESSION_MS;
  return {
    attempt: 1,
    error: "",
    finishTime: running ? 0 : start + MOCK_REGRESSION_MS,
    networkId,
    questions: [
      {
        id: "q1",
        tests: [
          { expect: "exists", id: "t1", text: "Which orders of customer C-001 are late?" },
          { expect: "not_exists", id: "t2", text: "Which orders of customer C-999 are late?" },
        ],
        text: "Which orders of a customer are late?",
      },
      { id: "q3", tests: [], text: "Which products use part P-100?" },
    ],
    results: running
      ? []
      : [
          {
            answer: "Orders **SO-1** and **SO-7** are late.",
            errorCode: "",
            missing: [],
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
