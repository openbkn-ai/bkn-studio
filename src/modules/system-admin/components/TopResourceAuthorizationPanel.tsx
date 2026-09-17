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
  DownOutlined,
  FunctionOutlined,
  RightOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Select, Spin, Tag } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import {
  listTopResourceChildCategories,
  listTopLevelAuthzObjects,
  listTopResourceChildren,
  TOP_LEVEL_AUTHZ_RESOURCE_TYPES,
  type TopResourceChildPage,
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
  function: <FunctionOutlined />,
  operator: <FunctionOutlined />,
  skill: <AppstoreOutlined />,
  tool_box: <ToolOutlined />,
};

const DEFAULT_PAGE_SIZE = 10;
const CHILD_DEFAULT_PAGE_SIZE = 10;

type ChildPageState = {
  page: number;
  pageSize: number;
};

function childKey(root: AuthorizableObject, category: string) {
  return `${root.type}:${root.id}:${category}`;
}

export function TopResourceAuthorizationPanel({ fineGrained, onManage }: TopResourceAuthorizationPanelProps) {
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenByCategory, setChildrenByCategory] = useState<Record<string, TopResourceChildPage>>({});
  const [childPageState, setChildPageState] = useState<Record<string, ChildPageState>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());

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
        setExpanded(new Set());
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, query, resourceType]);

  const loadChildPage = (
    root: AuthorizableObject,
    category: string,
    nextState: ChildPageState,
  ) => {
    const key = childKey(root, category);
    setChildPageState((current) => ({ ...current, [key]: nextState }));
    setLoadingChildren((current) => new Set(current).add(key));
    void listTopResourceChildren(root, category, {
      limit: nextState.pageSize,
      offset: (nextState.page - 1) * nextState.pageSize,
    })
      .then((result) => setChildrenByCategory((current) => ({ ...current, [key]: result })))
      .catch(() => setChildrenByCategory((current) => ({
        ...current,
        [key]: { category, children: [], total: 0 },
      })))
      .finally(() => setLoadingChildren((current) => {
        const nextLoading = new Set(current);
        nextLoading.delete(key);
        return nextLoading;
      }));
  };

  const toggleRoot = (root: AuthorizableObject) => {
    const next = new Set(expanded);
    if (next.has(root.id)) {
      next.delete(root.id);
      setExpanded(next);
      return;
    }
    next.add(root.id);
    setExpanded(next);
    for (const category of listTopResourceChildCategories(root)) {
      const key = childKey(root, category);
      if (childrenByCategory[key] || loadingChildren.has(key)) continue;
      loadChildPage(root, category, { page: 1, pageSize: CHILD_DEFAULT_PAGE_SIZE });
    }
  };

  const renderChildren = (root: AuthorizableObject) => {
    const categories = listTopResourceChildCategories(root);
    return (
      <div className={styles.topResourceChildren}>
        {categories.map((category) => {
          const key = childKey(root, category);
          const result = childrenByCategory[key];
          const paging = childPageState[key] ?? { page: 1, pageSize: CHILD_DEFAULT_PAGE_SIZE };
          const loading = loadingChildren.has(key);
          if (!loading && (!result || result.total === 0)) return null;
          return (
          <section className={styles.topResourceCategory} key={category}>
            <div className={styles.topResourceCategoryHead}>
              <span>{resourceTypeLabel(category)}</span>
            </div>
            {loading ? <div className={styles.topResourceLoading}><Spin size="small" /></div> : null}
            {result?.children.map((child) => (
              <div className={styles.topResourceChildRow} key={`${child.type}:${child.id}`}>
                <div>
                  <strong>{child.name}</strong>
                  <small>{child.sub}</small>
                </div>
                <AppButton onClick={() => onManage(child)} type="link">
                  {t("systemAdmin.objectGrants.manage")}
                </AppButton>
              </div>
            ))}
            {!loading && result && result.total > 0 ? (
              <TablePaginationBar
                current={paging.page}
                onChange={(nextPage, nextPageSize) => {
                  loadChildPage(root, category, {
                    page: nextPageSize === paging.pageSize ? nextPage : 1,
                    pageSize: nextPageSize,
                  });
                }}
                pageSize={paging.pageSize}
                showSizeChanger
                showTotal={(count) => t("common.total", { total: count })}
                size="small"
                total={result.total}
              />
            ) : null}
          </section>
          );
        })}
      </div>
    );
  };

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
        const isExpanded = expanded.has(root.id);
        const canExpand = fineGrained && (root.type === "catalog" || root.type === "knowledge_network");
        return (
          <article className={styles.topResourceRow} key={`${root.type}:${root.id}`}>
            {canExpand ? (
              <button
                aria-label={t("systemAdmin.objectGrants.topResourceToggle", { name: root.name })}
                className={styles.topResourceToggle}
                onClick={() => toggleRoot(root)}
                type="button"
              >
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </button>
            ) : <span />}
            <span className={styles.authzAvatar}>{ICONS[root.type] ?? <AppstoreOutlined />}</span>
            <div className={styles.topResourceName}>
              <strong>{root.name}</strong>
              <small>{root.sub || root.id}</small>
            </div>
            <Tag className={styles.roleTag}>{resourceTypeLabel(root.type)}</Tag>
            <AppButton onClick={() => onManage(root)} type="link">
              {t("systemAdmin.objectGrants.manage")}
            </AppButton>
            {canExpand && isExpanded ? renderChildren(root) : null}
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
