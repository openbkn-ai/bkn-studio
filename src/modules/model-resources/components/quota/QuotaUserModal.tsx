/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, InputNumber, Modal, Select, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ModelSeriesIcon } from "@/modules/model-resources/components/ModelSeriesIcon";
import {
  deleteUserQuotas,
  listUserQuotas,
  saveUserQuotas,
  searchAssignableUsers,
} from "@/modules/model-resources/services/quota.service";
import type { ModelQuota, UserQuotaRecord } from "@/modules/model-resources/types/quota";
import {
  formatQuotaTokenAmount,
  isQuotaConfigured,
  QUOTA_NUM_TYPE_OPTIONS,
} from "@/modules/model-resources/utils/quota-display";

import styles from "./QuotaUserModal.module.css";

type QuotaUserModalProps = {
  onClose: (refresh?: boolean) => void;
  open: boolean;
  record: ModelQuota | null;
};

type EditableUserQuota = UserQuotaRecord & {
  isNew?: boolean;
};

export function QuotaUserModal({ onClose, open, record }: QuotaUserModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [items, setItems] = useState<EditableUserQuota[]>([]);
  const [originalItems, setOriginalItems] = useState<EditableUserQuota[]>([]);
  const [inputRemain, setInputRemain] = useState(0);
  const [outputRemain, setOutputRemain] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>();

  const numTypeOptions = useMemo(
    () =>
      QUOTA_NUM_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const loadUsers = useCallback(async () => {
    const users = await searchAssignableUsers();
    const assignedIds = new Set(items.map((item) => item.userId));
    setUserOptions(
      users
        .filter((user) => !assignedIds.has(user.userId))
        .map((user) => ({ value: user.userId, label: user.userName })),
    );
  }, [items]);

  const loadData = useCallback(async () => {
    if (!record) {
      return;
    }

    setLoading(true);

    try {
      const result = await listUserQuotas(record.confId);
      setItems(result.items);
      setOriginalItems(result.items);
      setInputRemain(result.inputTokensRemain);
      setOutputRemain(result.outputTokensRemain);
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, record]);

  useEffect(() => {
    if (!open || !record) {
      return;
    }

    void loadData();
  }, [loadData, open, record]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadUsers();
  }, [loadUsers, open]);

  const updateItem = (userId: string, patch: Partial<EditableUserQuota>) => {
    setItems((current) =>
      current.map((item) => (item.userId === userId ? { ...item, ...patch } : item)),
    );
  };

  const handleAddUser = () => {
    if (!record || !selectedUserId) {
      return;
    }

    const option = userOptions.find((item) => item.value === selectedUserId);
    if (!option) {
      return;
    }

    if (items.some((item) => item.userId === selectedUserId)) {
      message.warning(t("modelResources.quotas.userModal.duplicateUser"));
      return;
    }

    setItems((current) => [
      ...current,
      {
        userId: selectedUserId,
        userName: option.label,
        modelQuotaId: record.confId,
        inputTokens: undefined,
        outputTokens: undefined,
        numType: record.numType,
        isNew: true,
      },
    ]);
    setSelectedUserId(undefined);
  };

  const handleRemove = (userId: string) => {
    setItems((current) => current.filter((item) => item.userId !== userId));
  };

  const handleSubmit = async () => {
    if (!record) {
      return;
    }

    const invalid = items.some(
      (item) =>
        item.inputTokens === undefined ||
        (record.billingType === 1 && item.outputTokens === undefined),
    );

    if (invalid) {
      message.warning(t("modelResources.quotas.userModal.quotaEmpty"));
      return;
    }

    const currentIds = new Set(items.map((item) => item.userId));
    const deleted = originalItems.filter((item) => !currentIds.has(item.userId));
    const saveItems = items.map((item) => ({
      userId: item.userId,
      userName: item.userName,
      modelQuotaId: record.confId,
      inputTokens: item.inputTokens ?? 0,
      outputTokens: record.billingType === 1 ? item.outputTokens ?? 0 : undefined,
      numType: item.numType,
    }));

    setSubmitting(true);

    try {
      if (deleted.length > 0) {
        const deleteIds = deleted
          .map((item) => item.userQuotaId)
          .filter((id): id is string => Boolean(id));

        if (deleteIds.length > 0) {
          await deleteUserQuotas(deleteIds);
        }
      }

      await saveUserQuotas(saveItems);
      message.success(t("modelResources.quotas.userModal.saveSuccess"));
      onClose(true);
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const isSeparateBilling = record?.billingType === 1;
  const monthLabel = t("modelResources.quotas.modal.perMonth");

  return (
    <Modal
      destroyOnHidden
      footer={null}
      maskClosable={false}
      onCancel={() => onClose(false)}
      open={open}
      title={t("modelResources.quotas.userModal.title")}
      width={920}
    >
      {record ? (
        <div className={styles.header}>
          <div className={styles.modelTitle}>
            <ModelSeriesIcon modelName={record.modelName} modelSeries={record.modelSeries} />
            <span className={styles.modelName}>{record.modelName}</span>
          </div>
          <div className={styles.modelMeta}>
            {t("modelResources.quotas.columns.model")}：{record.model}
          </div>
        </div>
      ) : null}

      {record && isQuotaConfigured(record) ? (
        <Alert
          className={styles.remainAlert}
          message={
            isSeparateBilling
              ? t("modelResources.quotas.userModal.remainSeparate", {
                  input: formatQuotaTokenAmount(inputRemain, record.numType[0], monthLabel),
                  output: formatQuotaTokenAmount(outputRemain, record.numType[1], monthLabel),
                })
              : t("modelResources.quotas.userModal.remainUnified", {
                  amount: formatQuotaTokenAmount(inputRemain, record.numType[0], monthLabel),
                })
          }
          type="info"
        />
      ) : null}

      <div className={styles.toolbar}>
        <Select
          allowClear
          options={userOptions}
          placeholder={t("modelResources.quotas.userModal.selectUser")}
          showSearch
          style={{ width: 280 }}
          value={selectedUserId}
          onChange={setSelectedUserId}
          onSearch={(value) => {
            void searchAssignableUsers(value).then((users) => {
              const assignedIds = new Set(items.map((item) => item.userId));
              setUserOptions(
                users
                  .filter((user) => !assignedIds.has(user.userId))
                  .map((user) => ({ value: user.userId, label: user.userName })),
              );
            });
          }}
        />
        <AppButton onClick={handleAddUser}>{t("modelResources.quotas.userModal.addUser")}</AppButton>
      </div>

      <Table<EditableUserQuota>
        columns={[
          {
            title: t("modelResources.quotas.userModal.userName"),
            dataIndex: "userName",
            width: 180,
          },
          {
            title: t("modelResources.quotas.userModal.inputQuota"),
            dataIndex: "inputTokens",
            width: 260,
            render: (_value, row) => (
              <div className={styles.fieldCell}>
                <InputNumber
                  controls={false}
                  min={0}
                  onChange={(value) =>
                    updateItem(row.userId, {
                      inputTokens: typeof value === "number" ? value : undefined,
                    })
                  }
                  value={row.inputTokens}
                />
                <Select
                  options={numTypeOptions}
                  style={{ width: 88 }}
                  value={row.numType[0] === 3 ? 6 : row.numType[0]}
                  onChange={(value) =>
                    updateItem(row.userId, {
                      numType: [value === 6 ? 3 : value, row.numType[1] ?? 1],
                    })
                  }
                />
                <span>{monthLabel}</span>
              </div>
            ),
          },
          ...(isSeparateBilling
            ? [
                {
                  title: t("modelResources.quotas.userModal.outputQuota"),
                  dataIndex: "outputTokens",
                  width: 260,
                  render: (_value: number | undefined, row: EditableUserQuota) => (
                    <div className={styles.fieldCell}>
                      <InputNumber
                        controls={false}
                        min={0}
                        onChange={(value) =>
                          updateItem(row.userId, {
                            outputTokens: typeof value === "number" ? value : undefined,
                          })
                        }
                        value={row.outputTokens}
                      />
                      <Select
                        options={numTypeOptions}
                        style={{ width: 88 }}
                        value={row.numType[1] === 3 ? 6 : row.numType[1]}
                        onChange={(value) =>
                          updateItem(row.userId, {
                            numType: [row.numType[0], value === 6 ? 3 : value],
                          })
                        }
                      />
                      <span>{monthLabel}</span>
                    </div>
                  ),
                },
              ]
            : []),
          {
            title: t("modelResources.quotas.columns.operate"),
            dataIndex: "actions",
            width: 96,
            render: (_value, row) => (
              <AppButton danger type="link" onClick={() => handleRemove(row.userId)}>
                {t("common.delete")}
              </AppButton>
            ),
          },
        ]}
        dataSource={items}
        loading={loading}
        pagination={false}
        rowKey="userId"
        size="small"
      />

      <div className={styles.footer}>
        <AppButton onClick={() => onClose(false)}>{t("common.cancel")}</AppButton>
        <AppButton loading={submitting} type="primary" onClick={() => void handleSubmit()}>
          {t("common.save")}
        </AppButton>
      </div>
    </Modal>
  );
}
