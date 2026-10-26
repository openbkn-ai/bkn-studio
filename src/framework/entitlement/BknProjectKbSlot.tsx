/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { capabilityState } from "@/framework/entitlement/capability-state";
import { bknProjectKbMode, useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";

/** 专业版入口旁的徽标,三态见 `bkn-project-kb-mode.ts`。社区版镜像里不出现。 */
export function BknProjectKbBadge() {
  if (useBknProjectKbMode() === "hidden") {
    return null;
  }
  return <EditionBadge alwaysShow edition="professional" />;
}

type BknProjectKbSlotProps = {
  children: ReactNode;
  /**
   * locked 时遮罩下的静态预览。不用 children:children 会去请求 bknproject-kb,未授权时
   * 那些路由是 404。不给就只有遮罩卡。
   */
  preview?: ReactNode;
  /** 调用方探到知识库接口不可用时传 true;能力快照里没有 knowledge_base 时自动按不可用处理。 */
  knowledgeBaseUnavailable?: boolean;
};

/** 专业版扩展的一块区域:按三态隐藏、遮罩或放行;放行后知识库不可用时给空状态。 */
export function BknProjectKbSlot({
  children,
  knowledgeBaseUnavailable = false,
  preview = null,
}: BknProjectKbSlotProps) {
  const { t } = useTranslation();
  const { snapshot } = useEntitlementContext();
  const mode = bknProjectKbMode(snapshot);

  if (mode === "hidden") {
    return null;
  }
  if (mode === "locked") {
    return (
      <RequireEdition capability={CAPABILITIES.BKN_PROJECT_KB} minEdition="professional">
        {preview}
      </RequireEdition>
    );
  }
  if (
    knowledgeBaseUnavailable ||
    capabilityState(CAPABILITIES.KNOWLEDGE_BASE, snapshot) !== "available"
  ) {
    return (
      <Empty
        description={
          <>
            <div>{t("common.entitlement.knowledgeBaseUnavailable.title")}</div>
            <div>{t("common.entitlement.knowledgeBaseUnavailable.description")}</div>
          </>
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  return <>{children}</>;
}
