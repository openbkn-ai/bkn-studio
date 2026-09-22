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
} from "@/modules/data-connect/lib/connector-template";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { atLeast } from "@/framework/entitlement/edition";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./ConnectorTypePicker.module.css";

type ConnectorTypePickerProps = {
  onChange: (value: string) => void;
  value?: string;
  options: DataConnectConnectorType[];
};

export function ConnectorTypePicker({ onChange, value, options }: ConnectorTypePickerProps) {
  const { t } = useTranslation();
  const [nameKeyword, setNameKeyword] = useState("");
  const [tag, setTag] = useState<string>();
  const [family, setFamily] = useState<DataSourceFamilyKey>("structured");
  const { snapshot } = useEntitlementContext();

  const familyOptions = getPrimaryDataSourceFamilies().filter((item) => item.key === "structured");

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
          <span className={styles.resultText}>
            {t("dataConnect.connectorTypeResultCount", { count: filtered.length })}
          </span>
        </div>
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((item) => {
              /*
                `available` 是 Vega 在当前二进制与授权下的可用性，`enabled` 是管理员停用
                开关；两者都为 true 才允许选择，前端不以授权快照覆盖它。
                `requiredEdition` 是 Vega 为本连接器声明的最低档位：已拿到快照且当前档位
                不足时显示；快照未知或后端未声明时不作推断，避免首屏加载时闪出错误提示。
              */
              const requiredEditionBadge =
                item.requiredEdition !== undefined &&
                snapshot !== null &&
                !atLeast(snapshot.edition, item.requiredEdition)
                  ? item.requiredEdition
                  : undefined;
              const selectable = item.available && item.enabled;
              const active = selectable && item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);

              return (
                <button
                  className={[
                    styles.card,
                    active ? styles.cardActive : "",
                    selectable ? "" : styles.cardDisabled,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!selectable}
                  key={item.type}
                  onClick={() => onChange(item.type)}
                  type="button"
                >
                  <div className={styles.cardHeader}>
                    {/* 档位徽标跟在连接器名后面:它说的是「这个连接器要哪一档」,右侧那组
                        标签说的是「它属于哪类数据源」,两件事别挤在同一排。 */}
                    <strong className={styles.cardName}>
                      {item.name}
                      {requiredEditionBadge ? (
                        <EditionBadge alwaysShow edition={requiredEditionBadge} />
                      ) : null}
                    </strong>
                    <span className={styles.badgeGroup}>
                      {!item.available ? (
                        <span className={styles.disabledBadge}>
                          {t("dataConnect.connectorTypeUnavailable")}
                        </span>
                      ) : !item.enabled ? (
                        <span className={styles.disabledBadge}>
                          {t("dataConnect.connectorTypeDisabled")}
                        </span>
                      ) : null}
                      <span className={styles.badge}>{templateMeta.label}</span>
                      <span
                        aria-hidden
                        className={[styles.checkMark, active ? "" : styles.checkMarkPlaceholder]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {active ? <CheckOutlined /> : null}
                      </span>
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
