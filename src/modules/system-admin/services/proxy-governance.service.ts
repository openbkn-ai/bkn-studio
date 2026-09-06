/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  ProxyGovernanceAccount,
  ProxyGrantSource,
  ProxyLifecycleStatus,
  ProxyReconcileReport,
  ProxySyncPlan,
  ProxySyncStatus,
} from "@/modules/system-admin/types/proxy-governance";

type BackendProxyAccount = {
  created_at: number;
  kn_id: string;
  last_error_code?: "PROXY_SYNC_FAILED";
  lifecycle_status: ProxyLifecycleStatus;
  proxy_account_id: string;
  proxy_account_type: "app";
  published_model_version: string;
  sync_status: ProxySyncStatus;
  synced_model_version: string;
  updated_at: number;
  version: number;
};

type BackendProxyGrantSource = {
  binding_id: string;
  binding_type: string;
  kn_id: string;
  operation: string;
  resource_id: string;
  resource_type: string;
  source_id: string;
  source_type: string;
};

type BackendProxySyncPlan = {
  kn_id: string;
  model_version: string;
  proxy_account_id?: string;
  sources?: BackendProxyGrantSource[];
};

type BackendProxyReconcileReport = {
  authorization_drift?: Record<string, Record<string, number>>;
  conflicting_proxy_accounts?: Record<string, string[]>;
  failed_kn_ids?: string[];
  missing_mappings?: string[];
  orphan_mappings?: string[];
};

const PROXY_ACCOUNTS = "/bkn-backend/v1/proxy-accounts";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

const now = Date.now();
let mockAccounts: ProxyGovernanceAccount[] = [
  {
    createdAt: now - 21 * 86_400_000,
    knowledgeNetworkId: "kn-customer-360",
    lifecycleStatus: "active",
    proxyAccountId: "proxy-customer-360",
    proxyAccountType: "app",
    publishedModelVersion: "model-v12",
    syncStatus: "ready",
    syncedModelVersion: "model-v12",
    updatedAt: now - 12 * 60_000,
    version: 12,
  },
  {
    createdAt: now - 14 * 86_400_000,
    knowledgeNetworkId: "kn-finance-risk",
    lifecycleStatus: "active",
    proxyAccountId: "proxy-finance-risk",
    proxyAccountType: "app",
    publishedModelVersion: "model-v8",
    syncStatus: "pending",
    syncedModelVersion: "model-v7",
    updatedAt: now - 4 * 60_000,
    version: 8,
  },
  {
    createdAt: now - 9 * 86_400_000,
    knowledgeNetworkId: "kn-supply-chain",
    lastErrorCode: "PROXY_SYNC_FAILED",
    lifecycleStatus: "active",
    proxyAccountId: "proxy-supply-chain",
    proxyAccountType: "app",
    publishedModelVersion: "model-v5",
    syncStatus: "failed",
    syncedModelVersion: "model-v4",
    updatedAt: now - 43 * 60_000,
    version: 5,
  },
];

const mockSources: Record<string, ProxyGrantSource[]> = {
  "kn-customer-360": [
    {
      bindingId: "customer",
      bindingType: "object_type",
      knowledgeNetworkId: "kn-customer-360",
      operation: "view_detail",
      resourceId: "customer-master",
      resourceType: "resource",
      sourceId: "customer",
      sourceType: "kn_proxy_binding",
    },
    {
      bindingId: "customer",
      bindingType: "object_type",
      knowledgeNetworkId: "kn-customer-360",
      operation: "query_data",
      resourceId: "customer-master",
      resourceType: "resource",
      sourceId: "customer",
      sourceType: "kn_proxy_binding",
    },
  ],
  "kn-finance-risk": [
    {
      bindingId: "risk-event",
      bindingType: "object_type",
      knowledgeNetworkId: "kn-finance-risk",
      operation: "query_data",
      resourceId: "risk-events",
      resourceType: "resource",
      sourceId: "risk-event",
      sourceType: "kn_proxy_binding",
    },
  ],
};

