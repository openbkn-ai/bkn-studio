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
import type { AdminDepartment, AdminRole, AdminUser } from "@/modules/system-admin/types/admin";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  loadedAt: number;
};

let departmentsCache: CacheEntry<AdminDepartment[]> | null = null;
let rolesCache: CacheEntry<AdminRole[]> | null = null;
const userCache = new Map<string, CacheEntry<AdminUser>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined) {
  return Boolean(entry && Date.now() - entry.loadedAt < CACHE_TTL_MS);
}

export function primeUserLookupCache(users: AdminUser[]) {
  const now = Date.now();
  for (const user of users) {
    userCache.set(user.id, { data: user, loadedAt: now });
  }
}

export async function getCachedDepartments(): Promise<AdminDepartment[]> {
  if (isFresh(departmentsCache)) {
    return departmentsCache!.data;
  }
  const data = await listDepartments();
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
  const cached = userCache.get(id);
  if (isFresh(cached)) {
    return cached!.data;
  }
  try {
    const user = await getUser(id);
    userCache.set(id, { data: user, loadedAt: Date.now() });
    return user;
  } catch {
    return null;
  }
}

export async function hydrateUserLookup(ids: string[]) {
  const missing = ids.filter((id) => id && !isFresh(userCache.get(id)));
  if (!missing.length) {
    return;
  }
  await Promise.all(missing.map((id) => getCachedUser(id)));
}

export function getCachedUserSync(id: string): AdminUser | undefined {
  const cached = userCache.get(id);
  return isFresh(cached) ? cached!.data : undefined;
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
