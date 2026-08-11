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
  /** Tool/function count, passed explicitly because the two hosts obtain it from different sources. */
  toolCount: number;
  /** Toolbox details include publisher and publication time; the function workbench does not display them. */
  includeRelease?: boolean;
};

/**
 * Basic information items for toolboxes, including function toolboxes. Toolbox details and the
 * function workbench share one spec, differing only in count source and publication fields. It is
 * consumed by DetailBasicInfoDrawer, a vertical list that does not use span, so no span is included.
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
