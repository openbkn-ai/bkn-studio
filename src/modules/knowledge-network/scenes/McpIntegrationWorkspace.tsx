/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { Select } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";
import { listKnowledgeNetworks } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./McpIntegrationWorkspace.module.css";

type McpWorkspaceView = "connect" | "debug";

const NETWORK_PAGE_SIZE = 200;

function mcpWorkspaceViewOf(value: string | null): McpWorkspaceView {
  return value === "debug" ? "debug" : "connect";
}

async function listAllKnowledgeNetworks() {
  const records: KnowledgeNetworkRecord[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await listKnowledgeNetworks({
      direction: "asc",
      keyword: "",
      page,
      pageSize: NETWORK_PAGE_SIZE,
      sortBy: "name",
    });
    records.push(...result.items);
    total = result.total;
    page += 1;

    if (result.items.length === 0) {
      break;
    }
  } while (records.length < total);

  return records;
}

export function McpIntegrationWorkspace() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = mcpWorkspaceViewOf(searchParams.get("mcpView"));
  const selectedNetworkId = searchParams.get("networkId") ?? "";
  const [networks, setNetworks] = useState<KnowledgeNetworkRecord[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksError, setNetworksError] = useState(false);
  const [reloadSequence, setReloadSequence] = useState(0);

  useEffect(() => {
    if (view !== "debug") {
      return undefined;
    }

    let cancelled = false;
    setNetworksLoading(true);
    setNetworksError(false);

    void listAllKnowledgeNetworks()
      .then((records) => {
        if (!cancelled) {
          setNetworks(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNetworks([]);
          setNetworksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNetworksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadSequence, view]);

  const selectedNetwork = useMemo(
    () => networks.find((network) => network.id === selectedNetworkId) ?? null,
    [networks, selectedNetworkId],
  );
  const networkOptions = useMemo(
    () =>
      networks.map((network) => ({
        label: `${network.name} (${network.identifier})`,
        value: network.id,
      })),
    [networks],
  );

  const updateView = useCallback(
    (nextView: McpWorkspaceView) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "mcp");
      next.set("mcpView", nextView);
      if (nextView === "connect") {
        next.delete("networkId");
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const updateNetwork = useCallback(
    (networkId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "mcp");
      next.set("mcpView", "debug");
      if (networkId) {
        next.set("networkId", networkId);
      } else {
        next.delete("networkId");
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const selectedNetworkUnavailable =
    !networksLoading && !networksError && selectedNetworkId !== "" && selectedNetwork === null;

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

        {view === "debug" ? (
          <div className={styles.networkPicker}>
            <label htmlFor="mcp-debug-network">
              {t("knowledgeNetwork.integration.mcpWorkspace.networkLabel")}
            </label>
            <Select
              id="mcp-debug-network"
              className={styles.networkSelect}
              value={selectedNetwork?.id}
              disabled={networksLoading || networksError}
              loading={networksLoading}
              options={networkOptions}
              placeholder={
                networksLoading
                  ? t("knowledgeNetwork.integration.mcpWorkspace.networkLoading")
                  : t("knowledgeNetwork.integration.mcpWorkspace.networkPlaceholder")
              }
              aria-label={t("knowledgeNetwork.integration.mcpWorkspace.networkLabel")}
              allowClear
              showSearch
              optionFilterProp="label"
              notFoundContent={t("knowledgeNetwork.integration.mcpWorkspace.networkNoMatch")}
              onChange={(networkId) => updateNetwork(networkId || "")}
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
            {networksError ? (
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => setReloadSequence((value) => value + 1)}
              >
                <ReloadOutlined /> {t("knowledgeNetwork.integration.mcpWorkspace.retry")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        {view === "connect" ? (
          <ExperienceScene embedded initialMode="mcp" lockMode showMcpConnect />
        ) : networksError ? (
          <div className={styles.emptyState} role="alert">
            <h2>{t("knowledgeNetwork.integration.mcpWorkspace.loadFailedTitle")}</h2>
            <p>{t("knowledgeNetwork.integration.mcpWorkspace.loadFailedDescription")}</p>
          </div>
        ) : networksLoading ? (
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
          <div className={styles.emptyState} role="status">
            <h2>
              {selectedNetworkUnavailable
                ? t("knowledgeNetwork.integration.mcpWorkspace.networkUnavailableTitle")
                : networks.length === 0
                  ? t("knowledgeNetwork.integration.mcpWorkspace.noNetworksTitle")
                  : t("knowledgeNetwork.integration.mcpWorkspace.selectNetworkTitle")}
            </h2>
            <p>
              {selectedNetworkUnavailable
                ? t("knowledgeNetwork.integration.mcpWorkspace.networkUnavailableDescription")
                : networks.length === 0
                  ? t("knowledgeNetwork.integration.mcpWorkspace.noNetworksDescription")
                  : t("knowledgeNetwork.integration.mcpWorkspace.selectNetworkDescription")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
