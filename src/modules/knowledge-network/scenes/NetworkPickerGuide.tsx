/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Select } from "antd";
import { useEffect, useMemo, useState, type ReactNode, type UIEvent } from "react";
import { useTranslation } from "react-i18next";

import { listKnowledgeNetworks } from "@/modules/knowledge-network/services/network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./NetworkPickerGuide.module.css";

const NETWORK_PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;
/** Start loading the next page when the dropdown is scrolled this close to its end. */
const LOAD_MORE_THRESHOLD_PX = 48;

type NetworkList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: KnowledgeNetworkRecord[]; total: number };

/**
 * A guide on the left and a knowledge network picker on the right, for pages that need a network
 * before they can show anything. The picker searches by name on the server, loads further pages as
 * its dropdown is scrolled, and hands the chosen network to `onOpen`.
 */
export function NetworkPickerGuide({
  guideTitle,
  guideDescription,
  steps,
  eyebrow,
  title,
  actionLabel,
  notice,
  onOpen,
}: {
  guideTitle: string;
  guideDescription: string;
  steps: string[];
  eyebrow: string;
  title: string;
  actionLabel: string;
  /** Shown under the picker, e.g. why an earlier choice is gone. */
  notice?: ReactNode;
  onOpen: (network: KnowledgeNetworkRecord) => void;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSequence, setReloadSequence] = useState(0);
  const [list, setList] = useState<NetworkList>({ status: "loading" });
  const [selected, setSelected] = useState<KnowledgeNetworkRecord | null>(null);
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
    const searched = query;
    setLoadingMore(true);
    listKnowledgeNetworks({
      direction: "asc",
      keyword: searched,
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
    return selected && !items.some((item) => item.id === selected.id)
      ? [selected, ...items]
      : items;
  }, [list, selected]);

  const notFound =
    list.status === "loading"
      ? t("knowledgeNetwork.integration.networkPicker.loading")
      : query
        ? t("knowledgeNetwork.integration.networkPicker.noMatch")
        : t("knowledgeNetwork.integration.networkPicker.noNetworks");

  return (
    <section className={styles.page}>
      <aside className={styles.guide}>
        <h2 className={styles.title}>{guideTitle}</h2>
        <p className={styles.description}>{guideDescription}</p>
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>

      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 className={styles.contentTitle}>{title}</h2>
        </div>

        <div className={styles.picker}>
          <Select
            className={styles.select}
            showSearch
            filterOption={false}
            value={selected?.id}
            options={networks.map((network) => ({
              label: `${network.name} (${network.identifier})`,
              value: network.id,
            }))}
            loading={list.status === "loading" || loadingMore}
            onPopupScroll={loadMore}
            placeholder={t("knowledgeNetwork.integration.networkPicker.searchPlaceholder")}
            aria-label={title}
            notFoundContent={notFound}
            onSearch={setKeyword}
            onChange={(value: string) =>
              setSelected(networks.find((network) => network.id === value) ?? null)
            }
          />
          <Button
            type="primary"
            disabled={!selected}
            onClick={() => {
              if (selected) onOpen(selected);
            }}
          >
            {actionLabel} <ArrowRightOutlined />
          </Button>
        </div>

        {list.status === "error" ? (
          <p className={styles.note} role="alert">
            {t("knowledgeNetwork.integration.networkPicker.loadFailed")}{" "}
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setReloadSequence((value) => value + 1)}
            >
              <ReloadOutlined /> {t("knowledgeNetwork.integration.networkPicker.retry")}
            </button>
          </p>
        ) : null}
        {notice ? <p className={styles.note}>{notice}</p> : null}
      </div>
    </section>
  );
}
