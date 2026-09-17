/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FunctionOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Select, Spin, Tag } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import {
  listTopLevelAuthzObjects,
  TOP_LEVEL_AUTHZ_RESOURCE_TYPES,
  type TopResourceType,
} from "@/modules/system-admin/services/authz-objects.service";
import type { AuthorizableObject } from "@/modules/system-admin/types/authz";
import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ManageTarget = Pick<AuthorizableObject, "id" | "name" | "sub" | "type">;

type TopResourceAuthorizationPanelProps = {
  fineGrained: boolean;
  onManage: (target: ManageTarget) => void;
};

const ICONS: Record<string, ReactNode> = {
  catalog: <DatabaseOutlined />,
  knowledge_network: <DeploymentUnitOutlined />,
  mcp: <ApiOutlined />,
  operator: <FunctionOutlined />,
  skill: <AppstoreOutlined />,
  tool_box: <ToolOutlined />,
  function: <FunctionOutlined />,
};

const DEFAULT_PAGE_SIZE = 10;
export function TopResourceAuthorizationPanel({ onManage }: TopResourceAuthorizationPanelProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const query = useDebouncedValue(keyword.trim(), 300);
  const [resourceType, setResourceType] = useState<TopResourceType>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [roots, setRoots] = useState<AuthorizableObject[]>([]);
  const [rootTotal, setRootTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void listTopLevelAuthzObjects(resourceType, query, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((result) => {
        if (cancelled) return;
        setRoots(result.objects);
        setRootTotal(result.total);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, query, resourceType]);

  return (
    <section className={styles.topResourceWorkbench}>
      <div className={styles.topResourceToolbar}>
        <Select<TopResourceType>
          allowClear
          aria-label={t("systemAdmin.objectGrants.topResourceType")}
          onChange={(value) => {
            setResourceType(value);
            setPage(1);
          }}
          options={TOP_LEVEL_AUTHZ_RESOURCE_TYPES.map((type) => ({
            label: resourceTypeLabel(type),
            value: type,
          }))}
          placeholder={t("systemAdmin.objectGrants.topResourceTypeAll")}
          value={resourceType}
        />
        <Input.Search
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder={t("systemAdmin.objectGrants.topResourceSearchPlaceholder")}
          value={keyword}
        />
      </div>
      {loadError ? <Alert message={t("systemAdmin.objectGrants.topResourceLoadError")} showIcon type="error" /> : null}
      {loading ? <div className={styles.topResourceLoading}><Spin /></div> : null}
      {!loading && roots.length === 0 ? <Empty description={t("systemAdmin.objectGrants.empty")} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
      {!loading && roots.map((root) => {
        return (
          <article className={styles.topResourceRow} key={`${root.type}:${root.id}`}>
            <span />
            <span className={styles.authzAvatar}>{ICONS[root.type] ?? <AppstoreOutlined />}</span>
            <div className={styles.topResourceName}>
              <strong>{root.name}</strong>
              <small>{root.sub || root.id}</small>
            </div>
            <Tag className={styles.roleTag}>{resourceTypeLabel(root.type)}</Tag>
            <AppButton onClick={() => onManage(root)} type="link">
              {t("systemAdmin.objectGrants.manage")}
            </AppButton>
          </article>
        );
      })}
      {!loading && rootTotal > 0 ? (
        <TablePaginationBar
          current={page}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPageSize === pageSize ? nextPage : 1);
            setPageSize(nextPageSize);
          }}
          pageSize={pageSize}
          showSizeChanger
          showTotal={(count) => t("common.total", { total: count })}
          size="small"
          total={rootTotal}
        />
      ) : null}
    </section>
  );
}
