/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Select, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { Citing } from "@/modules/bkn-project/components/requirements/citing";
import {
  DOC_TYPES,
  docTypeText,
  requirementErrorText,
  uploadRefusalText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  deleteDocument,
  DOCUMENT_LIMITS,
  setDocumentType,
  uploadDocuments,
} from "@/modules/bkn-project/services/requirements.service";
import type { RequirementDocument, UploadResult } from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements.documents";

/**
 * The requirement documents the specification is drafted from. The owner uploads, types and
 * removes them; a document's type decides which side prevails when documents conflict.
 */
export function RequirementDocuments({
  canEdit,
  documents,
  onChanged,
  projectId,
}: {
  canEdit: boolean;
  documents: RequirementDocument[];
  onChanged: () => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const { openDocument } = useContext(Citing);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const changeType = async (document: RequirementDocument, docType: string) => {
    setBusyId(document.id);
    try {
      await setDocumentType(projectId, document.id, docType);
      onChanged();
    } catch (error) {
      message.error(requirementErrorText(t, projectErrorCode(error)));
    } finally {
      setBusyId(null);
    }
  };

  const remove = (document: RequirementDocument) => {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.removeConfirm`),
      okButtonProps: { danger: true },
      okText: t(`${PREFIX}.remove`),
      onOk: async () => {
        try {
          await deleteDocument(projectId, document.id);
          onChanged();
        } catch (error) {
          message.error(requirementErrorText(t, projectErrorCode(error)));
        }
      },
      title: t(`${PREFIX}.removeTitle`, { name: document.name }),
    });
  };

  const columns: ColumnsType<RequirementDocument> = [
    {
      dataIndex: "name",
      key: "name",
      render: (name: string, document) => (
        <AppButton onClick={() => openDocument(document.id)} size="small" type="link">
          {name}
        </AppButton>
      ),
      title: t(`${PREFIX}.columns.name`),
    },
    {
      dataIndex: "docType",
      key: "type",
      render: (docType: string, document) =>
        canEdit ? (
          <Select
            aria-label={t(`${PREFIX}.typeOf`, { name: document.name })}
            disabled={busyId === document.id}
            onChange={(value) => void changeType(document, value)}
            options={DOC_TYPES.map((value) => ({ label: docTypeText(t, value), value }))}
            size="small"
            value={docType}
          />
        ) : (
          docTypeText(t, docType)
        ),
      title: t(`${PREFIX}.columns.type`),
    },
    {
      dataIndex: "size",
      key: "size",
      render: (size: number) => t(`${PREFIX}.size`, { size: Math.max(1, Math.round(size / 1024)) }),
      title: t(`${PREFIX}.columns.size`),
    },
    {
      dataIndex: "createTime",
      key: "time",
      render: (time: number) => dayjs(time).format("YYYY/MM/DD HH:mm"),
      title: t(`${PREFIX}.columns.time`),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            render: (_: unknown, document: RequirementDocument) => (
              <AppButton danger onClick={() => remove(document)} size="small" type="link">
                {t(`${PREFIX}.remove`)}
              </AppButton>
            ),
            title: t(`${PREFIX}.columns.actions`),
          },
        ]
      : []),
  ];

  return (
    <section className={styles.card}>
      <div className={styles.row}>
        <h3 className={styles.cardTitle}>{t(`${PREFIX}.title`)}</h3>
        <span className={styles.spacer} />
        {canEdit ? (
          <AppButton onClick={() => setUploading(true)} type="primary">
            {t(`${PREFIX}.upload`)}
          </AppButton>
        ) : null}
      </div>
      <p className={styles.muted}>{t(`${PREFIX}.description`)}</p>
      {documents.length ? (
        <AppTable<RequirementDocument>
          columns={columns}
          dataSource={documents}
          pagination={false}
          rowKey="id"
          size="small"
        />
      ) : (
        <p className={styles.muted}>{t(`${PREFIX}.none`)}</p>
      )}
      {uploading ? (
        <UploadDialog
          onClose={(changed) => {
            setUploading(false);
            if (changed) {
              onChanged();
            }
          }}
          projectId={projectId}
        />
      ) : null}
    </section>
  );
}

/** Picks files, uploads them, then says how each went. */
function UploadDialog({
  onClose,
  projectId,
}: {
  onClose: (changed: boolean) => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  const send = async () => {
    setSending(true);
    try {
      setResults(await uploadDocuments(projectId, files));
    } catch (error) {
      message.error(requirementErrorText(t, projectErrorCode(error)));
    } finally {
      setSending(false);
    }
  };

  const created = results?.some((result) => result.outcome === "created") ?? false;
  return (
    <Modal
      cancelButtonProps={{ hidden: results !== null }}
      cancelText={t("common.cancel")}
      confirmLoading={sending}
      destroyOnHidden
      okButtonProps={{ disabled: results === null && !files.length }}
      okText={results ? t(`${PREFIX}.done`) : t(`${PREFIX}.uploadSelected`)}
      onCancel={() => onClose(created)}
      onOk={() => (results ? onClose(created) : void send())}
      open
      title={t(`${PREFIX}.uploadTitle`)}
    >
      {results ? (
        <ul className={styles.list}>
          {results.map((result) => (
            <li className={styles.row} key={result.name}>
              <span>{result.name}</span>
              <span className={result.outcome === "rejected" ? styles.warning : styles.muted}>
                {result.outcome === "rejected"
                  ? uploadRefusalText(t, result.code)
                  : t(
                      `${PREFIX}.outcome.${result.outcome === "duplicate" ? "duplicate" : "created"}`,
                    )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.stack}>
          <Upload.Dragger
            accept={DOCUMENT_LIMITS.extensions.join(",")}
            beforeUpload={(file) => {
              setFiles((current) => [...current, file]);
              return false;
            }}
            fileList={files.map((file) => ({ name: file.name, uid: `${file.name}-${file.size}` }))}
            multiple
            onRemove={(removed) =>
              setFiles((current) => current.filter((file) => file.name !== removed.name))
            }
          >
            <p>{t(`${PREFIX}.drop`)}</p>
          </Upload.Dragger>
          <Alert message={t(`${PREFIX}.limits`)} showIcon type="info" />
        </div>
      )}
    </Modal>
  );
}
