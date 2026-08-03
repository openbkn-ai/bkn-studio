/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type RecentVisitKind = "knowledge-network" | "data-resource" | "execution-unit";

export type RecentVisit = {
  id: string;
  kind: RecentVisitKind;
  path: string;
  title: string;
  visitedAt: number;
};

export type RecentVisitInput = Omit<RecentVisit, "visitedAt">;

const STORAGE_KEY_PREFIX = "bkn-studio:recent-visits";
const MAX_ENTRIES = 8;

/** 共用终端上会有多个账号登录,最近访问按用户分桶,避免互相看到对方的资源名。 */
function storageKey(userId: string | null) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? "anonymous"}`;
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    // Safari 隐私模式等场景访问 localStorage 会直接抛错。
    return null;
  }
}

function isRecentVisit(value: unknown): value is RecentVisit {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RecentVisit>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.visitedAt === "number"
  );
}

function sameEntry(left: Pick<RecentVisit, "id" | "kind">, right: Pick<RecentVisit, "id" | "kind">) {
  return left.kind === right.kind && left.id === right.id;
}

export function listRecentVisits(userId: string | null): RecentVisit[] {
  const storage = readStorage();

  if (!storage) {
    return [];
  }

  const raw = storage.getItem(storageKey(userId));

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentVisit)
      .sort((left, right) => right.visitedAt - left.visitedAt)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeRecentVisits(userId: string | null, visits: RecentVisit[]) {
  const storage = readStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey(userId), JSON.stringify(visits.slice(0, MAX_ENTRIES)));
  } catch {
    // 配额写满时静默降级:最近访问是辅助信息,不该打断正在进行的跳转。
  }
}

export function recordRecentVisit(userId: string | null, visit: RecentVisitInput) {
  if (!visit.id || !visit.path) {
    return;
  }

  const entry: RecentVisit = { ...visit, visitedAt: Date.now() };
  const rest = listRecentVisits(userId).filter((item) => !sameEntry(item, entry));

  writeRecentVisits(userId, [entry, ...rest]);
}

export function forgetRecentVisit(userId: string | null, kind: RecentVisitKind, id: string) {
  writeRecentVisits(
    userId,
    listRecentVisits(userId).filter((item) => !sameEntry(item, { id, kind })),
  );
}
