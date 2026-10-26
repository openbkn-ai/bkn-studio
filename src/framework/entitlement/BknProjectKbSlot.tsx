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
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";

/**
 * 专业版入口的名称与徽标,三态见 `bkn-project-kb-mode.ts`。名称作为 children 传进来:社区版镜像里
 * 名称和徽标一起不出现,专业版用词才不会留在页面上。
 */
export function BknProjectKbBadge({ children }: { children?: ReactNode }) {
  if (useBknProjectKbMode() === "hidden") {
    return null;
  }
  return (
    <>
      {children}
      <EditionBadge alwaysShow edition="professional" />
    </>
  );
}

type BknProjectKbSlotProps = {
  children: ReactNode;
  /**
   * locked 时遮罩下的静态预览(原型的「功能预览」)。不用 children:children 会去请求
   * bknproject-kb,未授权时那些路由是 404。不给就不挂内容,只有遮罩卡,同 mountLockedContent={false}。
   */
  preview?: ReactNode;
  /** 调用方探到知识库接口不可用时传 true。能力快照里没有 knowledge_base 时已是 hidden 或 locked,到不了这里。 */
  knowledgeBaseUnavailable?: boolean;
};

/** 专业版扩展的一块区域:按三态隐藏、遮罩或放行;放行后知识库不可用时给空状态。 */
export function BknProjectKbSlot({
  children,
  knowledgeBaseUnavailable = false,
  preview = null,
}: BknProjectKbSlotProps) {
  const { t } = useTranslation();
  const mode = useBknProjectKbMode();

  if (mode === "hidden") {
    return null;
  }
  if (mode === "locked") {
    return (
      <RequireEdition
        capability={CAPABILITIES.KNOWLEDGE_BASE}
        minEdition="professional"
        mountLockedContent={preview !== null}
      >
        {preview}
      </RequireEdition>
    );
  }
  if (knowledgeBaseUnavailable) {
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
