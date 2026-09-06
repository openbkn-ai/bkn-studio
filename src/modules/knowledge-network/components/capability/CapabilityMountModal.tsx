/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Input, Modal, Select, Table, Tag } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listSkills } from "@/modules/execution-factory/services/skill.service";
import { listTools } from "@/modules/execution-factory/services/tool.service";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolRecord } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type {
  AttachCapabilityInput,
  CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./CapabilityMountModal.module.css";

/** The execution factory rejects a page_size above 100 (`validate:"min=1,max=100"`). */
const PICKER_PAGE_SIZE = 100;

/** Guards against walking a pathological catalogue; the search box narrows anything beyond it. */
const PICKER_MAX_PAGES = 5;

/**
 * The picker needs one flat list to filter and check against, so it walks the pages itself rather
 * than paginating in the UI: a mounted-elsewhere tool sitting on page 3 must still show as mounted.
 */
async function collectPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const items = [...first.items];
  const pages = Math.min(
    Math.ceil(first.total / PICKER_PAGE_SIZE),
    PICKER_MAX_PAGES,
  );

  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page);
    items.push(...next.items);
  }

  return items;
}

type CapabilityMountModalProps = {
  capabilityType: CapabilityType;
  /** Skill ids, or "{boxId}/{toolId}" for functions, already bound to this network. */
  mountedRefs: Set<string>;
  onCancel: () => void;
  onSubmit: (inputs: AttachCapabilityInput[]) => Promise<void>;
  open: boolean;
};

