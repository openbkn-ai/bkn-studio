/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

const OBSERVABILITY_API_PREFIX = "/agent-observability/v1";

export type TraceAccessProfile = {
  accessScopeFingerprint: string;
  allowedLogCategories: string[];
  businessProvenanceManagedNetworks: boolean;
  businessProvenanceOwn: boolean;
  globalLogSearch: boolean;
  logExport: boolean;
  logPolicyRead: boolean;
  logSensitiveFields: boolean;
  managementAudit: boolean;
  securityAudit: boolean;
  technicalTrace: boolean;
};

type BackendTraceAccessProfile = {
  access_scope_fingerprint?: string;
  allowed_log_categories?: string[];
  business_provenance_managed_networks?: boolean;
  business_provenance_own?: boolean;
  global_log_search?: boolean;
  log_export?: boolean;
  log_policy_read?: boolean;
  log_sensitive_fields?: boolean;
  management_audit?: boolean;
  security_audit?: boolean;
  technical_trace?: boolean;
};

export async function getAccessProfile(): Promise<TraceAccessProfile> {
  const response = await http.get<BackendTraceAccessProfile>(
    `${OBSERVABILITY_API_PREFIX}/access-profile`,
    { headers: traceHeaders() },
  );
  return {
    accessScopeFingerprint: response.data.access_scope_fingerprint ?? "",
    allowedLogCategories: response.data.allowed_log_categories ?? [],
    businessProvenanceManagedNetworks: Boolean(response.data.business_provenance_managed_networks),
    businessProvenanceOwn: Boolean(response.data.business_provenance_own),
    globalLogSearch: Boolean(response.data.global_log_search),
    logExport: Boolean(response.data.log_export),
    logPolicyRead: Boolean(response.data.log_policy_read),
    logSensitiveFields: Boolean(response.data.log_sensitive_fields),
    managementAudit: Boolean(response.data.management_audit),
    securityAudit: Boolean(response.data.security_audit),
    technicalTrace: Boolean(response.data.technical_trace),
  };
}

function traceHeaders() {
  return {
    "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public",
  };
}
