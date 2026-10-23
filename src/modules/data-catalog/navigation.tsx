/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, FileTextOutlined, ThunderboltOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

export const dataCatalogNavigation: ConsoleNavContribution = {
  parentKey: "general-business-knowledge-network",
  items: [
    {
      key: "data-catalog",
      labelKey: "shell.items.dataResource",
      icon: <DatabaseOutlined />,
      path: "/data-catalog",
    },
    {
      // 页面在企业版前端镜像里(openbkn-ee studio/ 注册 /knowledge-base)。extensionPage 让社区构建
      // 无论授权快照是否到位都不出现这一项;企业版再按 capability 判。
      capability: CAPABILITIES.KNOWLEDGE_BASE,
      extensionPage: true,
      key: "knowledge-base",
      labelKey: "shell.items.knowledgeBase",
      icon: <FileTextOutlined />,
      path: "/knowledge-base",
    },
    {
      key: "task-management",
      labelKey: "shell.items.indexBuild",
      icon: <ThunderboltOutlined />,
      path: "/task-management",
    },
  ],
};
