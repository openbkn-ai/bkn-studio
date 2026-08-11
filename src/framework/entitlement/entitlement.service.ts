/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parseEdition } from "@/framework/entitlement/edition";
import type { Entitlement, LicenseState } from "@/framework/entitlement/types";
import { http } from "@/framework/request/http";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/**
 * 集群授权状态。只认证不鉴权——它描述这套部署,不描述调用者,所以任何登录用户都读得到,
 * 前端每次进来靠它铺菜单。网关已放行该路径(bkn-foundry #638)。
 */
const CAPABILITIES = "/safe/v1/capabilities";

/**
 * `capabilities[]` / `extensions[]` 今天是字符串数组,但 ee-design.md §6.1 已经写下了下一版
 * 形状——每项是对象,分别给出 `installed` / `licensed` / `ready` / `reason`(0.1.3
 * `business_provenance` 要求区分「换镜像」「买证书」「修依赖」三种处置)。
 *
 * 所以解析要认两种形状。只认字符串的话,后端换形状那天数组会被静默滤空,前端表现为
 * 「什么都没买」——付费入口全消失且不报错,是最难查的那类故障。
 */
type CapabilityEntry = string | { key?: string; licensed?: boolean };

type CapabilitiesResponse = {
  capabilities?: CapabilityEntry[];
  edition?: string;
  extensions?: CapabilityEntry[];
  features?: string[];
  licensed?: boolean;
  limits?: Record<string, number>;
  state?: string;
};

/**
 * mock 模拟「企业镜像 + 专业证」:装了两个能力,只买得起其中一个。
 *
 * 选这个组合是因为它同时覆盖三态里的两个——`rbac_basic` 可用、`perm_object_level`
 * 装了没买——本地开发因此能看见升级引导长什么样。全买或全不买的 mock 会让升级路径
 * 没人走过。
 */
const MOCK_ENTITLEMENT: Entitlement = {
  capabilities: ["rbac_basic"],
  edition: "professional",
  extensions: ["rbac_basic", "perm_object_level"],
  features: ["rbac_basic", "source_sync"],
  licensed: true,
  limits: { max_users: 100 },
  state: "valid",
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

/** 字符串数组与对象数组都收,取 key。对象形状见 CapabilityEntry 的注释。 */
function toCapabilityKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "key" in item) {
        const key = (item as { key?: unknown }).key;
        return typeof key === "string" ? key : null;
      }

      return null;
    })
    .filter((key): key is string => key !== null);
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
 * 拉取集群授权快照。
 *
 * 每个字段都按最保守的值兜底:没有能力、社区档、未授权。缺字段不是假想——`licensed`
 * 是 #638 才加的,老部署不吐;而缺字段当「有」会让菜单全开而每个调用被拒。
 *
 * 失败**抛出**,由 Provider 落成 `snapshot = null`(未知)。这里不吞成社区版兜底:
 * 「确实是社区版」和「没拿到」必须分得开,否则企业客户的一次网络抖动会被渲染成
 * 「你没买」并配上一条升级引导。
 *
 * `skipErrorToast`:首屏后台请求,用户没发起任何操作,弹红条只会让人莫名其妙。
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  if (useMock) {
    return { ...MOCK_ENTITLEMENT };
  }

  const response = await http.get<CapabilitiesResponse>(CAPABILITIES, {
    skipErrorToast: true,
  });
  const data = response.data;

  return {
    capabilities: toCapabilityKeys(data.capabilities),
    edition: parseEdition(data.edition),
    extensions: toCapabilityKeys(data.extensions),
    features: toStringArray(data.features),
    // 字段缺失(#638 之前的后端)当无授权处理:少给,不错给。
    licensed: data.licensed === true,
    limits: toLimits(data.limits),
    state: parseLicenseState(data.state),
  };
}
