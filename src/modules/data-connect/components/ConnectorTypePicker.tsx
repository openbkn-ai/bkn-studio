/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Empty, Input, Tabs } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataSourceFamilyKey } from "@/modules/data-connect/lib/connector-template";
import {
  getConnectorTemplateMeta,
  getPrimaryDataSourceFamilies,
  matchesDataSourceFamily,
} from "@/modules/data-connect/lib/connector-template";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./ConnectorTypePicker.module.css";

type ConnectorTypePickerProps = {
  onChange: (value: string) => void;
  value?: string;
  options: DataConnectConnectorType[];
};

export function ConnectorTypePicker({
  onChange,
  value,
  options,
}: ConnectorTypePickerProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [family, setFamily] = useState<DataSourceFamilyKey>("structured");

  const familyOptions = getPrimaryDataSourceFamilies().filter(
    (item) => item.key === "structured",
  );

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return options.filter((item) => {
      const templateMeta = getConnectorTemplateMeta(item);
      const matchesFamily = matchesDataSourceFamily(item, family);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.type.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        templateMeta.label.toLowerCase().includes(normalizedKeyword) ||
        templateMeta.description.toLowerCase().includes(normalizedKeyword);

      return matchesFamily && matchesKeyword;
    });
  }, [family, keyword, options]);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>{t("dataConnect.connectorTypeStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.connectorTypeStepDescription")}</p>
        </div>
        <Input.Search
          allowClear
          className={styles.search}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("dataConnect.connectorTypeSearchPlaceholder")}
          value={keyword}
        />
      </div>
      <div className={styles.main}>
        <Tabs
          activeKey={family}
          className={styles.familyTabs}
          items={familyOptions.map((item) => {
            const Icon = item.key === "structured" ? DatabaseOutlined : FileTextOutlined;

            return {
              key: item.key,
              label: (
                <span className={styles.tabLabel}>
                  <Icon />
                  {item.label}
                </span>
              ),
            };
          })}
          onChange={(key) => {
            setFamily(key as DataSourceFamilyKey);
          }}
        />
        <div className={styles.toolbar}>
          <div className={styles.toolbarTitle}>接入模板</div>
          <span className={styles.resultText}>共 {filtered.length} 个</span>
        </div>
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((item) => {
              const active = item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);

              return (
                <button
                  className={[styles.card, active ? styles.cardActive : ""].filter(Boolean).join(" ")}
                  key={item.type}
                  onClick={() => onChange(item.type)}
                  type="button"
                >
                  {active ? (
                    <span className={styles.checkMark} aria-hidden>
                      <CheckOutlined />
                    </span>
                  ) : null}
                  <div className={styles.cardHeader}>
                    <strong>{item.name}</strong>
                    <span className={styles.badge}>{templateMeta.label}</span>
                  </div>
                  <p className={styles.cardDescription}>
                    {templateMeta.description || item.description || "-"}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <Empty description={t("dataConnect.connectorTypeEmpty")} />
          </div>
        )}
      </div>
    </div>
  );
}
