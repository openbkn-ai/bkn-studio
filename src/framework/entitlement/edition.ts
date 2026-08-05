/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 授权档位。四档有序,上层包含下层——`industry` 排在 `enterprise` 之上而不是与它
 * 并列,否则行业版客户会被企业版能力挡在门外(付得更多,功能反而少)。
 *
 * 字典单一源在 license-server 仓 `docs/design/license-service.md` §1.5,这里只是镜像。
 */
export type Edition = "community" | "professional" | "enterprise" | "industry";

const EDITION_RANK: Record<Edition, number> = {
  community: 0,
  professional: 1,
  enterprise: 2,
  industry: 3,
};

/** 后端在无证、license hub 未起等一切异常下都返回 community,前端同样以它兜底。 */
export const FALLBACK_EDITION: Edition = "community";

export function isEdition(value: unknown): value is Edition {
  return typeof value === "string" && value in EDITION_RANK;
}

/**
 * 未知档位一律降为 community。后端 `TestCapabilitiesWithoutLicenceReportsCommunity`
 * 保证 `edition` 永不为空,但新增档位时老前端仍会见到不认识的值——那时把它当社区版
 * 处理是唯一安全的选择(少给,不错给)。
 */
export function parseEdition(value: unknown): Edition {
  return isEdition(value) ? value : FALLBACK_EDITION;
}

/**
 * 唯一的档位判定入口,对应服务端的 `entitlement.AtLeast(minEdition)`。
 *
 * 判定只看档位,不看 `features[]`——证里的 feature 清单只用于展示与审计核对,任何
 * 代码路径不得据此放行(bkn-docs `shared/licensing/README.md` 决策 4/5)。
 *
 * 前端这份判定没有强制力,强制力在服务端每个受控调用点。这里只是别让用户看见一个
 * 点进去必然被拒的入口。
 */
export function atLeast(current: Edition, min: Edition) {
  return EDITION_RANK[current] >= EDITION_RANK[min];
}
