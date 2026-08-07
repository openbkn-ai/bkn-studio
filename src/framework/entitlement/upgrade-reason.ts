/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { capabilityState } from "@/framework/entitlement/capability-state";
import { atLeast, type Edition } from "@/framework/entitlement/edition";
import type { EntitlementView } from "@/framework/entitlement/types";

/**
 * 升级引导该说哪句话。
 *
 * 三种部署组合对应三种处置,弹窗说错等于把人指到错的地方:
 *
 * | 证书 | 镜像 | reason | 客户要做什么 |
 * |---|---|---|---|
 * | 档位不够 | 任意 | `buy` | 买/换证书 |
 * | 档位够 | 社区版 | `image` | 升级镜像(bkn-safe 的能力能确定判出) |
 * | 档位够 | 未知 | `image-likely` | 多半是别的服务的镜像还没升(判不了,给方向) |
 * | 档位够 | 企业版 | — | 能用,根本不会弹这个窗 |
 */
export type UpgradeReason = "buy" | "image" | "image-likely";

export function upgradeReason(
  capability: string,
  snapshot: EntitlementView | null,
  minEdition: Edition,
  servedByBknSafe: boolean,
): UpgradeReason {
  // 快照没到就按「还没买」说——不能凭空断言客户的证书已经够了。
  if (!snapshot || !atLeast(snapshot.edition, minEdition)) {
    return "buy";
  }

  // bkn-safe 自己的能力:extensions[] 是它这个进程的装配表,缺席即确定没装。
  if (servedByBknSafe) {
    return capabilityState(capability, snapshot) === "not-installed" ? "image" : "buy";
  }

  // 别的服务的能力从来不出现在这两个列表里,缺席说明不了任何事(ee-design.md §6
  // 「A 答不了 B」)。档位够却仍走到这里,最可能是那个服务的镜像没升——只能给方向。
  return "image-likely";
}

/**
 * 这项能力在当前部署上是不是**真的可用**——证够了 **且** 镜像里有。徽标据此闭嘴:
 * 只满足一半的时候仍要提示,因为客户此刻还用不了。
 *
 * 别的服务实现的能力没法确认镜像(ee-design.md §6「A 答不了 B」),只能退到档位;
 * 那种情况下「档位够」就是我们能拿到的最强判据。
 */
export function capabilitySatisfied(
  capability: string,
  snapshot: EntitlementView | null,
  minEdition: Edition,
  servedByBknSafe: boolean,
): boolean {
  if (!snapshot || !atLeast(snapshot.edition, minEdition)) {
    return false;
  }

  // 判不了就不算满足。别的服务的能力确认不了镜像(ee-design.md §6「A 答不了 B」),
  // 而「证够了但包没换」恰恰是客户最常处在的状态——把它当满足会让标记消失,客户以为
  // 一切正常,点下去才发现用不了。有更强信号的调用点(比如连接器有后端的 enabled)自己
  // 决定要不要画。
  return servedByBknSafe && capabilityState(capability, snapshot) === "available";
}
