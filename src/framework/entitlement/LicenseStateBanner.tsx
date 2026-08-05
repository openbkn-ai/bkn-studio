/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import type { LicenseState } from "@/framework/entitlement/types";

/**
 * 需要提示的状态。`valid` 无话可说;`trial` 是首启 30 天的静默窗口——那段时间社区
 * 能力全开且刻意不打扰,提示反而像报错。
 */
const NOTICE: Partial<Record<LicenseState, { key: string; type: "error" | "warning" }>> = {
  fallback_community: { key: "fallbackCommunity", type: "warning" },
  grace: { key: "grace", type: "warning" },
  invalid: { key: "invalid", type: "error" },
  unlicensed: { key: "unlicensed", type: "warning" },
};

/**
 * 授权状态横幅。无证不收走任何功能——社区能力照常,所以这里只提示,不拦路。
 *
 * `state` 只挑措辞,「到底有没有授权」问 `licensed`:后端新增一个 state 时,措辞会
 * 落到通用文案,但横幅不会整条消失——那才是真正会漏的失败方式。
 */
export function LicenseStateBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { snapshot } = useEntitlementContext();
  // 快照没到时什么都不说:此刻分不清「无证」和「没读到」,而这条横幅的每种措辞都在断言
  // 授权出了什么问题。
  const notice = snapshot
    ? (NOTICE[snapshot.state] ?? (snapshot.licensed ? undefined : NOTICE.unlicensed))
    : undefined;

  if (!notice) {
    return null;
  }

  return (
    <Alert
      action={
        <Button onClick={() => void navigate("/system/license")} size="small" type="link">
          {t("common.entitlement.banner.action")}
        </Button>
      }
      banner
      closable
      message={t(`common.entitlement.banner.${notice.key}`)}
      type={notice.type}
    />
  );
}
