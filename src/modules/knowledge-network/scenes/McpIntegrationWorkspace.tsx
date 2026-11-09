/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";
import { NetworkPickerGuide } from "@/modules/knowledge-network/scenes/NetworkPickerGuide";
import { NetworkSelect } from "@/modules/knowledge-network/scenes/NetworkSelect";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./McpIntegrationWorkspace.module.css";

type McpWorkspaceView = "connect" | "debug";

/** The check of the network named in the URL. */
type NetworkCheck =
  | { id: string; status: "loading" }
  | { id: string; status: "ready"; network: KnowledgeNetworkRecord }
  | { id: string; status: "unavailable" }
  | { id: string; status: "error" };

function mcpWorkspaceViewOf(value: string | null): McpWorkspaceView {
  return value === "debug" ? "debug" : "connect";
}

/** A network that is gone or not visible to this account, as opposed to a failed request. */
function isUnavailable(error: unknown) {
  return axios.isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
}

export function McpIntegrationWorkspace() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = mcpWorkspaceViewOf(searchParams.get("mcpView"));
  const selectedNetworkId = searchParams.get("networkId") ?? "";
  const [check, setCheck] = useState<NetworkCheck | null>(null);
  const [reloadSequence, setReloadSequence] = useState(0);

  // Only the network named in the URL is fetched; pickers load the list lazily themselves.
  // A network just picked arrives with its record, so it needs no fetch.
  const checkedId = check?.status === "ready" ? check.id : "";
  useEffect(() => {
    if (view !== "debug" || !selectedNetworkId || checkedId === selectedNetworkId) {
      return undefined;
    }

    let cancelled = false;
    setCheck({ id: selectedNetworkId, status: "loading" });
    getKnowledgeNetwork(selectedNetworkId, { skipErrorToast: true })
      .then((network) => {
        if (cancelled) return;
        setCheck(
          network
            ? { id: selectedNetworkId, status: "ready", network }
            : { id: selectedNetworkId, status: "unavailable" },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCheck({ id: selectedNetworkId, status: isUnavailable(error) ? "unavailable" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [view, selectedNetworkId, checkedId, reloadSequence]);

  // Until the check for this id has finished, treat it as loading.
  const current: NetworkCheck | null = !selectedNetworkId
    ? null
    : check?.id === selectedNetworkId
      ? check
      : { id: selectedNetworkId, status: "loading" };
  const selectedNetwork = current?.status === "ready" ? current.network : null;

  const updateView = useCallback(
    (nextView: McpWorkspaceView) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "mcp");
      next.set("mcpView", nextView);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const updateNetwork = useCallback(
    (network: KnowledgeNetworkRecord | null) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "mcp");
      next.set("mcpView", "debug");
      if (network) {
        setCheck({ id: network.id, status: "ready", network });
        next.set("networkId", network.id);
      } else {
        next.delete("networkId");
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const selectedNetworkUnavailable = current?.status === "unavailable";

  const networkPickerGuide = (
    <NetworkPickerGuide
      guideTitle={t("knowledgeNetwork.integration.mcpWorkspace.guide.heading")}
      guideDescription={t("knowledgeNetwork.integration.mcpWorkspace.guide.description")}
      steps={[
        t("knowledgeNetwork.integration.mcpWorkspace.guide.steps.pick"),
        t("knowledgeNetwork.integration.mcpWorkspace.guide.steps.tool"),
        t("knowledgeNetwork.integration.mcpWorkspace.guide.steps.run"),
      ]}
      eyebrow={t("knowledgeNetwork.integration.mcpWorkspace.guide.eyebrow")}
      title={t("knowledgeNetwork.integration.mcpWorkspace.guide.title")}
      actionLabel={t("knowledgeNetwork.integration.mcpWorkspace.guide.open")}
      notice={
        selectedNetworkUnavailable
          ? t("knowledgeNetwork.integration.mcpWorkspace.networkUnavailableDescription")
          : undefined
      }
      onOpen={updateNetwork}
    />
  );

  return (
    <section className={styles.workspace}>
      <div className={styles.viewBar}>
        <div
          className={styles.viewTabs}
          role="tablist"
          aria-label={t("knowledgeNetwork.integration.mcpWorkspace.tabsAriaLabel")}
        >
          {(["connect", "debug"] as McpWorkspaceView[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              className={`${styles.viewTab} ${view === item ? styles.viewTabActive : ""}`}
              onClick={() => updateView(item)}
            >
              {t(`knowledgeNetwork.integration.mcpWorkspace.tabs.${item}`)}
            </button>
          ))}
        </div>

        {view === "debug" && selectedNetwork ? (
          <div className={styles.networkPicker}>
            <span>{t("knowledgeNetwork.integration.mcpWorkspace.networkLabel")}</span>
            <NetworkSelect
              className={styles.networkSelect}
              value={selectedNetwork}
              onChange={updateNetwork}
              ariaLabel={t("knowledgeNetwork.integration.mcpWorkspace.networkLabel")}
              allowClear
            />
            {selectedNetwork ? (
              <Link
                className={styles.openNetworkLink}
                to={`/knowledge-network/workspace/${selectedNetwork.id}/overview`}
                target="_blank"
                rel="noreferrer"
              >
                {t("knowledgeNetwork.integration.mcpWorkspace.openNetwork")}
                <ArrowRightOutlined />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        {view === "connect" ? (
          <ExperienceScene embedded initialMode="mcp" lockMode showMcpConnect />
        ) : !selectedNetworkId ? (
          networkPickerGuide
        ) : current?.status === "error" ? (
          <div className={styles.emptyState} role="alert">
            <h2>{t("knowledgeNetwork.integration.mcpWorkspace.loadFailedTitle")}</h2>
            <p>{t("knowledgeNetwork.integration.mcpWorkspace.loadFailedDescription")}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setReloadSequence((value) => value + 1)}
            >
              <ReloadOutlined /> {t("knowledgeNetwork.integration.mcpWorkspace.retry")}
            </button>
          </div>
        ) : current?.status === "loading" ? (
          <div className={styles.emptyState} aria-busy="true">
            <p>{t("knowledgeNetwork.integration.mcpWorkspace.networkLoading")}</p>
          </div>
        ) : selectedNetwork ? (
          <ExperienceScene
            key={selectedNetwork.id}
            embedded
            initialMode="mcp"
            lockMode
            networkId={selectedNetwork.id}
            network={{
              id: selectedNetwork.id,
              name: selectedNetwork.name,
              slug: selectedNetwork.identifier,
            }}
          />
        ) : (
          networkPickerGuide
        )}
      </div>
    </section>
  );
}
