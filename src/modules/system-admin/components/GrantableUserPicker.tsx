/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Empty, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { listGrantableUsersForObject } from "@/modules/system-admin/services/authz.service";
import type { AdminUser } from "@/modules/system-admin/types/admin";

import styles from "./DirectoryUserPicker.module.css";

const EMPTY_USERS: AdminUser[] = [];
const EMPTY_USER_IDS: string[] = [];

export type GrantableUserPickerProps = {
  allowClear?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  disabledUserIds?: string[];
  id?: string;
  initialUsers?: AdminUser[];
  loading?: boolean;
  onChange?: (value: string | undefined) => void;
  onUsersChange?: (users: AdminUser[]) => void;
  placeholder?: string;
  presentation?: "inline" | "select";
  resourceId: string;
  resourceType: string;
  value?: string;
};

function mergeUsers(current: Record<string, AdminUser>, users: AdminUser[]) {
  const next = { ...current };
  users.forEach((user) => {
    next[user.id] = user;
  });
  return next;
}

function displayName(user: AdminUser) {
  return user.name?.trim() || user.account?.trim() || user.id;
}

export function GrantableUserPicker({
  allowClear = true,
  ariaLabel,
  className,
  disabled = false,
  disabledUserIds = EMPTY_USER_IDS,
  id,
  initialUsers = EMPTY_USERS,
  loading = false,
  onChange,
  onUsersChange,
  placeholder,
  presentation = "select",
  resourceId,
  resourceType,
  value,
}: GrantableUserPickerProps) {
  const { t } = useTranslation();
  const inline = presentation === "inline";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [visibleUsers, setVisibleUsers] = useState<AdminUser[]>([]);
  const [knownUsers, setKnownUsers] = useState<Record<string, AdminUser>>(() =>
    mergeUsers({}, initialUsers),
  );
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const requestSequence = useRef(0);
  const active = inline || open;
  const disabledIdSet = useMemo(() => new Set(disabledUserIds), [disabledUserIds]);

  useEffect(() => {
    setKnownUsers((current) => mergeUsers(current, initialUsers));
  }, [initialUsers]);

  const disabledUserIdsKey = disabledUserIds.join("\u0000");
  const disabledIdSet = useMemo(
    () => new Set(disabledUserIdsKey ? disabledUserIdsKey.split("\u0000") : []),
    [disabledUserIdsKey],
  );
    const sequence = ++requestSequence.current;
    if (!active || !debouncedSearch || !resourceId || !resourceType) {
      setVisibleUsers([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }

    setSearching(true);
    setSearchFailed(false);
    void listGrantableUsersForObject(resourceType, resourceId, debouncedSearch)
      .then((users) => {
        if (sequence !== requestSequence.current) return;
        const selectable = users.filter((user) => !disabledIdSet.has(user.id));
        setVisibleUsers(selectable);
        setKnownUsers((current) => mergeUsers(current, selectable));
      })
      .catch(() => {
        if (sequence !== requestSequence.current) return;
        setVisibleUsers([]);
        setSearchFailed(true);
      })
      .finally(() => {
        if (sequence === requestSequence.current) setSearching(false);
      });
  }, [active, debouncedSearch, disabledIdSet, resourceId, resourceType]);

  const selectOptions = useMemo(
    () =>
      Object.values(mergeUsers(knownUsers, visibleUsers)).map((user) => ({
        label: `${displayName(user)} (${user.account || user.id})`,
        value: user.id,
      })),
    [knownUsers, visibleUsers],
  );
  const panelUsers = useMemo(
    () =>
      (debouncedSearch ? visibleUsers : Object.values(knownUsers)).filter(
        (user) => !disabledIdSet.has(user.id),
      ),
    [debouncedSearch, disabledIdSet, knownUsers, visibleUsers],
  );

  const selectUser = (userId: string | undefined) => {
    onChange?.(userId);
    const user = userId
      ? (knownUsers[userId] ?? visibleUsers.find((item) => item.id === userId))
      : undefined;
    onUsersChange?.(user ? [user] : []);
    if (!inline) {
      setOpen(false);
      setSearch("");
    }
  };

  const searchHint = t("systemAdmin.userPicker.searchAllUsers");
  const panelBusy = loading || searching;
  const pickerPanel = (
    <div
      aria-label={inline ? ariaLabel : undefined}
      className={[
        styles.pickerPanel,
        inline ? styles.pickerPanelInline : "",
        inline ? className : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-presentation={presentation}
      onMouseDown={
        inline
          ? undefined
          : (event) => {
              if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
              event.stopPropagation();
            }
      }
      role={inline ? "group" : undefined}
    >
      <div className={inline ? styles.inlineControls : styles.panelHeader}>
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
      <div className={inline ? styles.panelBodyInline : styles.panelBodyFlat}>
        <section className={styles.memberPane}>
          <div className={styles.memberPaneHead}>
            <div>
              <strong>
                {debouncedSearch
                  ? t("systemAdmin.userPicker.searchResults")
                  : t("systemAdmin.userPicker.users")}
              </strong>
              <span>
                {debouncedSearch
                  ? t("systemAdmin.userPicker.resultCount", { count: visibleUsers.length })
                  : t("systemAdmin.userPicker.resultCount", { count: panelUsers.length })}
              </span>
            </div>
          </div>
          <div aria-busy={panelBusy} className={styles.memberList} role="listbox">
            {panelBusy ? (
              <div className={styles.loadingState}>
                <Spin size="small" />
              </div>
            ) : searchFailed ? (
              <Empty
                className={styles.emptyState}
                description={t("common.requestFailed")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : panelUsers.length ? (
              panelUsers.map((user) => {
                const selected = value === user.id;
                return (
                  <button
                    aria-selected={selected}
                    className={selected ? styles.memberSelected : styles.member}
                    disabled={disabled}
                    key={user.id}
                    onClick={() => selectUser(user.id)}
                    role="option"
                    type="button"
                  >
                    <Avatar className={styles.avatar} icon={<UserOutlined />} size={30} />
                    <span className={styles.memberIdentity}>
                      <strong>{displayName(user)}</strong>
                      <small>{user.account || user.id}</small>
                    </span>
                    {selected ? <CheckOutlined className={styles.checkIcon} /> : null}
                  </button>
                );
              })
            ) : (
              <Empty
                className={styles.emptyState}
                description={
                  debouncedSearch
                    ? t("systemAdmin.userPicker.empty")
                    : t("systemAdmin.userPicker.searchHint")
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );

  if (inline) return pickerPanel;

  return (
    <Select
      allowClear={allowClear}
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      filterOption={false}
      id={id}
      loading={loading}
      notFoundContent={null}
      onChange={(nextValue) => selectUser(nextValue)}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
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
      value={value}
    />
  );
}
