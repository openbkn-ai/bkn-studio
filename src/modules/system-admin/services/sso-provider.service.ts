/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { http } from "@/framework/request/http";

export type SSOProvider = {
  id: string;
  display_name: string;
  protocol: "oidc";
  adapter: "casdoor" | "generic";
  issuer: string;
  discovery_url: string;
  client_id: string;
  client_secret_env: string;
  redirect_uri: string;
  scopes: string;
  department_claim: string;
  allowed_client_ids: string;
  exchange_audience: string;
  external_required_scope: string;
  hydra_issue_scope: string;
  login_enabled: boolean;
  exchange_enabled: boolean;
  enabled: boolean;
  default_for_login: boolean;
  allow_insecure_http: boolean;
  has_client_secret: boolean;
};
export type SSOProviderInput = Omit<SSOProvider, "has_client_secret"> & { client_secret?: string };
export type SSOProviderPage = { entries: SSOProvider[]; total: number; next_cursor: string | null };
const base = "/safe/v1/admin/sso/providers";
export async function listSSOProviders(cursor?: string): Promise<SSOProviderPage> {
  return (await http.get<SSOProviderPage>(base, { params: { limit: 25, cursor } })).data;
}
export async function saveSSOProvider(
  input: Partial<SSOProviderInput>,
  id?: string,
): Promise<SSOProvider> {
  if (id) return (await http.patch<SSOProvider>(`${base}/${encodeURIComponent(id)}`, input)).data;
  return (await http.post<SSOProvider>(base, input)).data;
}
export async function testSSOProvider(input: SSOProviderInput): Promise<void> {
  await http.post(`${base}/test`, input);
}

export type DirectorySyncConfig = {
  provider_id: string;
  organization: string;
  enabled: boolean;
  interval_seconds: number;
  next_run_at: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success_at: string | null;
  last_error_code: string;
  users: number;
  departments: number;
  disabled_users: number;
  retained_departments: number;
};
export type DirectorySyncView = {
  config: DirectorySyncConfig;
  has_webhook_secret: boolean;
  webhook_path: string;
  running: boolean;
};
export type DirectorySyncInput = Pick<
  DirectorySyncConfig,
  "enabled" | "organization" | "interval_seconds"
> & { webhook_secret?: string };
const syncBase = (id: string) => `${base}/${encodeURIComponent(id)}/directory-sync`;
export async function getDirectorySync(id: string): Promise<DirectorySyncView> {
  return (await http.get<DirectorySyncView>(syncBase(id))).data;
}
export async function saveDirectorySync(
  id: string,
  input: DirectorySyncInput,
): Promise<DirectorySyncView> {
  return (await http.patch<DirectorySyncView>(syncBase(id), input)).data;
}
export async function runDirectorySync(id: string): Promise<void> {
  await http.post(`${syncBase(id)}/run`);
}
