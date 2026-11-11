/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Tabs } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseDetailTabs.module.css";

export function EvalCaseDetailTabs({
  eligible,
  children,
  executionDetails,
  actions,
  notice,
  initialTab = "result",
  onTabChange,
  onRepair,
}: {
  networkId: string;
  runId: string;
  caseRunId: string;
  resultRevision: number;
  eligible: boolean;
  children: ReactNode | ((showExecution: () => void) => ReactNode);
  executionDetails: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
  initialTab?: "result" | "execution";
  onTabChange?: (key: string) => void;
  onRepair?: () => void | Promise<void>;
}) {
  const { t } = useEvalTranslation();
  const [active, setActive] = useState<string>(initialTab);
  const [startingRepair, setStartingRepair] = useState(false);
  const [repairError, setRepairError] = useState(false);
  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);
  const text = (key: string) => t(`knowledgeNetwork.eval.detailTabs.${key}`);
  const change = (key: string) => {
    setActive(key);
    onTabChange?.(key);
  };
  return (
    <>
      {notice}
      {repairError && (
        <Alert type="error" showIcon message={t("knowledgeNetwork.eval.repair.runEntryFailed")} />
      )}
      <Tabs
        className={styles.tabs}
        activeKey={active}
        onChange={change}
        destroyOnHidden={false}
        tabBarExtraContent={
          actions || (eligible && onRepair) ? (
            <div className={styles.actions}>
              {actions}
              {eligible && onRepair && (
                <Button
                  type="primary"
                  loading={startingRepair}
                  onClick={() => {
                    setStartingRepair(true);
                    setRepairError(false);
                    void Promise.resolve()
                      .then(onRepair)
                      .catch(() => setRepairError(true))
                      .finally(() => setStartingRepair(false));
                  }}
                >
                  {t("knowledgeNetwork.eval.resourceOverview.aiRepair")}
                </Button>
              )}
            </div>
          ) : undefined
        }
        items={[
          {
            key: "result",
            label: text("resultTab"),
            children:
              typeof children === "function" ? children(() => change("execution")) : children,
          },
          { key: "execution", label: text("executionTab"), children: executionDetails },
        ]}
      />
    </>
  );
}
