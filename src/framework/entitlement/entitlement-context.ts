/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

import type { Entitlement } from "@/framework/entitlement/types";

export type EntitlementContextValue = {
  /** 首屏这一次请求还在飞。仅用于渲染骨架,不参与判定。 */
  loading: boolean;
  /**
   * 重新拉一次。
   *
   * 后端承诺「补证免重启」——导入证书后下一个请求就生效,不必重启进程。前端就不能反过来
   * 要求用户按 F5,否则那条承诺在用户眼里不成立。授权管理页在导入/激活/删除成功后调它。
   */
  refresh: () => Promise<void>;
  /** null 表示还没拿到(加载中或失败),下游按「未知」处理。 */
  snapshot: Entitlement | null;
};

/**
 * 默认值是「没有快照、没在加载」,而不是抛错。
 *
 * Provider 缺席的场景是真实存在的:单测直接挂某个场景、微前端宿主只嵌一个页面。那时
 * 判定读到 `null` → 一律 unknown → 付费入口不显示、也不推销,正是想要的 fail-closed。
 * 抛错会把「没挂 Provider」变成白屏,而这条路径上本来没有任何付费能力要门控。
 */
export const EntitlementContext = createContext<EntitlementContextValue>({
  loading: false,
  refresh: async () => {},
  snapshot: null,
});