export function mapProxyAccount(item: BackendProxyAccount): ProxyGovernanceAccount {
  return {
    createdAt: item.created_at,
    knowledgeNetworkId: item.kn_id,
    lastErrorCode: item.last_error_code,
    lifecycleStatus: item.lifecycle_status,
    proxyAccountId: item.proxy_account_id,
    proxyAccountType: item.proxy_account_type,
    publishedModelVersion: item.published_model_version,
    syncStatus: item.sync_status,
    syncedModelVersion: item.synced_model_version,
    updatedAt: item.updated_at,
    version: item.version,
  };
}

function mapGrantSource(item: BackendProxyGrantSource): ProxyGrantSource {
  return {
    bindingId: item.binding_id,
    bindingType: item.binding_type,
    knowledgeNetworkId: item.kn_id,
    operation: item.operation,
    resourceId: item.resource_id,
    resourceType: item.resource_type,
    sourceId: item.source_id,
    sourceType: item.source_type,
  };
}

export async function listProxyAccounts(): Promise<ProxyGovernanceAccount[]> {
  if (useMock) {
    return wait(mockAccounts.map((item) => ({ ...item })));
  }
  const response = await http.get<{ entries?: BackendProxyAccount[]; total?: number }>(PROXY_ACCOUNTS, {
    skipErrorToast: true,
  });
  return (response.data.entries ?? []).map(mapProxyAccount);
}

export async function getProxySyncPlan(knowledgeNetworkId: string): Promise<ProxySyncPlan> {
  if (useMock) {
    const account = mockAccounts.find((item) => item.knowledgeNetworkId === knowledgeNetworkId);
    return wait({
      knowledgeNetworkId,
      modelVersion: account?.publishedModelVersion ?? "",
      proxyAccountId: account?.proxyAccountId,
      sources: (mockSources[knowledgeNetworkId] ?? []).map((item) => ({ ...item })),
    });
  }
  const response = await http.get<BackendProxySyncPlan>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knowledgeNetworkId)}/proxy-account/plan`,
    { skipErrorToast: true },
  );
  return {
    knowledgeNetworkId: response.data.kn_id,
    modelVersion: response.data.model_version,
    proxyAccountId: response.data.proxy_account_id,
    sources: (response.data.sources ?? []).map(mapGrantSource),
  };
}

export async function retryProxySync(knowledgeNetworkId: string): Promise<ProxyGovernanceAccount> {
  if (useMock) {
    const account = mockAccounts.find((item) => item.knowledgeNetworkId === knowledgeNetworkId);
    if (!account) {
      throw new Error("Proxy account mapping is unavailable.");
    }
    const synced = {
      ...account,
      lastErrorCode: undefined,
      syncStatus: "ready" as const,
      syncedModelVersion: account.publishedModelVersion,
      updatedAt: Date.now(),
    };
    mockAccounts = mockAccounts.map((item) => (
      item.knowledgeNetworkId === knowledgeNetworkId ? synced : item
    ));
    return wait({ ...synced });
  }
  const response = await http.post<BackendProxyAccount>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knowledgeNetworkId)}/proxy-account/sync`,
    undefined,
    { skipErrorToast: true },
  );
  return mapProxyAccount(response.data);
}

export async function reconcileProxyAccounts(): Promise<ProxyReconcileReport> {
  if (useMock) {
    return wait({
      authorizationDrift: {},
      conflictingProxyAccounts: {},
      failedKnowledgeNetworkIds: [],
      missingMappings: ["kn-product-catalog"],
      orphanMappings: [],
    });
  }
  const response = await http.post<BackendProxyReconcileReport>(
    `${PROXY_ACCOUNTS}/reconcile`,
    undefined,
    { skipErrorToast: true },
  );
  return {
    authorizationDrift: response.data.authorization_drift ?? {},
    conflictingProxyAccounts: response.data.conflicting_proxy_accounts ?? {},
    failedKnowledgeNetworkIds: response.data.failed_kn_ids ?? [],
    missingMappings: response.data.missing_mappings ?? [],
    orphanMappings: response.data.orphan_mappings ?? [],
  };
}
