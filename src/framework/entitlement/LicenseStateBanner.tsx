/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";

import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";

/**
 * 授权状态横幅。**只挂在授权管理页**。
 *
 * 之前挂在整个控制台顶部:无证部署里它会跟着每一页,而社区能力照常可用,等于把一条与
 * 当前操作无关的提示钉在所有人眼前。导入授权是授权管理页的事,提示放在能处理它的地方
 * 才有用——也因此这里不再画「去处理」按钮:人已经在那一页上了。
 *
 * 无证不收走任何功能——社区能力照常,所以这里只提示,不拦路。
 *
 * **只看 `licensed`,不按 `state` 分措辞。** ee-design.md §3.4:证书是过期、宽限还是从未
 * 安装,属于运维排查细节,留在 bkn-safe 的 license 详情面,「不进给前端的那个接口——多一个
 * 字段就多一处被客户端拿去做判断的风险」。后端今天仍返回 `state`(实现早于这条纪律),前端
 * 不消费它:要看是哪一种,去授权管理页。
 *
 * §6.1 记着 `expires_at` 尚未补,标注用途正是「给激活横幅用」。补上之后这里才该出现第二种
 * 措辞(临期提醒),而不是现在按六态各写一句。
 */
export function LicenseStateBanner() {
  const { t } = useTranslation();
  const { snapshot } = useEntitlementContext();

  // 快照没到时什么都不说:此刻分不清「无证」和「没读到」,而这条横幅在断言授权出了问题。
  if (!snapshot || snapshot.licensed) {
    return null;
  }

  return (
    <Alert
      banner
      closable
      message={t("common.entitlement.banner.unlicensed")}
      type="warning"
    />
  );
}
