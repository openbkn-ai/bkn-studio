/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnowledgeNetworkTaskJobType = "full" | "incremental";

export type KnowledgeNetworkTaskState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type KnowledgeNetworkTaskRecord = {
  duration: string;
  finishTime: string;
  id: string;
  jobType: KnowledgeNetworkTaskJobType;
  name: string;
  startTime: string;
  state: KnowledgeNetworkTaskState;
  stateDetail?: string;
};

export type KnowledgeNetworkTaskChildRecord = {
  conceptName: string;
  conceptType: string;
  duration: string;
  id: string;
  state: KnowledgeNetworkTaskState;
  stateDetail?: string;
};
