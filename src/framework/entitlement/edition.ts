/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 授权档位。四档有序,上层包含下层——`industry` 排在 `enterprise` 之上而不是与它并列,
 * 否则行业版客户会被企业版能力挡在门外(付得更多,功能反而少)。
 *
 * 单一源是 `licverify` 的 `Edition` 类型(见 bkn-docs `shared/licensing/README.md` 的
 * 单一源表);商务形态在 license-server `docs/design/license-service.md` §1.5。这里是
 * **展示用镜像**,不是判定源。
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
 * 档位比较。**只用于展示**——版本对比页要渲染「上层包含下层」这件事(专业版有的,企业版
 * 也有)。
 *
 * **不得用于门控。** 判定源是服务端:`capabilities[]` 已经是它用 `AtLeast(MinEdition)`
 * 从装配表算好的结果,前端照读即可(ee-design.md §3.2「要按能力显隐,走
 * /api/capabilities,不让客户端自己推」、§6.1「Studio / SDK / CLI 只消费这一条聚合接口」)。
 *
 * 在前端复制一份档位序本身就是 licensing README 点名的**唯一大错**——两处对「industry
 * 是否高于 enterprise」给出不同答案。留着这一份的代价由下面的测试钉住:序关系跟着
 * licverify 的 `Edition` 走,改动必须同步。
 */
export function atLeast(current: Edition, min: Edition) {
  return EDITION_RANK[current] >= EDITION_RANK[min];
}
