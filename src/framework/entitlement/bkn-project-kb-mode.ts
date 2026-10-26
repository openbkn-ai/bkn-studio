/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { capabilityState } from "@/framework/entitlement/capability-state";
import type { EntitlementView } from "@/framework/entitlement/types";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";

/**
 * BKN 项目里专业版扩展(`bkn_project_kb`)的三态:
 *
 *   hidden  社区版镜像(not-installed),或快照未到(unknown)→ 不出现任何专业版入口和用词
 *   locked  专业版镜像 + 社区版授权(not-licensed)→ 入口可见,带「专业版」徽标,加遮罩不可操作
 *   enabled 专业版授权(available)→ 去掉遮罩;徽标常驻(同行列级授权页的 alwaysShow)
 *
 * unknown 归 hidden:对着可能是社区版的部署出专业版用词,比晚一拍出现更糟。快照是
 * 每次读取的,导入授权后刷新快照即从 locked 变 enabled,不用重启。
 */
export type BknProjectKbMode = "hidden" | "locked" | "enabled";

export function bknProjectKbMode(snapshot: EntitlementView | null): BknProjectKbMode {
  switch (capabilityState(CAPABILITIES.BKN_PROJECT_KB, snapshot)) {
    case "available":
      return "enabled";
    case "not-licensed":
      return "locked";
    default:
      return "hidden";
  }
}

export function useBknProjectKbMode(): BknProjectKbMode {
  return bknProjectKbMode(useEntitlementContext().snapshot);
}
