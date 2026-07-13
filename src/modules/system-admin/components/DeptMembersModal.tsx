/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ColumnsType } from "antd/es/table";
import { Input, Modal, Select, Tag } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import {
  listDepartmentMembers,
  listUsersPage,
  setDepartmentMembers,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminUser } from "@/modules/system-admin/types/admin";
import { deptPath } from "@/modules/system-admin/utils/admin-helpers";
import { extractSystemAdminErrorMessage } from "@/modules/system-admin/utils/system-admin-error-message";

import modalStyles from "@/modules/system-admin/components/DeptMembersModal.module.css";
import styles from "@/modules/system-admin/scenes/admin.module.css";

const DEFAULT_MEMBER_PAGE_SIZE = 10;
const CANDIDATE_SEARCH_LIMIT = 50;

type DeptMembersModalProps = {
  department: AdminDepartment;
  departments: AdminDepartment[];
  onChanged: () => void;
  onClose: () => void;
  open: boolean;
};

function formatMemberTime(value: number | undefined, locale: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

function formatNameList(names: string[] | undefined, empty: ReactNode) {
  if (!names?.length) {
    return empty;
  }
  return names.join("、");
}

export function DeptMembersModal({
  department,
  departments,
  onChanged,
  onClose,
  open,
}: DeptMembersModalProps) {
  const { t, i18n } = useTranslation();
  const { message } = useAppServices();
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(DEFAULT_MEMBER_PAGE_SIZE);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<{ label: string; value: string }[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch.trim());
  const candidateRequestSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listDepartmentMembers(department.id, { skipErrorToast: true }));
    } catch (error) {
      void message.error(extractSystemAdminErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [department.id, message]);

  useEffect(() => {
    if (open) {
      setMemberSearch("");
      setCandidateSearch("");
      setCandidates([]);
      setCandidateOptions([]);
      setMemberPage(1);
      setMemberPageSize(DEFAULT_MEMBER_PAGE_SIZE);
      void load();
    }
  }, [load, open]);

  const memberIdSet = useMemo(() => new Set(members.map((user) => user.id)), [members]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const requestSeq = ++candidateRequestSeq.current;
    setCandidateLoading(true);
    void listUsersPage(
      {
        limit: CANDIDATE_SEARCH_LIMIT,
        offset: 0,
        search: debouncedCandidateSearch || undefined,
      },
      { skipErrorToast: true },
    )
      .then((result) => {
        if (requestSeq !== candidateRequestSeq.current) {
          return;
        }
        setCandidateOptions(
          result.users
            .filter((user) => !memberIdSet.has(user.id))
            .map((user) => ({ label: `${user.name}（${user.account}）`, value: user.id })),
        );
      })
      .catch(() => {
        if (requestSeq === candidateRequestSeq.current) {
          setCandidateOptions([]);
        }
      })
      .finally(() => {
        if (requestSeq === candidateRequestSeq.current) {
          setCandidateLoading(false);
        }
      });
  }, [debouncedCandidateSearch, memberIdSet, open]);

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) {
      return members;
    }
    return members.filter((user) => {
      const haystack = [
        user.name,
        user.account,
        user.email,
        user.telephone,
        ...(user.departmentNames ?? []),
        ...(user.roleNames ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [memberSearch, members]);

  useEffect(() => {
    setMemberPage(1);
  }, [memberSearch, members.length]);

  const pagedMembers = useMemo(() => {
    const start = (memberPage - 1) * memberPageSize;
    return filteredMembers.slice(start, start + memberPageSize);
  }, [filteredMembers, memberPage, memberPageSize]);

  const removeMember = useCallback(
    async (userId: string) => {
      setSaving(true);
      try {
        await setDepartmentMembers(department.id, [userId], false, { skipErrorToast: true });
        setMembers((current) => current.filter((user) => user.id !== userId));
        message.success(t("systemAdmin.users.deptMembers.removed"));
        onChanged();
      } catch (error) {
        void message.error(extractSystemAdminErrorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [department.id, message, onChanged, t],
  );

  const columns = useMemo<ColumnsType<AdminUser>>(
    () => [
      {
        title: t("systemAdmin.users.columns.user"),
        key: "user",
        width: 200,
        render: (_, user) => (
          <div className={styles.nameCell}>
            <span className={styles.nameTitle}>
              {user.name}
              {user.builtin ? `（${t("systemAdmin.users.builtin")}）` : ""}
            </span>
            <span className={styles.subText}>
              {user.account}
              {user.email ? ` · ${user.email}` : ""}
            </span>
          </div>
        ),
      },
      {
        title: t("systemAdmin.users.columns.telephone"),
        dataIndex: "telephone",
        width: 120,
        render: (value: string) => value?.trim() || <span className={styles.mutedText}>—</span>,
      },
      {
        title: t("systemAdmin.users.columns.department"),
        key: "department",
        width: 140,
        render: (_, user) =>
          formatNameList(
            user.departmentNames,
            <span className={styles.mutedText}>{deptPath(departments, department.id)}</span>,
          ),
      },
      {
        title: t("systemAdmin.users.columns.roles"),
        key: "roles",
        ellipsis: true,
        render: (_, user) =>
          formatNameList(
            user.roleNames,
            <span className={styles.mutedText}>{t("systemAdmin.users.rolesEmpty")}</span>,
          ),
      },
      {
        title: t("systemAdmin.users.columns.status"),
        key: "status",
        width: 88,
        render: (_, user) => (
          <Tag
            className={[
              styles.statusTag,
              user.enabled ? styles.statusEnabled : styles.statusDisabled,
            ].join(" ")}
          >
            {user.enabled ? t("systemAdmin.users.statusEnabled") : t("systemAdmin.users.statusDisabled")}
          </Tag>
        ),
      },
      {
        title: t("systemAdmin.users.columns.updateTime"),
        dataIndex: "updatedAt",
        width: 132,
        render: (value?: number) => (
          <span className={styles.subText}>{formatMemberTime(value, i18n.language)}</span>
        ),
      },
      {
        title: t("systemAdmin.users.columns.actions"),
        key: "actions",
        width: 72,
        fixed: "right",
        render: (_, user) => (
          <AppButton
            className={[styles.actionLink, styles.actionDanger].join(" ")}
            disabled={saving}
            onClick={() => void removeMember(user.id)}
            type="link"
          >
            {t("systemAdmin.users.deptMembers.remove")}
          </AppButton>
        ),
      },
    ],
    [department.id, departments, i18n.language, removeMember, saving, t],
  );

  const addMembers = async () => {
    if (!candidates.length) {
      return;
    }
    const adding = [...candidates];
    setSaving(true);
    try {
      await setDepartmentMembers(department.id, adding, true, { skipErrorToast: true });
      setCandidates([]);
      message.success(
        adding.length > 1
          ? t("systemAdmin.users.deptMembers.batchAdded", { count: adding.length })
          : t("systemAdmin.users.deptMembers.added"),
      );
      await load();
      onChanged();
    } catch (error) {
      void message.error(extractSystemAdminErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={t("systemAdmin.users.deptMembers.title", { name: deptPath(departments, department.id) })}
      width={920}
    >
      <p className={styles.mutedText} style={{ marginBottom: 12 }}>
        {t("systemAdmin.users.deptMembers.memberCount", { count: members.length })}
      </p>
      <div className={modalStyles.toolbar}>
        <Select
          className={modalStyles.memberSelect}
          disabled={saving}
          filterOption={false}
          loading={candidateLoading}
          mode="multiple"
          onChange={(values) => setCandidates(values)}
          onSearch={setCandidateSearch}
          options={candidateOptions}
          placeholder={t("systemAdmin.users.deptMembers.addPlaceholder")}
          showSearch
          value={candidates}
        />
        <AppButton
          className={modalStyles.addButton}
          disabled={!candidates.length || saving}
          loading={saving}
          onClick={() => void addMembers()}
          type="primary"
        >
          {t("systemAdmin.users.deptMembers.add")}
        </AppButton>
        <Input
          allowClear
          className={[styles.searchInput, modalStyles.searchInput].join(" ")}
          disabled={loading || saving}
          onChange={(event) => setMemberSearch(event.target.value)}
          placeholder={t("systemAdmin.users.deptMembers.memberSearchPlaceholder")}
          value={memberSearch}
        />
      </div>
      <div className={modalStyles.memberPanel}>
        <AppTable<AdminUser>
          className={modalStyles.memberTable}
          columns={columns}
          dataSource={pagedMembers}
          loading={loading || saving}
          locale={{
            emptyText: memberSearch.trim()
              ? t("systemAdmin.users.deptNode.searchEmpty")
              : t("systemAdmin.users.deptMembers.empty"),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 860 }}
          size="small"
        />
      </div>
      {filteredMembers.length > 0 ? (
        <TablePaginationBar
          current={memberPage}
          onChange={(page, pageSize) => {
            setMemberPage(page);
            setMemberPageSize(pageSize);
          }}
          pageSize={memberPageSize}
          showSizeChanger
          showTotal={(total) => t("common.total", { total })}
          total={filteredMembers.length}
        />
      ) : null}
      <p className={styles.footNote} style={{ marginTop: 16 }}>
        {t("systemAdmin.users.deptMembers.note")}
      </p>
    </Modal>
  );
}
