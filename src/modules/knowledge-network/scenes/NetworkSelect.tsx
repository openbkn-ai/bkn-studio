/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Select } from "antd";
import { useEffect, useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";

import { listKnowledgeNetworks } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./NetworkSelect.module.css";

const NETWORK_PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;
/** Start loading the next page when the dropdown is scrolled this close to its end. */
const LOAD_MORE_THRESHOLD_PX = 48;

type NetworkList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: KnowledgeNetworkRecord[]; total: number };

/**
 * A knowledge network dropdown that loads lazily: the first page by name, the next page as the
 * dropdown is scrolled to its end, and a name search on the server. It never loads every network.
 */
export function NetworkSelect({
  value,
  onChange,
  ariaLabel,
  className,
  allowClear = false,
}: {
  value: KnowledgeNetworkRecord | null;
  onChange: (network: KnowledgeNetworkRecord | null) => void;
  ariaLabel: string;
  className?: string;
  allowClear?: boolean;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSequence, setReloadSequence] = useState(0);
  const [list, setList] = useState<NetworkList>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);

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

  const loadMore = (event: UIEvent<HTMLDivElement>) => {
    if (list.status !== "ready" || loadingMore || list.items.length >= list.total) return;
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollTop + clientHeight < scrollHeight - LOAD_MORE_THRESHOLD_PX) return;
    const loaded = list;
    setLoadingMore(true);
    listKnowledgeNetworks({
      direction: "asc",
      keyword: query,
      page: Math.floor(loaded.items.length / NETWORK_PAGE_SIZE) + 1,
      pageSize: NETWORK_PAGE_SIZE,
      sortBy: "name",
    })
      .then((result) => {
        // A search that started meanwhile replaced the list; drop this page.
        setList((current) =>
          current === loaded
            ? {
                status: "ready",
                items: [
                  ...loaded.items,
                  ...result.items.filter(
                    (item) => !loaded.items.some((existing) => existing.id === item.id),
                  ),
                ],
                total: result.total,
              }
            : current,
        );
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  // Keep the chosen network as an option while a search narrows the list.
  const networks = useMemo(() => {
    const items = list.status === "ready" ? list.items : [];
    return value && !items.some((item) => item.id === value.id) ? [value, ...items] : items;
  }, [list, value]);

  const notFound =
    list.status === "loading"
      ? t("knowledgeNetwork.integration.networkPicker.loading")
      : query
        ? t("knowledgeNetwork.integration.networkPicker.noMatch")
        : t("knowledgeNetwork.integration.networkPicker.noNetworks");

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <Select
        className={styles.select}
        showSearch
        filterOption={false}
        allowClear={allowClear}
        value={value?.id}
        options={networks.map((network) => ({
          label: `${network.name} (${network.identifier})`,
          value: network.id,
        }))}
        loading={list.status === "loading" || loadingMore}
        placeholder={t("knowledgeNetwork.integration.networkPicker.searchPlaceholder")}
        aria-label={ariaLabel}
        notFoundContent={notFound}
        onSearch={setKeyword}
        onPopupScroll={loadMore}
        onChange={(id?: string) => onChange(networks.find((network) => network.id === id) ?? null)}
      />
      {list.status === "error" ? (
        <p className={styles.error} role="alert">
          {t("knowledgeNetwork.integration.networkPicker.loadFailed")}{" "}
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => setReloadSequence((sequence) => sequence + 1)}
          >
            <ReloadOutlined /> {t("knowledgeNetwork.integration.networkPicker.retry")}
          </button>
        </p>
      ) : null}
    </div>
  );
}
