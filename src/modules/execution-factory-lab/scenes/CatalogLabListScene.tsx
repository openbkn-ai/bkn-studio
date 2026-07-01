/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Pagination, Select, message } from "antd";

import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { CatalogCard } from "@/modules/execution-factory-lab/components/CatalogCard";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import {
  installFromCatalog,
  listCatalog,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { CatalogEntry, CatalogKind } from "@/modules/execution-factory-lab/types/catalog";

import styles from "./capability-lab.module.css";

export function CatalogLabListScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { features, loading: featuresLoading } = useLabFeatures();
  const [items, setItems] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<CatalogKind>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listCatalog({
        kind,
        keyword,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t("executionFactoryLab.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [kind, keyword, page, t]);

  useEffect(() => {
    const state = location.state as { catalogKeyword?: string } | null;
    if (state?.catalogKeyword) {
      setKeyword(state.catalogKeyword);
      setPage(1);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!features.catalog) {
      return;
    }
    void load();
  }, [features.catalog, load]);

  const handleInstall = async (entry: CatalogEntry, mode: "create" | "upsert" = "create") => {
    setInstallingId(entry.id);
    try {
      const result = await installFromCatalog({
        kind: entry.kind,
        sourceId: entry.id,
        mode,
      });
      message.success(t("executionFactoryLab.catalogInstallSuccess"));
      const installed = result.capabilities[0];
      if (installed?.id) {
        navigate("/execution-factory-lab/capabilities", {
          state: { openCapabilityId: installed.id },
        });
        return;
      }
      if (result.capabilities.length > 0) {
        await load();
      }
    } catch (installError) {
      message.error(
        installError instanceof Error
          ? installError.message
          : t("executionFactoryLab.catalogInstallFailed"),
      );
    } finally {
      setInstallingId(null);
    }
  };

  if (!featuresLoading && !features.catalog) {
    return (
      <section className={styles.page}>
        <Alert message={t("executionFactoryLab.featureDisabledCatalog")} showIcon type="warning" />
      </section>
    );
  }

  return (
    <PermissionGate permissions={executionFactoryLabPermissions.catalogView}>
      <section className={styles.page}>
        <div className={styles.intro}>
          <h2 className={styles.introTitle}>{t("executionFactoryLab.catalogTitle")}</h2>
          <p className={styles.introDescription}>{t("executionFactoryLab.catalogDescription")}</p>
        </div>

        {error ? <Alert message={error} showIcon type="error" /> : null}

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <Select
              onChange={(value) => {
                setKind(value as CatalogKind);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("executionFactoryLab.kindFilterAll") },
                { value: "http", label: t("executionFactoryLab.kindFilterHttp") },
                { value: "mcp", label: t("executionFactoryLab.kindFilterMcp") },
                { value: "skill", label: t("executionFactoryLab.kindFilterSkill") },
              ]}
              value={kind}
            />
            <Input.Search
              allowClear
              onSearch={(value) => {
                setKeyword(value.trim());
                setPage(1);
              }}
              placeholder={t("executionFactoryLab.catalogSearchPlaceholder")}
              style={{ width: 280 }}
            />
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className={styles.empty}>{t("executionFactoryLab.loadFailed")}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>{t("executionFactoryLab.catalogEmpty")}</div>
        ) : (
          <div className={styles.grid}>
            {items.map((entry) => (
              <CatalogCard
                key={`${entry.kind}:${entry.id}`}
                entry={entry}
                installing={installingId === entry.id}
                onInstall={handleInstall}
              />
            ))}
          </div>
        )}

        {total > pageSize ? (
          <Pagination
            current={page}
            onChange={setPage}
            pageSize={pageSize}
            showSizeChanger={false}
            total={total}
          />
        ) : null}
      </section>
    </PermissionGate>
  );
}
