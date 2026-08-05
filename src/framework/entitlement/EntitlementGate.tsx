/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";

import type { Edition } from "@/framework/entitlement/edition";
import { useEditionGate } from "@/framework/entitlement/use-entitlement";

type EntitlementGateProps = PropsWithChildren<{
  /** 档位不够、且当前是企业镜像时渲染它(可升级,值得给升级引导)。 */
  fallback?: ReactNode;
  /** 该能力的最低档位。不填等于不设门禁。 */
  minEdition?: Edition;
}>;

/**
 * 元素级门禁,对齐 PermissionGate。
 *
 * 社区镜像下付费实现物理不存在,连 fallback 都不渲染——那里没有可升级的东西,
 * 一个「升级解锁」按钮只会把用户送去一条走不通的路(社区→商业要换镜像)。
 */
export function EntitlementGate({
  children,
  fallback = null,
  minEdition,
}: EntitlementGateProps) {
  const { allowed, locked } = useEditionGate(minEdition);

  if (allowed) {
    return children;
  }

  return locked ? fallback : null;
}
