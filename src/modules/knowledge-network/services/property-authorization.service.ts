/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  PropertyAccessDecision,
  PropertyAccessLevel,
  PropertyGrantEntry,
  PropertyGrantPatch,
  PropertyGrantPatchResult,
  PropertyGrantSnapshot,
  PropertyGrantSubject,
} from "@/modules/knowledge-network/types/property-authorization";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const PROPERTY_GRANTS = "/safe/v1/admin/property-grants";

type BackendGrantEntry = {
  created_at?: string;
  created_by?: string;
  expires_at?: string;
  level: PropertyAccessLevel;
  property_name: string;
  source?: string;
  source_ref?: string;
  updated_at?: string;
};

type BackendDecision = {
  level: PropertyAccessLevel;
  name: string;
  source: string;
};

type BackendSnapshot = {
  accessor: PropertyGrantSubject;
  decisions?: BackendDecision[];
  entries?: BackendGrantEntry[];
  object_type_ref: string;
};

const mockEntries = new Map<string, PropertyGrantEntry[]>();

function snapshotKey(subject: PropertyGrantSubject, objectTypeRef: string) {
  return `${subject.type}:${subject.id}:${objectTypeRef}`;
}

function mapEntry(entry: BackendGrantEntry): PropertyGrantEntry {
  return {
    createdAt: entry.created_at,
    createdBy: entry.created_by,
    expiresAt: entry.expires_at,
    level: entry.level,
    propertyName: entry.property_name,
    source: entry.source,
    sourceRef: entry.source_ref,
    updatedAt: entry.updated_at,
  };
}

function mapDecision(decision: BackendDecision): PropertyAccessDecision {
  return { level: decision.level, name: decision.name, source: decision.source };
}

function mapSnapshot(snapshot: BackendSnapshot): PropertyGrantSnapshot {
  return {
    accessor: snapshot.accessor,
    decisions: snapshot.decisions?.map(mapDecision),
    entries: (snapshot.entries ?? []).map(mapEntry),
    objectTypeRef: snapshot.object_type_ref,
  };
}

export async function listPropertyGrantSnapshot(
  subject: PropertyGrantSubject,
  objectTypeRef: string,
): Promise<PropertyGrantSnapshot> {
  if (useMock) {
    return {
      accessor: { ...subject },
      entries: (mockEntries.get(snapshotKey(subject, objectTypeRef)) ?? []).map((entry) => ({
        ...entry,
      })),
      objectTypeRef,
    };
  }
  const response = await http.get<BackendSnapshot>(PROPERTY_GRANTS, {
    params: {
      accessor_id: subject.id,
      accessor_type: subject.type,
      object_type_ref: objectTypeRef,
    },
  });
  return mapSnapshot(response.data);
}

export async function patchPropertyGrants(
  patch: PropertyGrantPatch,
): Promise<PropertyGrantPatchResult> {
  if (useMock) {
    const key = snapshotKey(patch.accessor, patch.objectTypeRef);
    const entries = new Map(
      (mockEntries.get(key) ?? []).map((entry) => [entry.propertyName, { ...entry }]),
    );
    let changed = 0;
    for (const change of patch.changes) {
      const existing = entries.get(change.propertyName);
      if (change.level === "inherit") {
        if (entries.delete(change.propertyName)) {
          changed += 1;
        }
        continue;
      }
      if (
        existing?.level === change.level &&
        existing.expiresAt === change.expiresAt &&
        existing.source === (change.source ?? "manual") &&
        existing.sourceRef === change.sourceRef
      ) {
        continue;
      }
      const now = new Date().toISOString();
      entries.set(change.propertyName, {
        ...existing,
        createdAt: existing?.createdAt ?? now,
        expiresAt: change.expiresAt,
        level: change.level,
        propertyName: change.propertyName,
        source: change.source ?? "manual",
        sourceRef: change.sourceRef,
        updatedAt: now,
      });
      changed += 1;
    }
    const next = [...entries.values()].sort((left, right) =>
      left.propertyName.localeCompare(right.propertyName),
    );
    mockEntries.set(key, next);
    return {
      accessor: { ...patch.accessor },
      changed,
      entries: next.map((entry) => ({ ...entry })),
      objectTypeRef: patch.objectTypeRef,
    };
  }

  const response = await http.patch<BackendSnapshot & { changed?: number }>(PROPERTY_GRANTS, {
    accessor: patch.accessor,
    changes: patch.changes.map((change) => ({
      expires_at: change.expiresAt,
      level: change.level,
      property_name: change.propertyName,
      source: change.source,
      source_ref: change.sourceRef,
    })),
    object_type_ref: patch.objectTypeRef,
    reason: patch.reason,
  });
  return { ...mapSnapshot(response.data), changed: response.data.changed ?? 0 };
}
