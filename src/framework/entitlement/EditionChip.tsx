/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CrownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  useEntitlement,
  useEntitlementStatus,
} from "@/framework/entitlement/use-entitlement";

/**
 * 顶栏档位芯片。对所有登录用户可见,是版本与订阅页的主入口——菜单那条要授权管理权限,
 * 普通用户只有这里能看到「这个工作区买的是哪一档」。
 *
 * 快照没到之前不渲染:先显示「社区版」再跳成「企业版」,比晚半秒出现更糟。
 */
export function EditionChip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const status = useEntitlementStatus();

  if (status === "loading") {
    return null;
  }

  return (
    <button
      className="console-topbar-chip"
      onClick={() => {
        void navigate("/system/subscription");
      }}
      title={t("subscription.title")}
      type="button"
    >
      <CrownOutlined aria-hidden />
      <span>{t(`common.entitlement.editions.${entitlement.edition}`)}</span>
      {entitlement.licensed ? null : (
        <span className="console-edition-chip-cta">{t("common.entitlement.upgrade")}</span>
      )}
    </button>
  );
}
