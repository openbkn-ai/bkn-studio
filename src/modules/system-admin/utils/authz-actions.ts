/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { authzPoints } from "@/modules/system-admin/permissions";

/**
 * 对象授权抽屉里操作 chip 的点击落到哪个权限点。
 *
 * 后端 object-grants 的写入是覆盖语义:改操作集发 POST(admin-authz:grant),清空操作集
 * 才是 DELETE(admin-authz:revoke)。前端的 upsertObjectGrant 在操作集为空时自动转成
 * revoke,所以「取消掉最后一个操作」等于整条撤权 —— 需要 revoke 而不是 grant。
 *
 * 单独拿出来做纯函数,是因为这个映射是本页最容易判错的一处:selected 的反面不是
 * revoke,只有「selected 且是最后一个」才是。
 */
export function chipTogglePoint(selected: boolean, currentOpCount: number): string {
  if (selected && currentOpCount <= 1) {
    return authzPoints.revoke;
  }
  return authzPoints.grant;
}
