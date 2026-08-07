/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Empty, Input, Select, Tabs } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataSourceFamilyKey } from "@/modules/data-connect/lib/connector-template";
import {
  filterConnectorTypes,
  getConnectorTemplateMeta,
  getConnectorTypeTags,
  getPrimaryDataSourceFamilies,
  isCertifiedConnectorType,
} from "@/modules/data-connect/lib/connector-template";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
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
  const [nameKeyword, setNameKeyword] = useState("");
  const [tag, setTag] = useState<string>();
  const [family, setFamily] = useState<DataSourceFamilyKey>("structured");

  const familyOptions = getPrimaryDataSourceFamilies().filter(
    (item) => item.key === "structured",
  );

  const tagOptions = useMemo(
    () => getConnectorTypeTags(options, family).map((label) => ({ label, value: label })),
    [family, options],
  );

  const filtered = useMemo(
    () => filterConnectorTypes(options, family, nameKeyword, tag),
    [family, nameKeyword, options, tag],
  );

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>{t("dataConnect.connectorTypeStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.connectorTypeStepDescription")}</p>
        </div>
        <div className={styles.filters}>
          <Input.Search
            allowClear
            className={styles.search}
            onChange={(event) => setNameKeyword(event.target.value)}
            placeholder={t("dataConnect.connectorTypeNameSearchPlaceholder")}
            value={nameKeyword}
          />
          <Select
            allowClear
            aria-label={t("dataConnect.connectorTypeTagFilterPlaceholder")}
            className={styles.tagFilter}
            onChange={(value) => setTag(value)}
            options={tagOptions}
            placeholder={t("dataConnect.connectorTypeTagFilterPlaceholder")}
            value={tag}
          />
        </div>
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
            setTag(undefined);
          }}
        />
        <div className={styles.toolbar}>
          <span className={styles.resultText}>共 {filtered.length} 个</span>
        </div>
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((item) => {
              const active = item.enabled && item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);

              return (
                <button
                  className={[
                    styles.card,
                    active ? styles.cardActive : "",
                    item.enabled ? "" : styles.cardDisabled,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!item.enabled}
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
                    <span className={styles.badgeGroup}>
                      <span className={styles.badge}>{templateMeta.label}</span>
                      {/*
                        认证连接器(SQL Server 等商业库)属于专业档能力
                        `connector_certified`。这里只标不挡:能不能建连由服务端判,
                        前端把入口藏掉反而让客户不知道有这个东西可买。
                      */}
                      {isCertifiedConnectorType(item.type) ? (
                        <EditionBadge edition="professional" />
                      ) : null}
                      {!item.enabled ? (
                        <span className={styles.disabledBadge}>
                          {t("dataConnect.connectorTypeUnavailable")}
                        </span>
                      ) : null}
                    </span>
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
