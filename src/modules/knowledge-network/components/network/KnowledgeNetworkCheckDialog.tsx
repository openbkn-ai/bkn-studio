/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Result, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { NetworkCheckTables } from "@/modules/knowledge-network/components/network/NetworkCheckTables";
import { checkKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { NetworkCheckResult } from "@/modules/knowledge-network/types/knowledge-network";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import styles from "./KnowledgeNetworkCheckDialog.module.css";

const PREFIX = "knowledgeNetwork.declarations.networkCheck";

type CheckState =
  | { status: "loading" }
  | { error: string; status: "failed" }
  | { check: NetworkCheckResult; status: "done" };

type KnowledgeNetworkCheckDialogProps = {
  network: { id: string; name: string };
  onClose: () => void;
};

/**
 * Runs the network check when it opens and lists the parameters to fix, each linked to its
 * definition. The check only reads definitions, so it can be run again at any time.
 */
export function KnowledgeNetworkCheckDialog({
  network,
  onClose,
}: KnowledgeNetworkCheckDialogProps) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CheckState>({ status: "loading" });

  useEffect(() => {
    let current = true;
    checkKnowledgeNetwork(network.id).then(
      (check) => {
        if (current) {
          setState({ check, status: "done" });
        }
      },
      (error: unknown) => {
        if (current) {
          setState({ error: extractRequestErrorMessage(error), status: "failed" });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [attempt, network.id]);

  const recheck = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  const clean =
    state.status === "done" &&
    !state.check.misplacedParameters.length &&
    !state.check.invalidParameters.length;

  return (
    <Modal
      destroyOnHidden
      footer={[
        <AppButton disabled={state.status === "loading"} key="recheck" onClick={recheck}>
          {t(`${PREFIX}.recheck`)}
        </AppButton>,
        <AppButton key="close" onClick={onClose} type="primary">
          {t(`${PREFIX}.close`)}
        </AppButton>,
      ]}
      onCancel={onClose}
      open
      rootClassName={`${modalStyles.businessModal} ${styles.dialog}`}
      title={t(`${PREFIX}.title`, { name: network.name })}
      width={820}
    >
      {state.status === "loading" ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : state.status === "failed" ? (
        <Alert
          description={state.error}
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="error"
        />
      ) : clean ? (
        <Result
          status="success"
          subTitle={t(`${PREFIX}.cleanDescription`)}
          title={t(`${PREFIX}.clean`)}
        />
      ) : (
        <>
          <Typography.Paragraph className={styles.description}>
            {t(`${PREFIX}.description`)}
          </Typography.Paragraph>
          <NetworkCheckTables check={state.check} networkId={network.id} />
        </>
      )}
    </Modal>
  );
}
