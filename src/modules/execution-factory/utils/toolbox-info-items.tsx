/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  IdcardOutlined,
  LinkOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";

import type { DetailMetaItem } from "@/modules/execution-factory/components/DetailMetaPanel";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import {
  formatOptionalTimestamp,
  resolveToolboxCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";

type BuildToolboxBasicInfoItemsOptions = {
  t: (key: string) => string;
  auditUserDirectory: Parameters<typeof formatAuditUserDisplay>[0]["directory"];
  /** 工具/函数数量（两个宿主分别来自不同来源，故显式传入）。 */
  toolCount: number;
  /** 工具箱详情附带发布人/发布时间；函数工作台不显示。 */
  includeRelease?: boolean;
};

/**
 * 工具箱（含函数工具箱）基础信息条目。工具箱详情页与函数工作台共用同一份 spec，
 * 只在数量来源与是否含发布字段上不同。喂给 DetailBasicInfoDrawer（竖排列表，
 * 不读 span），所以这里不带 span。
 */
export function buildToolboxBasicInfoItems(
  toolbox: ToolboxRecord,
  { t, auditUserDirectory, toolCount, includeRelease = false }: BuildToolboxBasicInfoItemsOptions,
): DetailMetaItem[] {
  const items: DetailMetaItem[] = [
    {
      key: "boxId",
      label: t("executionFactory.toolboxId"),
      value: toolbox.boxId,
      icon: <IdcardOutlined />,
      variant: "mono",
    },
    {
      key: "category",
      label: t("executionFactory.category"),
      value: resolveToolboxCategoryLabel(toolbox, t),
      icon: <AppstoreOutlined />,
      variant: "accent",
    },
    {
      key: "metadataType",
      label: t("executionFactory.metadataType"),
      value: toolbox.metadataType
        ? t(`executionFactory.metadataTypes.${toolbox.metadataType}`)
        : "-",
    },
    {
      key: "toolCount",
      label: t("executionFactory.toolCount"),
      value: String(toolCount),
      icon: <ToolOutlined />,
    },
    {
      key: "serviceUrl",
      label: t("executionFactory.serviceUrl"),
      value: toolbox.serviceUrl ?? "-",
      icon: <LinkOutlined />,
      variant: "mono",
    },
    {
      key: "createUser",
      label: t("executionFactory.createUser"),
      value: formatAuditUserDisplay({ directory: auditUserDirectory, id: toolbox.createUser }),
      icon: <UserOutlined />,
    },
    {
      key: "updateUser",
      label: t("executionFactory.updateUser"),
      value: formatAuditUserDisplay({ directory: auditUserDirectory, id: toolbox.updateUser }),
      icon: <UserOutlined />,
    },
    {
      key: "createTime",
      label: t("executionFactory.createTime"),
      value: formatOptionalTimestamp(toolbox.createTime),
      icon: <CalendarOutlined />,
    },
    {
      key: "updateTime",
      label: t("executionFactory.updateTime"),
      value: formatOptionalTimestamp(toolbox.updateTime),
      icon: <ClockCircleOutlined />,
    },
  ];

  if (includeRelease) {
    items.push(
      {
        key: "releaseUser",
        label: t("executionFactory.releaseUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: toolbox.releaseUser }),
        icon: <UserOutlined />,
      },
      {
        key: "releaseTime",
        label: t("executionFactory.releaseTime"),
        value: formatOptionalTimestamp(toolbox.releaseTime),
        icon: <CalendarOutlined />,
      },
    );
  }

  return items;
}
