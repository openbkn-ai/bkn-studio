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
 * 首次启动 30 天后仍未导入授权时，在整个控制台提示注册领取免费社区授权。
 * trial 保持静默；其他无证状态由授权管理页说明，避免误导已注册的用户重复注册。
 */
export function LicenseStateBanner() {
  const { t } = useTranslation();
  const { snapshot } = useEntitlementContext();

  if (!snapshot || snapshot.licensed || snapshot.state !== "unlicensed") {
    return null;
  }

  return (
    <Alert
      action={
        <a href="https://license.openbkn.ai/register" rel="noopener noreferrer" target="_blank">
          {t("common.entitlement.banner.action")}
        </a>
      }
      banner
      message={t("common.entitlement.banner.unlicensed")}
      type="warning"
    />
  );
}
