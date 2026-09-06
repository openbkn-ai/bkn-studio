/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ProxyLifecycleStatus = "active" | "archived" | "disabling";
export type ProxySyncStatus = "failed" | "pending" | "ready";

export type ProxyGovernanceAccount = {
  createdAt: number;
  knowledgeNetworkId: string;
  lastErrorCode?: "PROXY_SYNC_FAILED";
  lifecycleStatus: ProxyLifecycleStatus;
  proxyAccountId: string;
  proxyAccountType: "app";
  publishedModelVersion: string;
  syncStatus: ProxySyncStatus;
  syncedModelVersion: string;
  updatedAt: number;
  version: number;
};

export type ProxyGrantSource = {
  bindingId: string;
  bindingType: string;
  knowledgeNetworkId: string;
  operation: string;
  resourceId: string;
  resourceType: string;
  sourceId: string;
  sourceType: string;
};

export type ProxySyncPlan = {
  knowledgeNetworkId: string;
  modelVersion: string;
  proxyAccountId?: string;
  sources: ProxyGrantSource[];
};

export type ProxyReconcileReport = {
  authorizationDrift: Record<string, Record<string, number>>;
  conflictingProxyAccounts: Record<string, string[]>;
  failedKnowledgeNetworkIds: string[];
  missingMappings: string[];
  orphanMappings: string[];
};
