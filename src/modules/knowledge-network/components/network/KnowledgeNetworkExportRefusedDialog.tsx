/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { NetworkCheckTables } from "@/modules/knowledge-network/components/network/NetworkCheckTables";
import type { KnowledgeNetworkExportRefusal } from "@/modules/knowledge-network/services/knowledge-network.service";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import styles from "./KnowledgeNetworkExportRefusedDialog.module.css";

type KnowledgeNetworkExportRefusedDialogProps = {
  exporting: boolean;
  networkId: string;
  onCancel: () => void;
  onExportV2: () => void;
  refusal: KnowledgeNetworkExportRefusal;
};

/**
 * Explains why a BKN spec 3.0 export was refused and offers a 2.x export instead. Studio never
 * falls back to 2.x by itself: a 2.x package leaves the network's 3.0 declarations out.
 */
export function KnowledgeNetworkExportRefusedDialog({
  exporting,
  networkId,
  onCancel,
  onExportV2,
  refusal,
}: KnowledgeNetworkExportRefusedDialogProps) {
  const { t } = useTranslation();
  const isCheck = refusal.kind === "network_check";

  return (
    <Modal
      destroyOnHidden
      footer={[
        <AppButton disabled={exporting} key="cancel" onClick={onCancel}>
          {t("common.cancel")}
        </AppButton>,
        <AppButton key="export-v2" loading={exporting} onClick={onExportV2} type="primary">
          {t("knowledgeNetwork.declarations.exportRefused.exportV2")}
        </AppButton>,
      ]}
      maskClosable={!exporting}
      onCancel={exporting ? undefined : onCancel}
      open
      rootClassName={`${modalStyles.businessModal} ${styles.dialog}`}
      title={t(
        isCheck
          ? "knowledgeNetwork.declarations.exportRefused.checkTitle"
          : "knowledgeNetwork.declarations.exportRefused.notReadableTitle",
      )}
      width={820}
    >
      <Typography.Paragraph className={styles.description}>
        {t(
          isCheck
            ? "knowledgeNetwork.declarations.exportRefused.checkDescription"
            : "knowledgeNetwork.declarations.exportRefused.notReadableDescription",
        )}
      </Typography.Paragraph>

      {refusal.kind === "network_check" ? (
        <NetworkCheckTables check={refusal.check} networkId={networkId} />
      ) : refusal.reason ? (
        <pre className={styles.reason}>{refusal.reason}</pre>
      ) : null}
    </Modal>
  );
}
