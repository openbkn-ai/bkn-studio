/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { listKnowledgeNetworks } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkIntegrationPage.module.css";

const NETWORK_PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

type NetworkList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: KnowledgeNetworkRecord[]; total: number };

/**
 * The SDK tab. SDK examples are generated from a network's own structure on its App development
 * page, so this tab only lists the networks and links to that page.
 */
export function SdkAppDevelopmentPanel() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSequence, setReloadSequence] = useState(0);
  const [list, setList] = useState<NetworkList>({ status: "loading" });

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(keyword.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    setList({ status: "loading" });
    listKnowledgeNetworks({
      direction: "asc",
      keyword: query,
      page: 1,
      pageSize: NETWORK_PAGE_SIZE,
      sortBy: "name",
    })
      .then((result) => {
        if (!cancelled) setList({ status: "ready", items: result.items, total: result.total });
      })
      .catch(() => {
        if (!cancelled) setList({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadSequence]);

  return (
    <section className={styles.sdkPage}>
      <aside className={styles.sdkGuide}>
        <h2 className={styles.sdkTitle}>{t("knowledgeNetwork.integration.sdk.guideTitle")}</h2>
        <p className={styles.sdkDescription}>
          {t("knowledgeNetwork.integration.sdk.guideDescription")}
        </p>
        <ol className={styles.sdkSteps}>
          <li>{t("knowledgeNetwork.integration.sdk.steps.pick")}</li>
          <li>{t("knowledgeNetwork.integration.sdk.steps.start")}</li>
          <li>{t("knowledgeNetwork.integration.sdk.steps.examples")}</li>
        </ol>
      </aside>

      <div className={styles.sdkContent}>
        <div className={styles.sdkContentHeader}>
          <div>
            <span className={styles.sdkEyebrow}>
              {t("knowledgeNetwork.integration.sdk.eyebrow")}
            </span>
            <h2 className={styles.sdkContentTitle}>
              {t("knowledgeNetwork.integration.sdk.title")}
            </h2>
          </div>
        </div>

        <Input
          className={styles.sdkNetworkSearch}
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          placeholder={t("knowledgeNetwork.integration.sdk.searchPlaceholder")}
          aria-label={t("knowledgeNetwork.integration.sdk.searchPlaceholder")}
          onChange={(event) => setKeyword(event.target.value)}
        />

        {list.status === "loading" ? (
          <p className={styles.sdkNetworkNote} aria-busy="true">
            {t("knowledgeNetwork.integration.sdk.loading")}
          </p>
        ) : list.status === "error" ? (
          <p className={styles.sdkNetworkNote} role="alert">
            {t("knowledgeNetwork.integration.sdk.loadFailed")}{" "}
            <button
              type="button"
              className={styles.sdkRetryButton}
              onClick={() => setReloadSequence((value) => value + 1)}
            >
              <ReloadOutlined /> {t("knowledgeNetwork.integration.sdk.retry")}
            </button>
          </p>
        ) : list.items.length === 0 ? (
          <p className={styles.sdkNetworkNote}>
            {query
              ? t("knowledgeNetwork.integration.sdk.noMatch")
              : t("knowledgeNetwork.integration.sdk.noNetworks")}
          </p>
        ) : (
          <>
            <ul className={styles.sdkNetworkList}>
              {list.items.map((network) => (
                <li key={network.id}>
                  <Link
                    className={styles.sdkNetworkLink}
                    to={`/knowledge-network/workspace/${network.id}/develop`}
                  >
                    <span className={styles.sdkNetworkName}>{network.name}</span>
                    <span className={styles.sdkNetworkIdentifier}>{network.identifier}</span>
                    <ArrowRightOutlined className={styles.sdkNetworkArrow} />
                  </Link>
                </li>
              ))}
            </ul>
            {list.total > list.items.length ? (
              <p className={styles.sdkNetworkNote}>
                {t("knowledgeNetwork.integration.sdk.more", {
                  count: list.total - list.items.length,
                })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
