/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/** 卖点最多四条,`subscription.capabilities.<key>.bullets.b1..b4`,缺省即不渲染。 */
const BULLET_KEYS = ["b1", "b2", "b3", "b4"];

/**
 * 某项能力的产品侧卖点。登记表只给 name / description;卖点是产品自己补的,版本卡片与
 * 升级弹窗共用这一份——同一项能力在两处说成两样,客户会以为是两个问题。
 */
export function capabilityBullets(t: TFunction, capability: string): string[] {
  return BULLET_KEYS.map((key) =>
    t(`subscription.capabilities.${capability}.bullets.${key}`, { defaultValue: "" }),
  ).filter(Boolean);
}
