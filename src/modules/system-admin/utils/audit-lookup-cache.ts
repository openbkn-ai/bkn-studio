/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  getUser,
  listDepartments,
  listRoles,
} from "@/modules/system-admin/services/admin.service";
import { isRequestNotFound } from "@/framework/request/error-message";
import type { AdminDepartment, AdminRole, AdminUser } from "@/modules/system-admin/types/admin";

const CACHE_TTL_MS = 5 * 60 * 1000;
// A source list can contain hundreds of distinct grantors. Keep directory
// enrichment responsive without allowing one page to flood the user API.
export const MAX_CONCURRENT_USER_LOOKUPS = 8;

type CacheEntry<T> = {
  data: T;
  loadedAt: number;
};

let departmentsCache: CacheEntry<AdminDepartment[]> | null = null;
let rolesCache: CacheEntry<AdminRole[]> | null = null;
const userCache = new Map<string, CacheEntry<AdminUser>>();
const deletedUserCache = new Map<string, number>();
type UserLookupJob = {
  cancelled: boolean;
  promise: Promise<UserLookupResult>;
  resolve: (result: UserLookupResult) => void;
  started: boolean;
  subscribers: number;
};

const inFlightUserLookups = new Map<string, UserLookupJob>();
const queuedUserLookups: Array<() => void> = [];
let activeUserLookups = 0;

export type UserLookupDetails = {
  deleted: string[];
  unavailable: string[];
};

export type UserLookupOptions = {
  signal?: AbortSignal;
};

type UserLookupResult = "resolved" | "deleted" | "unavailable";

/** An audit actor is not always a user; for example, the license service uses system:license. */
export function isUserLookupId(id: string) {
  return Boolean(id.trim()) && !id.trim().startsWith("system:");
}

function isFresh<T>(entry: CacheEntry<T> | null | undefined) {
  return Boolean(entry && Date.now() - entry.loadedAt < CACHE_TTL_MS);
}

export function primeUserLookupCache(users: AdminUser[]) {
  const now = Date.now();
  for (const user of users) {
    userCache.set(user.id, { data: user, loadedAt: now });
    deletedUserCache.delete(user.id);
  }
}

export async function getCachedDepartments(
  options?: { skipErrorToast?: boolean },
): Promise<AdminDepartment[]> {
  if (isFresh(departmentsCache)) {
    return departmentsCache!.data;
  }
  const data = await listDepartments(options);
  departmentsCache = { data, loadedAt: Date.now() };
  return data;
}

export async function getCachedRoles(): Promise<AdminRole[]> {
  if (isFresh(rolesCache)) {
    return rolesCache!.data;
  }
  const data = await listRoles();
  rolesCache = { data, loadedAt: Date.now() };
  return data;
}

export async function getCachedUser(id: string): Promise<AdminUser | null> {
  if (!isUserLookupId(id)) {
    return null;
  }
  const cached = userCache.get(id);
  if (isFresh(cached)) {
    return cached!.data;
  }
  if (isDeletedUserSync(id)) {
    return null;
  }
  const result = await lookupUser(id);
  return result === "resolved" ? getCachedUserSync(id) ?? null : null;
}

export async function hydrateUserLookup(ids: string[], options?: UserLookupOptions): Promise<string[]> {
  const result = await hydrateUserLookupDetails(ids, options);
  return [...result.deleted, ...result.unavailable];
}

export async function hydrateUserLookupDetails(
  ids: string[],
  options?: UserLookupOptions,
): Promise<UserLookupDetails> {
  const missing = [...new Set(ids)].filter(
    (id) => isUserLookupId(id) && !isFresh(userCache.get(id)) && !isDeletedUserSync(id),
  );
  if (!missing.length) {
    return { deleted: [], unavailable: [] };
  }
  const results = await Promise.all(missing.map((id) => lookupUser(id, options?.signal)));
  return {
    deleted: missing.filter((_id, index) => results[index] === "deleted"),
    unavailable: missing.filter((_id, index) => results[index] === "unavailable"),
  };
}

function lookupUser(id: string, signal?: AbortSignal): Promise<UserLookupResult> {
  if (signal?.aborted) {
    return Promise.resolve("unavailable");
  }
  let job = inFlightUserLookups.get(id);
  if (!job) {
    let resolveLookup!: (result: UserLookupResult) => void;
    const lookup = new Promise<UserLookupResult>((resolve) => {
      resolveLookup = resolve;
    });
    job = {
      cancelled: false,
      promise: lookup,
      resolve: resolveLookup,
      started: false,
      subscribers: 0,
    };
    inFlightUserLookups.set(id, job);
    const scheduledJob = job;
    scheduleUserLookup(async () => {
      let result: UserLookupResult = "unavailable";
      scheduledJob.started = true;
      if (scheduledJob.cancelled) {
        scheduledJob.resolve(result);
        return;
      }
      try {
        const user = await getUser(id, { skipErrorToast: true });
        userCache.set(id, { data: user, loadedAt: Date.now() });
        deletedUserCache.delete(id);
        result = "resolved";
      } catch (error) {
        if (isRequestNotFound(error)) {
          deletedUserCache.set(id, Date.now());
          result = "deleted";
        }
      } finally {
        if (inFlightUserLookups.get(id) === scheduledJob) {
          inFlightUserLookups.delete(id);
        }
        scheduledJob.resolve(result);
      }
    });
  }
  return subscribeToUserLookup(id, job, signal);
}

function subscribeToUserLookup(
  id: string,
  job: UserLookupJob,
  signal?: AbortSignal,
): Promise<UserLookupResult> {
  job.subscribers += 1;
  return new Promise<UserLookupResult>((resolve) => {
    let settled = false;
    const release = () => {
      if (settled) {
        return;
      }
      settled = true;
      job.subscribers -= 1;
      if (job.subscribers === 0 && !job.started) {
        job.cancelled = true;
        if (inFlightUserLookups.get(id) === job) {
          inFlightUserLookups.delete(id);
        }
      }
    };
    const finish = (result: UserLookupResult) => {
      signal?.removeEventListener("abort", onAbort);
      release();
      resolve(result);
    };
    const onAbort = () => finish("unavailable");
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    void job.promise.then(finish);
  });
}

function scheduleUserLookup(task: () => Promise<void>) {
  const run = () => {
    activeUserLookups += 1;
    void task().finally(() => {
      activeUserLookups -= 1;
      queuedUserLookups.shift()?.();
    });
  };
  if (activeUserLookups < MAX_CONCURRENT_USER_LOOKUPS) {
    run();
    return;
  }
  queuedUserLookups.push(run);
}

export function getCachedUserSync(id: string): AdminUser | undefined {
  const cached = userCache.get(id);
  return isFresh(cached) ? cached!.data : undefined;
}

export function isDeletedUserSync(id: string): boolean {
  const loadedAt = deletedUserCache.get(id);
  if (loadedAt === undefined) {
    return false;
  }
  if (Date.now() - loadedAt < CACHE_TTL_MS) {
    return true;
  }
  deletedUserCache.delete(id);
  return false;
}

export function listCachedUsers(): AdminUser[] {
  const users: AdminUser[] = [];
  for (const entry of userCache.values()) {
    if (isFresh(entry)) {
      users.push(entry.data);
    }
  }
  return users;
}

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatAuditTime(value: string, locale: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  let formatter = timeFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    timeFormatterCache.set(locale, formatter);
  }
  return formatter.format(date).replace(/\//g, "-");
}
