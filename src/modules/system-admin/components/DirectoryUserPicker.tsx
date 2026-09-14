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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
          <span title={department.name}>{department.name}</span>
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
  const [moreUsersLoading, setMoreUsersLoading] = useState(false);
  const [loadedUserCount, setLoadedUserCount] = useState(initialUsers.length);
  const [userTotal, setUserTotal] = useState(initialUsers.length);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const requestSequence = useRef(0);
  const active = inline || open;

  const departments = providedDepartments ?? loadedDepartments;
  const disabledUserIdsKey = disabledUserIds.join("\u0000");
  const disabledIdSet = useMemo(
    () => new Set(disabledUserIdsKey ? disabledUserIdsKey.split("\u0000") : []),
    [disabledUserIdsKey],
  );

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
      .then(() => listDepartments({ skipErrorToast: true }))
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
    const sequence = ++requestSequence.current;
    setUserLoading(true);
    setMoreUsersLoading(false);
    setHasMoreUsers(false);
    void Promise.resolve()
      .then(() => listUsersPage(
        {
          departmentId: activeDepartmentId !== ALL_DEPARTMENTS
            ? activeDepartmentId
            : undefined,
          includeSubtree: activeDepartmentId !== ALL_DEPARTMENTS,
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
        setLoadedUserCount(result.users.length);
        setUserTotal(Math.max(users.length, result.total));
        setHasMoreUsers(result.users.length > 0 && result.total > result.users.length);
      })
      .catch(() => {
        if (sequence === requestSequence.current) {
          setVisibleUsers([]);
          setLoadedUserCount(0);
          setUserTotal(0);
          setHasMoreUsers(false);
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
  ]);

  const loadMoreUsers = useCallback(() => {
    if (!active || !hasMoreUsers || userLoading || moreUsersLoading) {
      return;
    }
    const sequence = requestSequence.current;
    const offset = loadedUserCount;
    setMoreUsersLoading(true);
    void Promise.resolve()
      .then(() => listUsersPage(
        {
          departmentId: activeDepartmentId !== ALL_DEPARTMENTS
            ? activeDepartmentId
            : undefined,
          includeSubtree: activeDepartmentId !== ALL_DEPARTMENTS,
          limit: USER_PAGE_LIMIT,
          offset,
          search: debouncedSearch || undefined,
        },
        { skipErrorToast: true },
      ))
      .then((result) => {
        if (sequence !== requestSequence.current) {
          return;
        }
        const users = result.users.filter((user) => !disabledIdSet.has(user.id));
        setVisibleUsers((current) => {
          const existingIds = new Set(current.map((user) => user.id));
          return [...current, ...users.filter((user) => !existingIds.has(user.id))];
        });
        setKnownUsers((current) => mergeUsers(current, users));
        const nextOffset = offset + result.users.length;
        setLoadedUserCount(nextOffset);
        setUserTotal((current) => Math.max(current, result.total));
        setHasMoreUsers(result.users.length > 0 && result.total > nextOffset);
      })
      .catch(() => undefined)
      .finally(() => {
        if (sequence === requestSequence.current) {
          setMoreUsersLoading(false);
        }
      });
  }, [
    active,
    activeDepartmentId,
    debouncedSearch,
    disabledIdSet,
    hasMoreUsers,
    loadedUserCount,
    moreUsersLoading,
    userLoading,
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
  const searchHint = activeDepartment
    ? t("systemAdmin.userPicker.searchWithinDepartment", { department: activeDepartment.name })
    : t("systemAdmin.userPicker.searchAllUsers");
  const panelTitle = activeDepartment?.name
    ?? (debouncedSearch
      ? t("systemAdmin.userPicker.searchResults")
      : inline ? t("systemAdmin.userPicker.users") : t("systemAdmin.userPicker.allUsers"));
  const resultSummary = disabledUserIds.length > 0
    ? hasMoreUsers || loadedUserCount < userTotal
      ? t("systemAdmin.userPicker.loadedSelectableCount", { count: visibleUsers.length })
      : t("systemAdmin.userPicker.resultCount", { count: visibleUsers.length })
    : hasMoreUsers || loadedUserCount < userTotal
    ? t("systemAdmin.userPicker.resultRange", {
      count: userTotal,
      from: 1,
      to: loadedUserCount,
    })
    : t("systemAdmin.userPicker.resultCount", { count: userTotal });
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
            aria-label={searchHint}
            className={styles.searchInput}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchHint}
            prefix={<SearchOutlined aria-hidden />}
            value={search}
          />
        </div>
      ) : (
        <div className={styles.panelHeader}>
          <Input
            allowClear
            aria-label={searchHint}
            className={styles.searchInput}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchHint}
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
              <span>{resultSummary}</span>
            </div>
            {multiple && selectedIds.length ? (
              <span className={styles.selectedCount}>
                {t("systemAdmin.userPicker.selectedCount", { count: selectedIds.length })}
              </span>
            ) : null}
          </div>
          <div
            aria-busy={panelBusy || moreUsersLoading}
            className={styles.memberList}
            onScroll={(event) => {
              const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
              if (scrollTop + clientHeight >= scrollHeight - 32) {
                loadMoreUsers();
              }
            }}
            role="listbox"
          >
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
          {hasMoreUsers || moreUsersLoading ? (
            <div className={styles.resultHint}>
              <span>{t("systemAdmin.userPicker.loadMoreHint")}</span>
              <button
                className={styles.loadMoreButton}
                disabled={moreUsersLoading}
                onClick={loadMoreUsers}
                type="button"
              >
                {moreUsersLoading
                  ? t("systemAdmin.userPicker.loadingMore")
                  : t("systemAdmin.userPicker.loadMore")}
              </button>
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
