/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ColumnsType } from "antd/es/table";
import { Input, Modal, Select, Tag } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import {
  getUser,
  listUsersPage,
  setRoleMember,
} from "@/modules/system-admin/services/admin.service";
import type { AdminDepartment, AdminRole, RoleMember } from "@/modules/system-admin/types/admin";
import { deptPath } from "@/modules/system-admin/utils/admin-helpers";

import modalStyles from "@/modules/system-admin/components/RoleMembersModal.module.css";
import styles from "@/modules/system-admin/scenes/admin.module.css";

const DEFAULT_PAGE_SIZE = 5;
const CANDIDATE_SEARCH_LIMIT = 50;

type RoleMembersModalProps = {
  departments: AdminDepartment[];
  onChanged: () => void;
  onClose: () => void;
  open: boolean;
  role: AdminRole;
};

export function RoleMembersModal({
  departments,
  onChanged,
  onClose,
  open,
  role,
}: RoleMembersModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [accessorIds, setAccessorIds] = useState<string[]>(role.accessorIds);
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [userCandidateOptions, setUserCandidateOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch.trim());
  const candidateRequestSeq = useRef(0);
  const userLabelRequestSeq = useRef(0);
  const loadedUserLabelIds = useRef(new Set<string>());

  const deptIdSet = useMemo(() => new Set(departments.map((dept) => dept.id)), [departments]);

  useEffect(() => {
    if (!open) {
      setAccessorIds([]);
      setUserLabels({});
      setCandidates([]);
      setCandidateSearch("");
      setUserCandidateOptions([]);
      setMemberSearch("");
      setPage(1);
      loadedUserLabelIds.current = new Set();
      return;
    }
    setAccessorIds(role.accessorIds);
  }, [open, role.accessorIds]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const userIds = accessorIds.filter((id) => !deptIdSet.has(id));
    const missing = userIds.filter((id) => !loadedUserLabelIds.current.has(id));
    if (!missing.length) {
      return;
    }
    missing.forEach((id) => loadedUserLabelIds.current.add(id));
    const requestSeq = ++userLabelRequestSeq.current;
    void Promise.all(
      missing.map((id) =>
        getUser(id)
          .then((user) => ({ id, label: `${user.name}（${user.account}）` }))
          .catch(() => ({ id, label: id })),
      ),
    ).then((results) => {
      if (requestSeq !== userLabelRequestSeq.current) {
        return;
      }
      setUserLabels((current) => {
        const next = { ...current };
        for (const item of results) {
          next[item.id] = item.label;
        }
        return next;
      });
    });
  }, [accessorIds, deptIdSet, open]);

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
        const accessorIdSet = new Set(accessorIds);
        setUserCandidateOptions(
          result.users
            .filter((user) => !accessorIdSet.has(user.id))
            .map((user) => ({ label: `${user.name}（${user.account}）`, value: user.id })),
        );
      })
      .catch(() => {
        if (requestSeq === candidateRequestSeq.current) {
          setUserCandidateOptions([]);
        }
      })
      .finally(() => {
        if (requestSeq === candidateRequestSeq.current) {
          setCandidateLoading(false);
        }
      });
  }, [accessorIds, debouncedCandidateSearch, open]);

  const resolveMember = useCallback(
    (id: string): RoleMember => {
      if (deptIdSet.has(id)) {
        return { id, type: "department", label: deptPath(departments, id) };
      }
      return { id, type: "user", label: userLabels[id] ?? id };
    },
    [departments, deptIdSet, userLabels],
  );

  const candidateOptions = useMemo(() => {
    const query = debouncedCandidateSearch.toLowerCase();
    const deptOptions = departments
      .filter((dept) => !accessorIds.includes(dept.id))
      .filter((dept) => {
        if (!query) {
          return true;
        }
        return deptPath(departments, dept.id).toLowerCase().includes(query);
      })
      .map((dept) => ({
        label: `${t("systemAdmin.roles.membersModal.memberDept")} · ${deptPath(departments, dept.id)}`,
        value: dept.id,
      }));
    return [...userCandidateOptions, ...deptOptions];
  }, [accessorIds, debouncedCandidateSearch, departments, t, userCandidateOptions]);

  const notifyChanged = useCallback(() => {
    onChanged();
  }, [onChanged]);

  const removeMember = useCallback(
    async (accessorId: string) => {
      try {
        await setRoleMember(role.id, accessorId, false);
        setAccessorIds((current) => current.filter((id) => id !== accessorId));
        message.success(t("systemAdmin.roles.toast.memberRemoved"));
        notifyChanged();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    },
    [message, notifyChanged, role.id, t],
  );

  const handleAdd = async () => {
    if (!candidates.length || adding) {
      return;
    }
    const addingIds = [...candidates];
    setCandidates([]);
    setAdding(true);
    try {
      await Promise.all(addingIds.map((id) => setRoleMember(role.id, id, true)));
      setAccessorIds((current) => {
        const next = new Set(current);
        for (const id of addingIds) {
          next.add(id);
        }
        return [...next];
      });
      message.success(t("systemAdmin.roles.toast.memberAdded"));
      notifyChanged();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const resolvedMembers = useMemo(
    () => accessorIds.map((id) => resolveMember(id)),
    [accessorIds, resolveMember],
  );

  const memberCounts = useMemo(() => {
    let userCount = 0;
    let deptCount = 0;
    resolvedMembers.forEach((member) => {
      if (member.type === "department") {
        deptCount += 1;
      } else {
        userCount += 1;
      }
    });
    return { deptCount, userCount };
  }, [resolvedMembers]);

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) {
      return resolvedMembers;
    }
    return resolvedMembers.filter((member) => {
      const haystack = `${member.label} ${member.type}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [memberSearch, resolvedMembers]);

  useEffect(() => {
    setPage(1);
  }, [memberSearch, filteredMembers.length]);

  const pagedMembers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, page, pageSize]);

  const muted = <span className={styles.mutedText}>—</span>;

  const columns = useMemo<ColumnsType<RoleMember>>(
    () => [
      {
        title: t("systemAdmin.roles.membersModal.columns.member"),
        key: "member",
        width: 320,
        render: (_, member) => (
          <div className={styles.nameCell}>
            <span className={styles.nameTitle}>{member.label}</span>
            <span className={styles.subText}>
              {member.type === "user"
                ? t("systemAdmin.roles.membersModal.memberUser")
                : t("systemAdmin.roles.membersModal.memberDept")}
            </span>
          </div>
        ),
      },
      {
        title: t("systemAdmin.roles.membersModal.columns.type"),
        key: "type",
        width: 100,
        render: (_, member) => (
          <Tag className={member.type === "user" ? styles.roleTag : styles.permChip}>
            {member.type === "user"
              ? t("systemAdmin.roles.membersModal.memberUser")
              : t("systemAdmin.roles.membersModal.memberDept")}
          </Tag>
        ),
      },
      {
        title: t("systemAdmin.roles.membersModal.columns.actions"),
        key: "actions",
        width: 80,
        fixed: "right",
        render: (_, member) => (
          <AppButton
            className={[styles.actionLink, styles.actionDanger].join(" ")}
            onClick={() => void removeMember(member.id)}
            type="link"
          >
            {t("systemAdmin.roles.membersModal.remove")}
          </AppButton>
        ),
      },
    ],
    [removeMember, t],
  );

  return (
    <Modal
      className={modalStyles.modal}
      footer={null}
      onCancel={onClose}
      open={open}
      rootClassName={styles.adminOverlay}
      title={t("systemAdmin.roles.membersModal.title", { name: role.name })}
      width={880}
    >
      <div className={modalStyles.content}>
        <div className={modalStyles.summaryGrid}>
          <div className={modalStyles.summaryCard}>
            <span className={modalStyles.summaryLabel}>{t("common.total", { total: accessorIds.length })}</span>
            <strong className={modalStyles.summaryValue}>{accessorIds.length}</strong>
          </div>
          <div className={modalStyles.summaryCard}>
            <span className={modalStyles.summaryLabel}>{t("systemAdmin.roles.membersModal.memberUser")}</span>
            <strong className={modalStyles.summaryValue}>{memberCounts.userCount}</strong>
          </div>
          <div className={modalStyles.summaryCard}>
            <span className={modalStyles.summaryLabel}>{t("systemAdmin.roles.membersModal.memberDept")}</span>
            <strong className={modalStyles.summaryValue}>{memberCounts.deptCount}</strong>
          </div>
        </div>

        <div className={modalStyles.toolbarCard}>
          <div className={modalStyles.addRow}>
            <Select
              className={modalStyles.memberSelect}
              filterOption={false}
              loading={candidateLoading}
              mode="multiple"
              onChange={(values) => setCandidates(values)}
              onSearch={setCandidateSearch}
              options={candidateOptions}
              placeholder={t("systemAdmin.roles.membersModal.addPlaceholder")}
              showSearch
              value={candidates}
            />
            <AppButton
              className={modalStyles.addButton}
              disabled={!candidates.length}
              loading={adding}
              onClick={() => void handleAdd()}
              type="primary"
            >
              {t("systemAdmin.roles.membersModal.add")}
            </AppButton>
          </div>
          <Input
            allowClear
            className={[styles.searchInput, modalStyles.searchInput].join(" ")}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder={t("systemAdmin.roles.membersModal.searchPlaceholder")}
            value={memberSearch}
          />
        </div>

        <div className={modalStyles.memberPanel}>
          {filteredMembers.length ? (
            <AppTable<RoleMember>
              className={modalStyles.memberTable}
              columns={columns}
              dataSource={pagedMembers}
              locale={{ emptyText: muted }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 720 }}
              size="small"
            />
          ) : (
            <EmptyStatePanel title={t("systemAdmin.roles.membersModal.empty")} />
          )}
        </div>
        {filteredMembers.length ? (
          <TablePaginationBar
            current={page}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
            pageSize={pageSize}
            showSizeChanger
            showTotal={(total) => t("common.total", { total })}
            total={filteredMembers.length}
          />
        ) : null}
        <p className={modalStyles.note}>
          {t("systemAdmin.roles.membersModal.note", { id: role.id })}
        </p>
      </div>
    </Modal>
  );
}
