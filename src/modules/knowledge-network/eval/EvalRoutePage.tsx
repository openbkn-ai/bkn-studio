/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Spin } from "antd";

import { KnowledgeNetworkResourceConfigStandalonePage } from "@/modules/knowledge-network/pages/KnowledgeNetworkResourceConfigStandalonePage";
import { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network";
import { EvalWorkspaceScene } from "./EvalWorkspaceScene";
import { EVAL_TABS, type EvalTab } from "./types";
import { readCaseFilters, writeCaseFilters, type EvalCaseFilters } from "./eval-case-navigation";
import { writeRunDetail } from "./eval-run-navigation";
import { useEvalAccess } from "./useEvalAccess";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";

export function EvalRoutePage() {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const { status, retry } = useEvalAccess(networkId);
  const { t } = useEvalTranslation();
  const [search, setSearch] = useSearchParams();
  const activeTab = EVAL_TABS.find((tab) => tab === search.get("tab")) ?? "overview";
  const changeTab = (tab: EvalTab, filters?: Partial<EvalCaseFilters>) => {
    if (tab === activeTab && !filters) return;
    setSearch((current) => {
      const base = tab === "runs" ? current : writeRunDetail(current, {});
      const next = filters
        ? writeCaseFilters(base, { ...readCaseFilters(base.toString()), ...filters })
        : new URLSearchParams(base);
      if (tab === "overview") next.delete("tab");
      else next.set("tab", tab);
      return next;
    });
  };

  return (
    <KnowledgeNetworkResourceConfigStandalonePage>
      <div className={styles.routeHost}>
        <KnowledgeNetworkWorkspaceScene
          networkId={networkId}
          section="extension"
          evalAccessAllowed={status === "allowed"}
        >
          {status === "allowed" ? (
            <EvalWorkspaceScene
              key={networkId}
              networkId={networkId}
              activeTab={activeTab}
              onTabChange={changeTab}
            />
          ) : status === "loading" ? (
            <Spin tip={t("knowledgeNetwork.eval.access.loading")}>
              <div style={{ minHeight: 120 }} />
            </Spin>
          ) : (
            <Alert
              showIcon
              type={status === "denied" ? "warning" : "error"}
              message={t(`knowledgeNetwork.eval.access.${status}`)}
              action={<Button onClick={retry}>{t("knowledgeNetwork.eval.access.retry")}</Button>}
            />
          )}
        </KnowledgeNetworkWorkspaceScene>
      </div>
    </KnowledgeNetworkResourceConfigStandalonePage>
  );
}
