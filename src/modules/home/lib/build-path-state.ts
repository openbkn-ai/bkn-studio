/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type HomeBuildPath = "engineering" | "platform";
export type HomeBuildStage = "environment" | "data" | "model" | "validate";

const PLATFORM_STAGES: HomeBuildStage[] = ["environment", "data", "model", "validate"];

export function readHomeBuildState(searchParams: URLSearchParams) {
  const path: HomeBuildPath = searchParams.get("path") === "platform" ? "platform" : "engineering";
  const requestedStage = searchParams.get("stage");
  const stage = PLATFORM_STAGES.find((item) => item === requestedStage) ?? "environment";

  return { path, stage };
}

export function writeHomeBuildState(
  searchParams: URLSearchParams,
  state: { path: HomeBuildPath; stage: HomeBuildStage },
) {
  const next = new URLSearchParams(searchParams);

  if (state.path === "engineering") {
    next.delete("path");
    next.delete("stage");
    return next;
  }

  next.set("path", "platform");
  next.set("stage", state.stage);
  return next;
}
