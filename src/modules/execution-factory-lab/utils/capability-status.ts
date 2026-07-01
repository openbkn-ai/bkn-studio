/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import type { CSSProperties } from "react";

export function formatCapabilityStatusLabel(status: string, t: TFunction): string {
  if (status === "published") {
    return t("executionFactoryLab.statusPublished");
  }
  if (status === "offline") {
    return t("executionFactoryLab.statusOffline");
  }
  if (status === "draft") {
    return t("executionFactoryLab.statusDraft");
  }
  return status;
}

export function getCapabilityStatusTagColor(status: string): "success" | "default" | "processing" {
  if (status === "published") {
    return "success";
  }
  if (status === "offline") {
    return "default";
  }
  return "processing";
}

export function getCapabilityStatusTagStyle(status: string): CSSProperties {
  if (status === "published") {
    return {
      background: "var(--color-success-bg)",
      borderColor: "var(--color-success-border)",
      color: "var(--color-success-text)",
    };
  }
  if (status === "offline") {
    return {
      background: "var(--color-error-bg)",
      borderColor: "var(--color-error-border)",
      color: "var(--color-error-text)",
    };
  }
  return {
    background: "#f1f5f9",
    borderColor: "#cbd5e1",
    color: "var(--color-text-secondary)",
  };
}
