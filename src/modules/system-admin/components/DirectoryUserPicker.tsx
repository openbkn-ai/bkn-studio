/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  CheckOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Empty, Input, Select, Spin, Tree, TreeSelect } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import {
  getUser,
  listDepartments,
  listUsersPage,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";

import styles from "./DirectoryUserPicker.module.css";

const ALL_DEPARTMENTS = "__all_departments__";
const USER_PAGE_LIMIT = 100;
const EMPTY_DEPARTMENTS: AdminDepartment[] = [];
const EMPTY_USERS: AdminUser[] = [];
const EMPTY_USER_IDS: string[] = [];

type SharedProps = {
  allowClear?: boolean;
  ariaLabel?: string;
  className?: string;
  departments?: AdminDepartment[];
  disabled?: boolean;
  disabledUserIds?: string[];
  id?: string;
  initialUsers?: AdminUser[];
  loading?: boolean;
  onUsersChange?: (users: AdminUser[]) => void;
  placeholder?: string;
  presentation?: "inline" | "select";
};

type SingleProps = SharedProps & {
  mode?: "single";
  onChange?: (value: string | undefined) => void;
  value?: string;
};

type MultipleProps = SharedProps & {
  mode: "multiple";
  onChange?: (value: string[]) => void;
  value?: string[];
};

export type DirectoryUserPickerProps = SingleProps | MultipleProps;

type DirectoryTreeNode = DataNode & {
  children?: DirectoryTreeNode[];
  value: string;
};

function mergeUsers(current: Record<string, AdminUser>, users: AdminUser[]) {
  const next = { ...current };
  for (const user of users) {
    next[user.id] = user;
  }
  return next;
}

function buildDepartmentTree(
  departments: AdminDepartment[],
  memberCountLabel: (count: number) => string,
): DirectoryTreeNode[] {
  const byParent = new Map<string | null, AdminDepartment[]>();
  const ids = new Set(departments.map((department) => department.id));
  for (const department of departments) {
    const parentId = department.parentId && ids.has(department.parentId)
      ? department.parentId
      : null;
    const siblings = byParent.get(parentId) ?? [];
    siblings.push(department);
    byParent.set(parentId, siblings);
  }

  const visited = new Set<string>();
  const visit = (department: AdminDepartment): DirectoryTreeNode => {
    visited.add(department.id);
    const count = department.subtreeMemberCount ?? department.memberCount;
    return {
      children: (byParent.get(department.id) ?? [])
        .filter((child) => !visited.has(child.id))
        .map(visit),
      key: department.id,
      title: (
        <span className={styles.departmentTitle}>
          <span>{department.name}</span>
          {typeof count === "number" ? <small>{memberCountLabel(count)}</small> : null}
        </span>
      ),
      value: department.id,
    };
  };

  const roots = (byParent.get(null) ?? []).map(visit);
  for (const department of departments) {
    if (!visited.has(department.id)) {
      roots.push(visit(department));
    }
  }
  return roots;
}

function displayName(user: AdminUser) {
  return user.name?.trim() || user.account?.trim() || user.id;
}

export function DirectoryUserPicker(props: DirectoryUserPickerProps) {
  const { t } = useTranslation();
  const {
    allowClear = true,
    ariaLabel,
    className,
    departments: providedDepartments,
    disabled = false,
    disabledUserIds = EMPTY_USER_IDS,
    id,
    initialUsers = EMPTY_USERS,
    loading = false,
    onUsersChange,
    placeholder,
    presentation = "select",
  } = props;
  const inline = presentation === "inline";
  const multiple = props.mode === "multiple";
  const selectedIds = useMemo(
    () => multiple ? (props.value ?? []) : props.value ? [props.value] : [],
    [multiple, props.value],
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [activeDepartmentId, setActiveDepartmentId] = useState(ALL_DEPARTMENTS);
  const [loadedDepartments, setLoadedDepartments] = useState<AdminDepartment[]>(EMPTY_DEPARTMENTS);
  const [departmentsResolved, setDepartmentsResolved] = useState(false);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [visibleUsers, setVisibleUsers] = useState<AdminUser[]>(initialUsers);
  const [knownUsers, setKnownUsers] = useState<Record<string, AdminUser>>(() =>
    mergeUsers({}, initialUsers));
  const [userLoading, setUserLoading] = useState(false);
  const [userTotal, setUserTotal] = useState(initialUsers.length);
  const [userResultTruncated, setUserResultTruncated] = useState(false);
  const requestSequence = useRef(0);
  const active = inline || open;

  const departments = providedDepartments ?? loadedDepartments;
  const disabledIdSet = useMemo(() => new Set(disabledUserIds), [disabledUserIds]);

  useEffect(() => {
    setKnownUsers((current) => mergeUsers(current, initialUsers));
  }, [initialUsers]);

  useEffect(() => {
    if (providedDepartments) {
      setDepartmentsResolved(true);
      return;
    }
    if (!active || departmentsResolved || departmentLoading) {
      return;
    }
    setDepartmentLoading(true);
    void Promise.resolve()
      .then(() => listDepartments())
      .then(setLoadedDepartments)
      .catch(() => setLoadedDepartments([]))
      .finally(() => {
        setDepartmentLoading(false);
        setDepartmentsResolved(true);
      });
  }, [active, departmentLoading, departmentsResolved, providedDepartments]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const canUseInitialUsers =
      !debouncedSearch && activeDepartmentId === ALL_DEPARTMENTS && initialUsers.length > 0;
    if (canUseInitialUsers) {
      const filtered = initialUsers.filter((user) => !disabledIdSet.has(user.id));
      setVisibleUsers(filtered);
      setUserTotal(filtered.length);
      setUserResultTruncated(false);
      setUserLoading(false);
      return;
    }

    const sequence = ++requestSequence.current;
    setUserLoading(true);
    setUserResultTruncated(false);
    void Promise.resolve()
      .then(() => listUsersPage(
        {
          departmentId: activeDepartmentId !== ALL_DEPARTMENTS && (inline || !debouncedSearch)
            ? activeDepartmentId
            : undefined,
          includeSubtree: activeDepartmentId !== ALL_DEPARTMENTS && (inline || !debouncedSearch),
          limit: USER_PAGE_LIMIT,
          offset: 0,
          search: debouncedSearch || undefined,
        },
        { skipErrorToast: true },
      ))
      .then((result) => {
        if (sequence !== requestSequence.current) {
          return;
        }
        const users = result.users.filter((user) => !disabledIdSet.has(user.id));
        setVisibleUsers(users);
        setKnownUsers((current) => mergeUsers(current, users));
        setUserTotal(Math.max(users.length, result.total));
        setUserResultTruncated(result.total > result.users.length);
      })
      .catch(() => {
        if (sequence === requestSequence.current) {
          setVisibleUsers([]);
          setUserTotal(0);
          setUserResultTruncated(false);
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) {
          setUserLoading(false);
        }
      });
  }, [
    active,
    activeDepartmentId,
    debouncedSearch,
    disabledIdSet,
    disabledUserIds.length,
    initialUsers,
    inline,
  ]);

  useEffect(() => {
    const missing = selectedIds.filter((userId) => !knownUsers[userId]);
    if (!missing.length) {
      return;
    }
    void Promise.all(
      missing.map((userId) =>
        Promise.resolve()
          .then(() => getUser(userId))
          .catch(() => null)),
    ).then((users) => {
      const resolved = users.filter((user): user is AdminUser => Boolean(user));
      if (resolved.length) {
        setKnownUsers((current) => mergeUsers(current, resolved));
      }
    });
  }, [knownUsers, selectedIds]);

  const departmentTree = useMemo(
    () => buildDepartmentTree(
      departments,
      (count) => t("systemAdmin.userPicker.memberCount", { count }),
    ),
    [departments, t],
  );

  const selectOptions = useMemo(() => {
    const users = mergeUsers(knownUsers, visibleUsers);
    return Object.values(users).map((user) => ({
      label: `${displayName(user)} (${user.account || user.id})`,
      value: user.id,
    }));
  }, [knownUsers, visibleUsers]);

  const changeSelection = (userId: string) => {
    if (multiple) {
      const next = selectedIds.includes(userId)
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId];
      props.onChange?.(next);
      onUsersChange?.(next
        .map((id) => knownUsers[id] ?? visibleUsers.find((user) => user.id === id))
        .filter((user): user is AdminUser => Boolean(user)));
      return;
    }
    props.onChange?.(userId);
    const user = knownUsers[userId] ?? visibleUsers.find((item) => item.id === userId);
    onUsersChange?.(user ? [user] : []);
    if (!inline) {
      setOpen(false);
      setSearch("");
    }
  };

  const handleSelectChange = (nextValue: string | string[] | undefined) => {
    if (multiple) {
      const next = Array.isArray(nextValue) ? nextValue : [];
      props.onChange?.(next);
      onUsersChange?.(next
        .map((id) => knownUsers[id])
        .filter((user): user is AdminUser => Boolean(user)));
    } else {
      const next = typeof nextValue === "string" ? nextValue : undefined;
      props.onChange?.(next);
      onUsersChange?.(next && knownUsers[next] ? [knownUsers[next]] : []);
    }
  };

  const activeDepartment = departments.find((department) => department.id === activeDepartmentId);
  const panelTitle = inline
    ? t("systemAdmin.userPicker.users")
    : debouncedSearch
      ? t("systemAdmin.userPicker.searchResults")
      : activeDepartment?.name ?? t("systemAdmin.userPicker.allUsers");
  const inlineDepartmentTree = useMemo<DirectoryTreeNode[]>(() => [
    {
      key: ALL_DEPARTMENTS,
      title: t("systemAdmin.userPicker.allOrganizations"),
      value: ALL_DEPARTMENTS,
    },
    ...departmentTree,
  ], [departmentTree, t]);
  const panelBusy = loading || userLoading;
  const pickerPanel = (
    <div
      aria-label={inline ? ariaLabel : undefined}
      className={[
        styles.pickerPanel,
        inline ? styles.pickerPanelInline : "",
        inline ? className : "",
      ].filter(Boolean).join(" ")}
      data-presentation={presentation}
      onMouseDown={inline ? undefined : (event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          event.preventDefault();
        }
        event.stopPropagation();
      }}
      role={inline ? "group" : undefined}
    >
      {inline ? (
        <div className={styles.inlineControls}>
          <TreeSelect
            aria-label={t("systemAdmin.userPicker.organizationScope")}
            className={styles.organizationScope}
            disabled={disabled}
            onChange={(value: string) => {
              setSearch("");
              setActiveDepartmentId(value);
            }}
            popupMatchSelectWidth
            showSearch={false}
            treeData={inlineDepartmentTree}
            treeDefaultExpandAll={departments.length <= 12}
            treeLine
            value={activeDepartmentId}
          />
          <Input
            allowClear
            aria-label={t("systemAdmin.userPicker.searchInlineHint")}
            className={styles.searchInput}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("systemAdmin.userPicker.searchInlineHint")}
            prefix={<SearchOutlined aria-hidden />}
            value={search}
          />
        </div>
      ) : (
        <div className={styles.panelHeader}>
          <Input
            allowClear
            aria-label={t("systemAdmin.userPicker.searchHint")}
            className={styles.searchInput}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("systemAdmin.userPicker.searchHint")}
            prefix={<SearchOutlined aria-hidden />}
            value={search}
          />
        </div>
      )}
      <div className={inline
        ? styles.panelBodyInline
        : departments.length ? styles.panelBody : styles.panelBodyFlat}
      >
        {!inline && departments.length ? (
          <aside className={styles.organizationPane}>
            <div className={styles.paneTitle}>
              <ApartmentOutlined aria-hidden />
              <span>{t("systemAdmin.userPicker.organization")}</span>
            </div>
            <button
              aria-pressed={activeDepartmentId === ALL_DEPARTMENTS}
              className={activeDepartmentId === ALL_DEPARTMENTS
                ? styles.allUsersActive
                : styles.allUsers}
              disabled={disabled}
              onClick={() => {
                setSearch("");
                setActiveDepartmentId(ALL_DEPARTMENTS);
              }}
              type="button"
            >
              <span>{t("systemAdmin.userPicker.allUsers")}</span>
            </button>
            <Tree
              blockNode
              defaultExpandAll={departments.length <= 12}
              disabled={disabled}
              onSelect={(keys) => {
                const [key] = keys;
                if (typeof key === "string") {
                  setSearch("");
                  setActiveDepartmentId(key);
                }
              }}
              selectedKeys={activeDepartmentId === ALL_DEPARTMENTS ? [] : [activeDepartmentId]}
              showIcon={false}
              treeData={departmentTree}
            />
          </aside>
        ) : null}
        <section className={styles.memberPane}>
          <div className={styles.memberPaneHead}>
            <div>
              <strong>{panelTitle}</strong>
              <span>{t("systemAdmin.userPicker.resultCount", { count: userTotal })}</span>
            </div>
            {multiple && selectedIds.length ? (
              <span className={styles.selectedCount}>
                {t("systemAdmin.userPicker.selectedCount", { count: selectedIds.length })}
              </span>
            ) : null}
          </div>
          <div aria-busy={panelBusy} className={styles.memberList} role="listbox">
            {panelBusy ? (
              <div className={styles.loadingState}><Spin size="small" /></div>
            ) : visibleUsers.length ? visibleUsers.map((user) => {
              const selected = selectedIds.includes(user.id);
              const unavailable = disabled || user.enabled === false;
              return (
                <button
                  aria-disabled={unavailable}
                  aria-selected={selected}
                  className={selected ? styles.memberSelected : styles.member}
                  disabled={unavailable}
                  key={user.id}
                  onClick={() => changeSelection(user.id)}
                  role="option"
                  type="button"
                >
                  <Avatar className={styles.avatar} icon={<UserOutlined />} size={30} />
                  <span className={styles.memberIdentity}>
                    <strong>{displayName(user)}</strong>
                    <small>{user.account || user.id}</small>
                  </span>
                  {user.enabled === false ? (
                    <span className={styles.disabledStatus}>
                      {t("systemAdmin.userPicker.disabledUser")}
                    </span>
                  ) : selected ? <CheckOutlined className={styles.checkIcon} /> : null}
                </button>
              );
            }) : (
              <Empty
                className={styles.emptyState}
                description={t("systemAdmin.userPicker.empty")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
          {userResultTruncated ? (
            <div className={styles.resultHint}>
              {t("systemAdmin.userPicker.refineSearch", { count: USER_PAGE_LIMIT })}
            </div>
          ) : null}
        </section>
      </div>
      {!departments.length && departmentsResolved ? (
        <div className={styles.fallbackHint}>
          {t("systemAdmin.userPicker.organizationUnavailable")}
        </div>
      ) : departmentLoading ? (
        <div className={styles.fallbackHint}>
          <Spin size="small" /> {t("systemAdmin.userPicker.loadingOrganization")}
        </div>
      ) : null}
    </div>
  );

  if (inline) {
    return pickerPanel;
  }

  return (
    <Select
      allowClear={allowClear}
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      filterOption={false}
      id={id}
      loading={loading}
      maxTagCount="responsive"
      mode={multiple ? "multiple" : undefined}
      notFoundContent={null}
      onChange={handleSelectChange}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
      onSearch={setSearch}
      open={open}
      options={selectOptions}
      placeholder={placeholder}
      popupMatchSelectWidth={false}
      popupRender={() => pickerPanel}
      searchValue={search}
      showSearch
      suffixIcon={<SearchOutlined />}
      value={multiple ? selectedIds : selectedIds[0]}
    />
  );
}
