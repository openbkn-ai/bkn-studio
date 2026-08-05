/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Edition } from "@/framework/entitlement/edition";

/**
 * licverify 的六态(`licverify/verify.go`)。`trial` 与 `unlicensed` 是无证态:
 * 社区能力照常全开,差别只在提示强度——license 不是「能不能开机」的开关。
 */
export type LicenseState =
  | "fallback_community"
  | "grace"
  | "invalid"
  | "trial"
  | "unlicensed"
  | "valid";

/**
 * `GET /api/safe/v1/capabilities` 的前端视图。只认证不鉴权:它描述这个集群,不描述
 * 调用者,所以任何登录用户都读得到。
 */
export type Entitlement = {
  /**
   * 证里带了、且这个二进制真能提供的能力集。**不做档位判定**——判定看 `edition`。
   * 保留它是为了将来做逐能力的细化提示,以及排障时和 `features` 对照。
   */
  capabilities: string[];
  /** 当前档位。判定的唯一依据。 */
  edition: Edition;
  /**
   * 这个构建里被填上的企业插座。社区二进制恒为空——付费代码物理上不在里面。
   *
   * 它和 `capabilities` 的差,正是「没授权」和「授权了但镜像不对」的差,后端刻意
   * 分开这两个字段就是为了让人分得清。前端拿它决定档位不够时是**藏**还是**锁**。
   */
  extensions: string[];
  /** 证上写了什么。只用于展示与审计核对,任何代码路径不得据此放行。 */
  features: string[];
  /**
   * 此刻是否持有生效授权。**「有没有授权」只问它,不要枚举 `state` 反推**——那种
   * 写法在后端新增一个 state 的当天就会错(后端 `capabilities.go` 加这个字段就是
   * 为了挡住它)。
   *
   * false 覆盖「从未安装」「过期超宽限」「验签失败」三种,产品行为完全一致。它取自
   * 每个受控调用点读的同一个 gate,不是「有没有 payload」推的:过期超宽限的证书仍
   * 然有 payload,报成 licensed 会让菜单全开而每个调用都被拒。
   */
  licensed: boolean;
  /** 证带的数值配额,如 `max_users` / `max_nodes`。-1 = 不限。 */
  limits: Record<string, number>;
  /** 授权状态,只驱动横幅**措辞**;判定看 `edition`,有无授权看 `licensed`。 */
  state: LicenseState;
};

/**
 * 拉取失败、或后端整个不可达时的兜底。社区版 + 无证,fail-closed:宁可少给,
 * 不可错给。付费入口一律不显示,而不是一律显示。
 */
export const FALLBACK_ENTITLEMENT: Entitlement = {
  capabilities: [],
  edition: "community",
  extensions: [],
  features: [],
  licensed: false,
  limits: {},
  state: "unlicensed",
};

/**
 * 社区镜像:付费实现物理不存在,插座一个都没填上。
 *
 * 这种集群里把付费入口画成「锁定 + 升级引导」是噪音——点开也装不上,升级要换镜像
 * 而不是换证书。所以社区镜像直接藏,企业镜像才显示升级引导。
 */
export function isCommunityBuild(entitlement: Entitlement) {
  return entitlement.extensions.length === 0;
}
