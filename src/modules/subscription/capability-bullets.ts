/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

/** 卖点最多四条,`subscription.capabilities.<key>.bullets.b1..b4`,缺省即不渲染。 */
const BULLET_KEYS = ["b1", "b2", "b3", "b4"];

function readBullets(t: TFunction, capability: string, group: string): string[] {
  return BULLET_KEYS.map((key) =>
    t(`subscription.capabilities.${capability}.${group}.${key}`, { defaultValue: "" }),
  ).filter(Boolean);
}

/**
 * 某项能力的产品侧卖点。登记表只给 name / description;卖点是产品自己补的,版本卡片与
 * 升级弹窗共用这一份——同一项能力在两处说成两样,客户会以为是两个问题。
 */
export function capabilityBullets(t: TFunction, capability: string): string[] {
  return readBullets(t, capability, "bullets");
}

/**
 * 版本卡片上的子项。默认就是 `bullets`;只有卖点写成整句、铺上卡片会把卡片拉成说明书的
 * 能力(连接器)才另给一组 `cardBullets`,只列「包含什么」——它是卖点的摘要,不是另一套说法。
 */
export function capabilityCardBullets(t: TFunction, capability: string): string[] {
  const card = readBullets(t, capability, "cardBullets");

  return card.length > 0 ? card : capabilityBullets(t, capability);
}
