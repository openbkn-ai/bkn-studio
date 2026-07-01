/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";

export function resolveCapabilityKindLabel(kind: string, t: TFunction): string {
  if (kind === "http") {
    return t("executionFactoryLab.kindFilterHttp");
  }
  if (kind === "mcp") {
    return t("executionFactoryLab.kindFilterMcp");
  }
  if (kind === "skill") {
    return t("executionFactoryLab.kindFilterSkill");
  }
  if (kind === "function") {
    return t("executionFactoryLab.kindFilterFunction");
  }
  return kind.toUpperCase();
}

export function resolveCapabilityCardSubtitle(
  capability: CapabilityRecord,
  t: TFunction,
): string {
  if (capability.kind === "http") {
    if (capability.endpoint?.method && capability.endpoint.path) {
      return `${capability.endpoint.method} ${capability.endpoint.path}`;
    }
    if (capability.group?.name) {
      return capability.group.name;
    }
    return "";
  }

  if (capability.kind === "skill" && capability.version) {
    return t("executionFactoryLab.cardVersionLabel", { version: capability.version });
  }

  if (capability.group?.name) {
    return capability.group.name;
  }

  return "";
}
