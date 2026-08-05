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
 * `GET /api/safe/v1/capabilities` 的前端视图。
 *
 * 这是**集群属性**,不是用户属性——它回答「这套部署买了什么、装了什么」,与当前登录者
 * 是谁无关(接口只认证不鉴权,任何登录用户都读得到)。用户维度的判断走
 * framework/permission,两者正交:档位不够时谁都不能用,权限不够时只有这个人不能用。
 * 混在一起早晚会有人写出 `permissions.includes("rbac_basic")`。
 */
export type Entitlement = {
  /**
   * 当前档位下真正可用的付费能力。后端从装配表派生:装进了这个二进制 **且** 当前档位
   * 覆盖得到。前端要显隐单个能力,问的就是它(经 `capabilityState`)。
   */
  capabilities: string[];
  /** 当前档位。整页/整块按档位门控时的判据,与 `atLeast()` 配对使用。 */
  edition: Edition;
  /**
   * 这个构建里被填上的企业插座,与证书无关。社区二进制恒为空——付费代码物理上不在里面。
   *
   * 它和 `capabilities` 的差,正是「没授权」和「授权了但镜像不对」的差,后端刻意分开
   * 这两个字段就是为了让人分得清。前端拿它决定不可用时是**藏**还是**给升级引导**。
   */
  extensions: string[];
  /**
   * 证上写了什么。**只展示,绝不判断。**
   *
   * 授权按档位(后端 `AtLeast`),feature key 不参与任何判定链路。在前端按它显隐等于
   * 把细粒度授权从后门放回来,而且放在最没有强制力的一层——那行判断谁都能改。
   * 见 bkn-docs `shared/licensing/ee-design.md` §3.2。
   */
  features: string[];
  /**
   * 此刻是否持有生效授权。**「有没有授权」只问它,不要枚举 `state` 反推**——那种写法
   * 在后端新增一个 state 的当天就会错(后端 `capabilities.go` 加这个字段就是为了挡住它)。
   *
   * false 覆盖「从未安装」「过期超宽限」「验签失败」三种,产品行为完全一致。它取自每个
   * 受控调用点读的同一个 gate,不是「有没有 payload」推的:过期超宽限的证书仍然有
   * payload,报成 licensed 会让菜单全开而每个调用都被拒。
   */
  licensed: boolean;
  /** 证带的数值配额,如 `max_users` / `max_nodes`。-1 = 不限。只用于展示。 */
  limits: Record<string, number>;
  /** 授权状态,只驱动横幅**措辞**;判定看 `edition`,有无授权看 `licensed`。 */
  state: LicenseState;
};

/**
 * 一个能力在当前部署下的状态。四态而不是布尔,因为客户报障时「用不了」至少有三种完全
 * 不同的处置:换镜像、买证书、等加载完。压成一个布尔就分不出来了。
 */
export type CapabilityState =
  /** 装了且档位够,可用。 */
  | "available"
  /** 装了但档位不够——**买证书**。唯一该出升级引导的状态。 */
  | "not-licensed"
  /** 这个镜像根本没有这段代码——**换镜像**。对用户表现为「不存在」。 */
  | "not-installed"
  /** 还没拿到快照,或请求失败。按不可用处理,但不出升级引导。 */
  | "unknown";

/**
 * 快照缺席时的读数。社区版 + 无证,fail-closed:宁可少给,不可错给。
 *
 * 只给「反正要显示点什么」的展示位用(档位芯片、版本页当前档)。**判定不要用它**——
 * 判定走 `capabilityState(key, snapshot)`,那里 `null` 是独立的一态,与「确实是社区版」
 * 分得开。
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
 * 这种集群里把付费入口画成「锁定 + 升级引导」是噪音——点开也装不上,升级要换镜像而不是
 * 换证书。所以社区镜像直接藏,企业镜像才显示升级引导。
 */
export function isCommunityBuild(entitlement: Entitlement) {
  return entitlement.extensions.length === 0;
}
