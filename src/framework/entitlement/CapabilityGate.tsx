/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";

import { useCapability } from "@/framework/entitlement/use-entitlement";

type CapabilityGateProps = PropsWithChildren<{
  capability: string;
  /** 不可用时渲染什么。默认藏掉。 */
  fallback?: ReactNode;
  /**
   * **仅**在"装了没买"时渲染什么。不给就退回 fallback。
   *
   * 单独开一个槽而不是让调用方自己判，是因为升级引导放错状态的代价是真金白银：
   * 放在"没装"上，客户买了证书发现还是用不了；放在"未知"上，社区部署的用户会
   * 被推销一个他这套镜像根本装不了的东西。这两种错误都只在客户现场才暴露。
   */
  upgrade?: ReactNode;
}>;

/**
 * 按档位显隐一段 UI。与 PermissionGate 同形，但问的是**集群买没买**，不是
 * **这个人有没有权限**。
 *
 * 两者常常要一起用，**capability 包在外层**：集群没买的东西，不该因为某个管理员
 * 权限齐全就冒出来。
 *
 *   <CapabilityGate capability="rbac_basic" upgrade={…}>
 *     <PermissionGate permissions="admin-role:create">
 *       <Button …/>
 *     </PermissionGate>
 *   </CapabilityGate>
 *
 * 这里是**体验**，不是强制力。真正的强制在服务端——档位不够时那些路由逐字节地
 * 表现为不存在（404）。前端只是别把点进去必然失败的入口摆出来。
 */
export function CapabilityGate({
  capability,
  children,
  fallback = null,
  upgrade,
}: CapabilityGateProps) {
  const state = useCapability(capability);

  if (state === "available") {
    return <>{children}</>;
  }
  if (state === "not-licensed" && upgrade !== undefined) {
    return <>{upgrade}</>;
  }
  return <>{fallback}</>;
}
