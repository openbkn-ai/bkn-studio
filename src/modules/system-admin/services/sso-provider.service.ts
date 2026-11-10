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
