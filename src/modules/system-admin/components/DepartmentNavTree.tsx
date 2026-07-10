/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  BankOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import type { DataNode } from "antd/es/tree";
import type { TreeProps } from "antd/es/tree";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { BusinessTree, BusinessTreePanel } from "@/framework/ui/common/BusinessTreePanel";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";

import styles from "@/modules/system-admin/scenes/admin.module.css";
import navStyles from "@/modules/system-admin/components/DepartmentNavTree.module.css";

const EXPANDED_STORAGE_KEY = "bkn-studio.system-admin.dept-tree.expanded";

type DepartmentNavTreeProps = {
  departments: AdminDepartment[];
  headerPrimaryAction?: ReactNode;
  headerSecondaryActions?: ReactNode;
  onAddChild?: (parentId: string) => void;
  onDelete?: (dept: AdminDepartment) => void;
  onEdit?: (dept: AdminDepartment) => void;
  onMembers?: (dept: AdminDepartment) => void;
  onReparent: (dragId: string, newParentId: string | null) => void;
  onSelect: (deptId: string | null) => void;
  selectedDeptId: string | null;
  totalUserCount: number;
};

function readExpandedKeys(): string[] | null {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function memberCountValue(dept: AdminDepartment) {
  return dept.subtreeMemberCount ?? dept.memberCount;
}

function highlightName(name: string, query: string) {
  if (!query) {
    return name;
  }
  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerName.indexOf(lowerQuery);
  if (index < 0) {
    return name;
  }
  return (
    <>
      {name.slice(0, index)}
      <mark className={navStyles.searchHit}>{name.slice(index, index + query.length)}</mark>
      {name.slice(index + query.length)}
    </>
  );
}

function DeptTypeIcon({ type }: { type: string }) {
  if (type === "org") {
    return <BankOutlined className={navStyles.nodeIcon} />;
  }
  return <ApartmentOutlined className={navStyles.nodeIcon} />;
}

export function DepartmentNavTree({
  departments,
  headerPrimaryAction,
  headerSecondaryActions,
  onAddChild,
  onDelete,
  onEdit,
  onMembers,
  onReparent,
  onSelect,
  selectedDeptId,
  totalUserCount,
}: DepartmentNavTreeProps) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const [deptSearch, setDeptSearch] = useState("");
  const debouncedDeptSearch = useDebouncedValue(deptSearch.trim().toLowerCase());
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => readExpandedKeys() ?? []);
  const [initialExpandDone, setInitialExpandDone] = useState(() => readExpandedKeys() !== null);

  const permissions = runtimeConfig.currentUser.permissions;
  const canEditDept = hasPermissions({
    currentPermissions: permissions,
    requiredPermissions: "admin-dept:edit",
  });
  const canCreateDept = hasPermissions({
    currentPermissions: permissions,
    requiredPermissions: "admin-dept:create",
  });
  const canDeleteDept = hasPermissions({
    currentPermissions: permissions,
    requiredPermissions: "admin-dept:delete",
  });
  const canManageMembers = hasPermissions({
    currentPermissions: permissions,
    requiredPermissions: "admin-dept:members",
  });

  const byId = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept])),
    [departments],
  );

  const visibleDeptIds = useMemo(() => {
    if (!debouncedDeptSearch) {
      return new Set(departments.map((dept) => dept.id));
    }
    const visible = new Set<string>();
    const collectDescendants = (id: string) => {
      for (const child of departments.filter((dept) => dept.parentId === id)) {
        visible.add(child.id);
        collectDescendants(child.id);
      }
    };
    for (const dept of departments) {
      if (!dept.name.toLowerCase().includes(debouncedDeptSearch)) {
        continue;
      }
      let current: AdminDepartment | undefined = dept;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      collectDescendants(dept.id);
    }
    return visible;
  }, [byId, debouncedDeptSearch, departments]);

  const persistExpandedKeys = useCallback((keys: string[]) => {
    setExpandedKeys(keys);
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(keys));
  }, []);

  useEffect(() => {
    if (initialExpandDone || !departments.length) {
      return;
    }
    const roots = departments.filter((dept) => !dept.parentId).map((dept) => dept.id);
    persistExpandedKeys(roots);
    setInitialExpandDone(true);
  }, [departments, initialExpandDone, persistExpandedKeys]);

  useEffect(() => {
    if (!debouncedDeptSearch) {
      return;
    }
    setExpandedKeys((current) => {
      const next = [...new Set([...visibleDeptIds, ...current])];
      localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [debouncedDeptSearch, visibleDeptIds]);

  const countBadge = useCallback(
    (count: number | undefined, hint: string) => {
      if (count === undefined) {
        return null;
      }
      return (
        <Tooltip title={hint}>
          <span className={navStyles.countBadge}>{count}</span>
        </Tooltip>
      );
    },
    [],
  );

  const buildContextMenu = useCallback(
    (dept: AdminDepartment): MenuProps["items"] => {
      const items: NonNullable<MenuProps["items"]> = [];
      if (canManageMembers && onMembers) {
        items.push({
          key: "members",
          label: t("systemAdmin.users.actions.members"),
          onClick: () => onMembers(dept),
        });
      }
      if (canCreateDept && onAddChild) {
        items.push({
          key: "add-child",
          label: t("systemAdmin.users.actions.addChild"),
          onClick: () => onAddChild(dept.id),
        });
      }
      if (canEditDept && onEdit) {
        items.push({
          key: "edit",
          label: t("systemAdmin.users.actions.edit"),
          onClick: () => onEdit(dept),
        });
      }
      if (canDeleteDept && onDelete) {
        items.push({
          key: "delete",
          danger: true,
          label: t("systemAdmin.users.actions.delete"),
          onClick: () => onDelete(dept),
        });
      }
      return items.length ? items : undefined;
    },
    [canCreateDept, canDeleteDept, canEditDept, canManageMembers, onAddChild, onDelete, onEdit, onMembers, t],
  );

  const renderDeptTitle = useCallback(
    (dept: AdminDepartment) => {
      const count = memberCountValue(dept);
      const row = (
        <span
          className={navStyles.nodeRow}
          onClick={() => onSelect(dept.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(dept.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className={navStyles.nodeLeading}>
            <DeptTypeIcon type={dept.type} />
            <Tooltip title={dept.name}>
              <span className={navStyles.nodeName}>
                {highlightName(dept.name, debouncedDeptSearch)}
              </span>
            </Tooltip>
            {dept.type === "org" ? (
              <span className={navStyles.orgBadge}>{t("systemAdmin.users.deptDrawer.typeOrg")}</span>
            ) : null}
          </span>
          {countBadge(count, t("systemAdmin.users.deptNode.memberCountSubtreeHint"))}
        </span>
      );
      const menuItems = buildContextMenu(dept);
      if (!menuItems) {
        return row;
      }
      return (
        <Dropdown menu={{ items: menuItems }} trigger={["contextMenu"]}>
          {row}
        </Dropdown>
      );
    },
    [buildContextMenu, countBadge, debouncedDeptSearch, onSelect, t],
  );

  const treeData = useMemo(() => {
    const childrenOf = (parentId: string | null): DataNode[] =>
      departments
        .filter((dept) => dept.parentId === parentId)
        .filter((dept) => visibleDeptIds.has(dept.id))
        .map((dept) => ({
          key: dept.id,
          title: renderDeptTitle(dept),
          children: childrenOf(dept.id),
        }));

    return childrenOf(null);
  }, [departments, renderDeptTitle, visibleDeptIds]);

  const handleSelect: TreeProps["onSelect"] = (keys, info) => {
    if (!info.selected) {
      return;
    }
    const key = String(keys[0] ?? "");
    if (key) {
      onSelect(key);
    }
  };

  const handleDrop: TreeProps["onDrop"] = (info) => {
    if (!canEditDept) {
      return;
    }
    const dragKey = String(info.dragNode.key);
    const dropKey = String(info.node.key);
    const newParentId = info.dropToGap ? (byId.get(dropKey)?.parentId ?? null) : dropKey;

    if (dragKey === newParentId) {
      return;
    }
    if ((byId.get(dragKey)?.parentId ?? null) === newParentId) {
      return;
    }

    const descendants = new Set<string>();
    const collect = (id: string) => {
      for (const child of departments.filter((d) => d.parentId === id)) {
        descendants.add(child.id);
        collect(child.id);
      }
    };
    collect(dragKey);
    if (newParentId && descendants.has(newParentId)) {
      void message.error(t("systemAdmin.users.deptNode.cycleError"));
      return;
    }
    onReparent(dragKey, newParentId);
  };

  const allUsersActive = !selectedDeptId;

  return (
    <BusinessTreePanel
      actionsClassName={navStyles.treeHeaderActions}
      bodyClassName={navStyles.treeBody}
      className={navStyles.treePanel}
      headerClassName={navStyles.treeHeader}
      headerActions={headerSecondaryActions}
      onSearchChange={setDeptSearch}
      scrollBody={false}
      searchPlaceholder={t("systemAdmin.users.deptNode.deptSearchPlaceholder")}
      searchValue={deptSearch}
      title={
        <div className={navStyles.treeHeaderTitle}>
          <span className={navStyles.treeHeaderTitleText}>
            {t("systemAdmin.users.deptTreeTitle")}
          </span>
          {headerPrimaryAction ? (
            <div className={navStyles.treeHeaderPrimaryAction}>{headerPrimaryAction}</div>
          ) : null}
        </div>
      }
    >
      <div className={navStyles.treeContent}>
        <button
          className={[navStyles.scopeItem, allUsersActive ? navStyles.scopeItemActive : ""].join(" ")}
          onClick={() => onSelect(null)}
          type="button"
        >
          <span className={navStyles.scopeLeading}>
            <TeamOutlined className={navStyles.scopeIcon} />
            <span className={navStyles.scopeLabel}>{t("systemAdmin.users.allUsersNode")}</span>
          </span>
          {countBadge(totalUserCount, t("systemAdmin.users.allUsersScopeLabel"))}
        </button>

        {treeData.length ? (
          <div className={navStyles.treeScroll}>
            <BusinessTree
              blockNode
              className={[styles.deptTree, navStyles.navTree].join(" ")}
              draggable={
                canEditDept
                  ? {
                      icon: false,
                      nodeDraggable: () => true,
                    }
                  : false
              }
              expandedKeys={expandedKeys}
              onDrop={handleDrop}
              onExpand={(keys) => persistExpandedKeys(keys.map(String))}
              onSelect={handleSelect}
              selectedKeys={selectedDeptId ? [selectedDeptId] : []}
              treeData={treeData}
            />
          </div>
        ) : debouncedDeptSearch ? (
          <p className={navStyles.emptySearch}>{t("systemAdmin.users.deptNode.searchEmpty")}</p>
        ) : null}
      </div>
    </BusinessTreePanel>
  );
}
