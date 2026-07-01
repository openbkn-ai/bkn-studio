/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

import { getLabMeta } from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import {
  defaultLabFeatureFlags,
  type LabFeatureFlags,
  type LabMeta,
} from "@/modules/execution-factory-lab/types/lab-meta";

let cachedMeta: LabMeta | null = null;

function readEnvLabFeatureFlag(key: keyof LabFeatureFlags): boolean | undefined {
  const envKey = `VITE_LAB_FEATURE_${key.toUpperCase()}` as keyof ImportMetaEnv;
  const raw = import.meta.env[envKey];
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return undefined;
}

function readRuntimeLabFeatureFlag(key: keyof LabFeatureFlags): boolean | undefined {
  const runtimeFlags = getRuntimeConfig().features?.executionFactoryLab;
  if (!runtimeFlags) {
    return undefined;
  }
  return runtimeFlags[key];
}

export function resolveLabFeatureFlags(meta?: LabMeta | null): LabFeatureFlags {
  const base = meta?.features ?? cachedMeta?.features ?? defaultLabFeatureFlags;
  const keys = Object.keys(defaultLabFeatureFlags) as (keyof LabFeatureFlags)[];

  return keys.reduce<LabFeatureFlags>((resolved, key) => {
    const runtimeValue = readRuntimeLabFeatureFlag(key);
    if (typeof runtimeValue === "boolean") {
      resolved[key] = runtimeValue;
      return resolved;
    }

    const envValue = readEnvLabFeatureFlag(key);
    if (typeof envValue === "boolean") {
      resolved[key] = envValue;
      return resolved;
    }

    resolved[key] = base[key];
    return resolved;
  }, { ...defaultLabFeatureFlags });
}

export async function loadLabMeta(force = false): Promise<LabMeta> {
  if (!force && cachedMeta) {
    return cachedMeta;
  }

  cachedMeta = await getLabMeta();
  return cachedMeta;
}

export function getCachedLabMeta(): LabMeta | null {
  return cachedMeta;
}

export function isLabFeatureEnabled(
  key: keyof LabFeatureFlags,
  meta?: LabMeta | null,
): boolean {
  return resolveLabFeatureFlags(meta)[key];
}

export function shouldHideLegacyExecutionFactoryMenu(meta?: LabMeta | null): boolean {
  return isLabFeatureEnabled("hide_legacy_execution_factory_menu", meta);
}
