/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Empty, Input } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataSourceFamilyKey } from "@/modules/data-connect/lib/connector-template";
import {
  getConnectorTemplateMeta,
  getDataSourceFamilyMeta,
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

  const familyOptions = getPrimaryDataSourceFamilies();

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return options.filter((item) => {
      const templateMeta = getConnectorTemplateMeta(item);
      const familyMeta = getDataSourceFamilyMeta(family);
      const matchesFamily = matchesDataSourceFamily(item, family);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.type.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        templateMeta.label.toLowerCase().includes(normalizedKeyword) ||
        familyMeta.label.toLowerCase().includes(normalizedKeyword);

      return matchesFamily && matchesKeyword;
    });
  }, [family, keyword, options]);

  const selectedConnector = useMemo(
    () => options.find((item) => item.type === value),
    [options, value],
  );

  const fieldCount = selectedConnector
    ? Object.keys(selectedConnector.fieldConfig ?? {}).length
    : 0;

  const selectedTemplateMeta = selectedConnector ? getConnectorTemplateMeta(selectedConnector) : null;

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
      <div className={styles.familyRow}>
        {familyOptions.map((item) => {
          const Icon = item.key === "structured" ? DatabaseOutlined : FileTextOutlined;
          const active = item.key === family;

          return (
            <button
              className={[styles.familyCard, active ? styles.familyCardActive : ""].join(" ")}
              key={item.key}
              onClick={() => {
                setFamily(item.key);
              }}
              type="button"
            >
              <span className={styles.familyIcon}>
                <Icon />
              </span>
              <span className={styles.familyText}>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarTitle}>接入模板</div>
            <span className={styles.resultText}>共 {filtered.length} 个可选连接器</span>
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
                    <div className={styles.cardHeader}>
                      <strong>{item.name}</strong>
                      <span className={styles.badge}>{templateMeta.label}</span>
                    </div>
                    <p className={styles.cardDescription}>
                      {item.description || templateMeta.description || "-"}
                    </p>
                    <div className={styles.cardMeta}>
                      <span>{item.type}</span>
                      <span>字段：{Object.keys(item.fieldConfig ?? {}).length}</span>
                    </div>
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
        <aside className={styles.aside}>
          <div className={styles.asideCard}>
            <div className={styles.asideTitle}>已选连接器</div>
            {selectedConnector ? (
              <>
                <div className={styles.selectedName}>{selectedConnector.name}</div>
                <div className={styles.selectedType}>{selectedConnector.type}</div>
                <dl className={styles.selectedMeta}>
                  <div>
                    <dt>数据类型</dt>
                    <dd>{getDataSourceFamilyMeta(family).label}</dd>
                  </div>
                  <div>
                    <dt>接入模板</dt>
                    <dd>{selectedTemplateMeta?.label ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>连接类别</dt>
                    <dd>{t(`dataConnect.categories.${selectedConnector.category}`)}</dd>
                  </div>
                  <div>
                    <dt>配置字段</dt>
                    <dd>{fieldCount} 项</dd>
                  </div>
                </dl>
                <p className={styles.selectedDescription}>
                  {selectedConnector.description || selectedTemplateMeta?.description || "-"}
                </p>
              </>
            ) : (
              <p className={styles.emptyHint}>请选择一个连接器，再进入下一步填写连接配置。</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
