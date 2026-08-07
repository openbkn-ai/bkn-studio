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
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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
              const certified = isCertifiedConnectorType(item.type);
              /*
                能不能用**只信后端的 enabled**,不看 capabilities[]:认证连接器由 Vega
                实现,不在 bkn-safe 的装配表里,那个端点永远不报这个 key
                (ee-design.md §6「A 答不了 B」)——照它判会让 SQL Server 在所有部署上都
                点不进去,包括买了的。

                认证连接器被后端关掉时,原因几乎一定是「没买」而不是「坏了」,所以那种
                情况不画「暂不可用」,画档位徽标 + 点击给升级引导。普通连接器的
                enabled: false 仍是真不可用,照旧禁用。
              */
              const locked = certified && !item.enabled;
              const active = item.enabled && !locked && item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);

              return (
                <button
                  className={[
                    styles.card,
                    active ? styles.cardActive : "",
                    item.enabled || locked ? "" : styles.cardDisabled,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!item.enabled && !locked}
                  key={item.type}
                  onClick={() => (locked ? setUpgradeOpen(true) : onChange(item.type))}
                  type="button"
                >
                  {active ? (
                    <span className={styles.checkMark} aria-hidden>
                      <CheckOutlined />
                    </span>
                  ) : null}
                  <div className={styles.cardHeader}>
                    {/* 档位徽标跟在连接器名后面:它说的是「这个连接器要哪一档」,右侧那组
                        标签说的是「它属于哪类数据源」,两件事别挤在同一排。 */}
                    <strong className={styles.cardName}>
                      {item.name}
                      {/*
                        这里有比 capabilities[] 更强的信号:后端自己说这个连接器能不能用。
                        能用就不标——标了等于对着一个正在工作的连接器喊「要付费」。
                      */}
                      {locked ? (
                        <EditionBadge
                          alwaysShow
                          capability={CAPABILITIES.CONNECTOR_CERTIFIED}
                          edition="professional"
                        />
                      ) : null}
                    </strong>
                    <span className={styles.badgeGroup}>
                      <span className={styles.badge}>{templateMeta.label}</span>
                      {!item.enabled && !locked ? (
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
      <CapabilityUpgradeDialog
        capability={CAPABILITIES.CONNECTOR_CERTIFIED}
        minEdition="professional"
        onClose={() => setUpgradeOpen(false)}
        open={upgradeOpen}
      />
    </div>
  );
}
