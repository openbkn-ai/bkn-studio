/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import type { ActionTypeOperationKind } from "@/modules/knowledge-network/types/action-type";

import styles from "./ActionTypeCreateEntryModal.module.css";

type ActionTypeCreateEntryModalProps = {
  onCancel: () => void;
  onChoose: (kind: ActionTypeOperationKind) => void;
  open: boolean;
};

export function ActionTypeCreateEntryModal({
  onCancel,
  onChoose,
  open,
}: ActionTypeCreateEntryModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      destroyOnHidden
      footer={null}
      onCancel={onCancel}
      open={open}
      title={t("knowledgeNetwork.actionTypeCreateEntryTitle")}
      width={820}
    >
      <div className={styles.choices}>
        <button className={styles.choice} onClick={() => onChoose("object")} type="button">
          <span className={styles.icon}>
            <ApartmentOutlined />
          </span>
          <strong>{t("knowledgeNetwork.actionOperationObjectEntry")}</strong>
          <span>{t("knowledgeNetwork.actionOperationObjectDescription")}</span>
          <span className={styles.examples}>
            {t("knowledgeNetwork.actionOperationObjectExamples")}
          </span>
          <span className={styles.choiceAction}>
            {t("knowledgeNetwork.actionTypeCreateEntryContinue")}
          </span>
        </button>
        <button className={styles.choice} onClick={() => onChoose("tool")} type="button">
          <span className={styles.choiceTop}>
            <span className={styles.icon}>
              <ThunderboltOutlined />
            </span>
          </span>
          <strong>{t("knowledgeNetwork.actionOperationTool")}</strong>
          <span>{t("knowledgeNetwork.actionOperationToolDescription")}</span>
          <span className={styles.examples}>
            {t("knowledgeNetwork.actionOperationToolExamples")}
          </span>
          <span className={styles.choiceAction}>
            {t("knowledgeNetwork.actionTypeCreateEntryContinue")}
          </span>
        </button>
      </div>
    </Modal>
  );
}
