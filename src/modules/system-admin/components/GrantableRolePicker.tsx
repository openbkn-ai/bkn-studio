/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, SearchOutlined, TeamOutlined } from "@ant-design/icons";
import { Avatar, Empty, Input, Select, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import {
  type GrantableRole,
  listGrantableRolesForObject,
} from "@/modules/system-admin/services/authz.service";

import styles from "./DirectoryUserPicker.module.css";

const EMPTY_ROLES: GrantableRole[] = [];

export type GrantableRolePickerProps = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  initialRoles?: GrantableRole[];
  loading?: boolean;
  onChange?: (value: string | undefined) => void;
  onRolesChange?: (roles: GrantableRole[]) => void;
  placeholder?: string;
  presentation?: "inline" | "select";
  resourceId: string;
  resourceType: string;
  value?: string;
};

function mergeRoles(current: Record<string, GrantableRole>, roles: GrantableRole[]) {
  const next = { ...current };
  roles.forEach((role) => {
    next[role.id] = role;
  });
  return next;
}

export function GrantableRolePicker({
  ariaLabel,
  className,
  disabled = false,
  initialRoles = EMPTY_ROLES,
  loading = false,
  onChange,
  onRolesChange,
  placeholder,
  presentation = "select",
  resourceId,
  resourceType,
  value,
}: GrantableRolePickerProps) {
  const { t } = useTranslation();
  const inline = presentation === "inline";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [visibleRoles, setVisibleRoles] = useState<GrantableRole[]>([]);
  const [knownRoles, setKnownRoles] = useState<Record<string, GrantableRole>>(() =>
    mergeRoles({}, initialRoles),
  );
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const requestSequence = useRef(0);
  const active = inline || open;

  useEffect(() => {
    setKnownRoles((current) => mergeRoles(current, initialRoles));
  }, [initialRoles]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (!active || !resourceId || !resourceType) {
      setVisibleRoles([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    setSearching(true);
    setSearchFailed(false);
    void listGrantableRolesForObject(resourceType, resourceId, debouncedSearch)
      .then((roles) => {
        if (sequence !== requestSequence.current) return;
        setVisibleRoles(roles);
        setKnownRoles((current) => mergeRoles(current, roles));
      })
      .catch(() => {
        if (sequence !== requestSequence.current) return;
        setVisibleRoles([]);
        setSearchFailed(true);
      })
      .finally(() => {
        if (sequence === requestSequence.current) setSearching(false);
      });
  }, [active, debouncedSearch, resourceId, resourceType]);

  const selectRole = (roleId: string | undefined) => {
    onChange?.(roleId);
    const role = roleId
      ? (knownRoles[roleId] ?? visibleRoles.find((item) => item.id === roleId))
      : undefined;
    onRolesChange?.(role ? [role] : []);
    if (!inline) {
      setOpen(false);
      setSearch("");
    }
  };
  const searchHint = t("knowledgeNetwork.propertyAuthorizationSearchRole");
  const busy = loading || searching;
  const panelRoles = debouncedSearch
    ? visibleRoles
    : Object.values(mergeRoles(mergeRoles({}, initialRoles), visibleRoles));
  const panel = (
    <div
      aria-label={inline ? ariaLabel : undefined}
      className={[styles.pickerPanel, inline ? styles.pickerPanelInline : "", className]
        .filter(Boolean)
        .join(" ")}
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
              <strong>{t("knowledgeNetwork.propertyAuthorizationRole")}</strong>
              <span>{t("systemAdmin.userPicker.resultCount", { count: visibleRoles.length })}</span>
            </div>
          </div>
          <div aria-busy={busy} className={styles.memberList} role="listbox">
            {busy ? (
              <div className={styles.loadingState}>
                <Spin size="small" />
              </div>
            ) : searchFailed ? (
              <Empty description={t("common.requestFailed")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : panelRoles.length ? (
              panelRoles.map((role) => (
                <button
                  aria-selected={value === role.id}
                  className={value === role.id ? styles.memberSelected : styles.member}
                  disabled={disabled}
                  key={role.id}
                  onClick={() => selectRole(role.id)}
                  role="option"
                  type="button"
                >
                  <Avatar className={styles.avatar} icon={<TeamOutlined />} size={30} />
                  <span className={styles.memberIdentity}>
                    <strong>{role.name || role.id}</strong>
                    {role.description ? <small>{role.description}</small> : null}
                  </span>
                  {value === role.id ? <CheckOutlined className={styles.checkIcon} /> : null}
                </button>
              ))
            ) : (
              <Empty
                description={t("knowledgeNetwork.propertyAuthorizationRoleEmpty")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );

  if (inline) return panel;
  return (
    <Select
      allowClear
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      filterOption={false}
      loading={loading}
      notFoundContent={<span aria-hidden />}
      onChange={selectRole}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
      onSearch={setSearch}
      open={open}
      options={Object.values(knownRoles).map((role) => ({ label: role.name, value: role.id }))}
      placeholder={placeholder}
      popupMatchSelectWidth={false}
      popupRender={() => panel}
      searchValue={search}
      showSearch
      suffixIcon={<SearchOutlined />}
      value={value}
    />
  );
}
