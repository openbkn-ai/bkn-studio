/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parseEdition } from "@/framework/entitlement/edition";
import {
  FALLBACK_ENTITLEMENT,
  type Entitlement,
  type LicenseState,
} from "@/framework/entitlement/types";
import { http } from "@/framework/request/http";

const CAPABILITIES = "/safe/v1/capabilities";

// GET /api/safe/v1/capabilities — bkn-safe,只认证不鉴权(RequireUser),网关暴露。
type CapabilitiesResponse = {
  capabilities?: string[];
  edition?: string;
  extensions?: string[];
  features?: string[];
  limits?: Record<string, number>;
  state?: string;
};

const LICENSE_STATES: readonly LicenseState[] = [
  "fallback_community",
  "grace",
  "invalid",
  "trial",
  "unlicensed",
  "valid",
];

function parseLicenseState(value: unknown): LicenseState {
  return LICENSE_STATES.includes(value as LicenseState)
    ? (value as LicenseState)
    : "unlicensed";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function toLimits(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

/**
 * 拉取集群授权档位与能力。任何失败都退回社区版兜底(FALLBACK_ENTITLEMENT):
 * 一次瞬时失败不该把付费入口白送出去,也不该把页面拦死——社区能力本来就不受门控。
 *
 * 不弹错误 toast:这是启动期的背景请求,用户没有主动发起,拉不到的表现是少几个
 * 付费入口,不是一条看不懂的报错。
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const response = await http.get<CapabilitiesResponse>(CAPABILITIES, {
      skipErrorToast: true,
    });
    const data = response.data;

    return {
      capabilities: toStringArray(data.capabilities),
      edition: parseEdition(data.edition),
      extensions: toStringArray(data.extensions),
      features: toStringArray(data.features),
      limits: toLimits(data.limits),
      state: parseLicenseState(data.state),
    };
  } catch {
    return FALLBACK_ENTITLEMENT;
  }
}
