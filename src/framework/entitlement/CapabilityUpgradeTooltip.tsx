/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

type CapabilityUpgradeTooltipProps = PropsWithChildren<{
  /** 覆盖默认文案，用于能说清"升级后能做什么"的场景。 */
  title?: string;
}>;

/**
 * 给"装了没买"的置灰控件套一层统一提示。
 *
 * 存在的理由是文案一致：升级引导散在几十个按钮上各写各的，就等于把商务话术撒满
 * 代码库——这正是当初把端点的 403 升级提示撤掉、收到 /capabilities 一处的原因。
 * 具体去哪买由授权管理页说，这里只负责告诉用户"这是付费能力，你这套没买"。
 */
export function CapabilityUpgradeTooltip({
  children,
  title,
}: CapabilityUpgradeTooltipProps) {
  const { t } = useTranslation();

  return <Tooltip title={title ?? t("common.entitlement.upgradeHint")}>{children}</Tooltip>;
}