export function CapabilityMountModal({
  capabilityType,
  mountedRefs,
  onCancel,
  onSubmit,
  open,
}: CapabilityMountModalProps) {
  const { t } = useTranslation();
  const isSkill = capabilityType === "skill";
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [boxes, setBoxes] = useState<ToolboxRecord[]>([]);
  const [boxId, setBoxId] = useState<string>("");
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [wholeBox, setWholeBox] = useState(false);

  const resetSelection = useCallback(() => {
    setSelectedKeys([]);
    setWholeBox(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setKeyword("");
    setError(null);
    resetSelection();

    void (async () => {
      setLoading(true);
      try {
        if (isSkill) {
          // Only a published skill can be mounted; the backend rejects the rest anyway.
          const items = await collectPages((page) =>
            listSkills({ page, pageSize: PICKER_PAGE_SIZE, status: "published" }),
          );
          setSkills(items);
        } else {
          const items = await collectPages((page) =>
            listToolboxes({ page, pageSize: PICKER_PAGE_SIZE }),
          );
          setBoxes(items);
          setBoxId(items[0]?.boxId ?? "");
        }
      } catch (requestError) {
        setError(extractRequestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [isSkill, open, resetSelection]);

  useEffect(() => {
    if (!open || isSkill || !boxId) {
      setTools([]);
      return;
    }

    void (async () => {
      setLoading(true);
      resetSelection();
      try {
        const items = await collectPages((page) =>
          listTools(boxId, { page, pageSize: PICKER_PAGE_SIZE }),
        );
        setTools(items);
      } catch (requestError) {
        setTools([]);
        setError(extractRequestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, isSkill, open, resetSelection]);

  const skillRows = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    return skills.filter(
      (item) =>
        !trimmed ||
        item.name.toLowerCase().includes(trimmed) ||
        item.skillId.toLowerCase().includes(trimmed),
    );
  }, [keyword, skills]);

  const toolRows = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    return tools.filter(
      (item) =>
        !trimmed ||
        item.name.toLowerCase().includes(trimmed) ||
        item.toolId.toLowerCase().includes(trimmed),
    );
  }, [keyword, tools]);

  const isMounted = useCallback(
    (id: string) => mountedRefs.has(isSkill ? id : `${boxId}/${id}`),
    [boxId, isSkill, mountedRefs],
  );

  const skillColumns: TableProps<SkillRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.capabilityColumnName"),
      render: (value: string, record) => (
        <div>
          <div>{value || record.skillId}</div>
          <div className={styles.pickerHint}>{record.skillId}</div>
        </div>
      ),
    },
    {
      dataIndex: "description",
      key: "description",
      title: t("common.description"),
      render: (value?: string) => value || "-",
    },
    {
      key: "mounted",
      title: "",
      width: 96,
      render: (_: unknown, record) =>
        isMounted(record.skillId) ? (
          <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
        ) : null,
    },
  ];

  const toolColumns: TableProps<ToolRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.capabilityColumnName"),
      render: (value: string, record) => (
        <div>
          <div>{value || record.toolId}</div>
          <div className={styles.pickerHint}>{record.toolId}</div>
        </div>
      ),
    },
    {
      dataIndex: "description",
      key: "description",
      title: t("common.description"),
      render: (value?: string) => value || "-",
    },
    {
      dataIndex: "status",
      key: "status",
      title: t("knowledgeNetwork.capabilityColumnStatus"),
      width: 120,
      render: (value: string, record) =>
        isMounted(record.toolId) ? (
          <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
        ) : (
          <span>{value}</span>
        ),
    },
  ];

  const buildInputs = (): AttachCapabilityInput[] => {
    if (!isSkill && wholeBox) {
      return [{ allTools: true, boxId, capabilityType: "function" }];
    }

    return selectedKeys.map((id) =>
      isSkill
        ? { capabilityId: id, capabilityType: "skill" as const }
        : { boxId, capabilityId: id, capabilityType: "function" as const },
    );
  };

  const confirmDisabled = !isSkill && wholeBox ? !boxId : selectedKeys.length === 0;

  return (
    <Modal
      confirmLoading={submitting}
      footer={[
        <span className={styles.pickerFooterInfo} key="info">
          {t("knowledgeNetwork.capabilityPickerSelected", {
            count: !isSkill && wholeBox ? toolRows.length : selectedKeys.length,
          })}
        </span>,
        <AppButton key="cancel" onClick={onCancel}>
          {t("common.cancel")}
        </AppButton>,
        <AppButton
          disabled={confirmDisabled}
          key="confirm"
          loading={submitting}
          onClick={() => {
            void (async () => {
              setSubmitting(true);
              setError(null);
              try {
                await onSubmit(buildInputs());
              } catch (requestError) {
                setError(extractRequestErrorMessage(requestError));
              } finally {
                setSubmitting(false);
              }
            })();
          }}
          type="primary"
        >
          {t("knowledgeNetwork.capabilityPickerConfirm")}
        </AppButton>,
      ]}
      onCancel={onCancel}
      open={open}
      title={
        isSkill
          ? t("knowledgeNetwork.capabilityPickerSkillTitle")
          : t("knowledgeNetwork.capabilityPickerFunctionTitle")
      }
      width={880}
    >
      <div className={styles.picker}>
        {error ? <Alert message={error} showIcon type="error" /> : null}

        <div className={styles.pickerToolbar}>
          {isSkill ? null : (
            <Select
              className={styles.pickerBoxSelect}
              onChange={(value: string) => setBoxId(value)}
              optionFilterProp="label"
              options={boxes.map((item) => ({ label: item.name, value: item.boxId }))}
              showSearch
              value={boxId || undefined}
            />
          )}
          <Input
            allowClear
            className={styles.pickerSearch}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetwork.capabilityPickerSearchPlaceholder")}
            value={keyword}
          />
          {isSkill ? null : (
            <Checkbox
              checked={wholeBox}
              className={styles.pickerWholeBox}
              disabled={!boxId}
              onChange={(event) => {
                setWholeBox(event.target.checked);
                if (event.target.checked) {
                  setSelectedKeys([]);
                }
              }}
            >
              {t("knowledgeNetwork.capabilityPickerSelectWholeBox")}
            </Checkbox>
          )}
        </div>

        {!isSkill && wholeBox ? (
          <Alert
            message={t("knowledgeNetwork.capabilityPickerWholeBoxHint")}
            showIcon
            type="info"
          />
        ) : null}

        {isSkill ? (
          <Table
            columns={skillColumns}
            dataSource={skillRows}
            loading={loading}
            locale={{ emptyText: t("knowledgeNetwork.capabilityPickerEmptySkills") }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            rowKey="skillId"
            rowSelection={{
              getCheckboxProps: (record) => ({ disabled: isMounted(record.skillId) }),
              onChange: (keys) => setSelectedKeys(keys as string[]),
              selectedRowKeys: selectedKeys,
            }}
            size="small"
          />
        ) : (
          <Table
            columns={toolColumns}
            dataSource={toolRows}
            loading={loading}
            locale={{ emptyText: t("knowledgeNetwork.capabilityPickerEmptyFunctions") }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            rowKey="toolId"
            rowSelection={
              wholeBox
                ? undefined
                : {
                    getCheckboxProps: (record) => ({ disabled: isMounted(record.toolId) }),
                    onChange: (keys) => setSelectedKeys(keys as string[]),
                    selectedRowKeys: selectedKeys,
                  }
            }
            size="small"
          />
        )}
      </div>
    </Modal>
  );
}
