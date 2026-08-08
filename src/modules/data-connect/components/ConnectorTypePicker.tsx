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
import type { Edition } from "@/framework/entitlement/edition";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { capabilitySatisfied } from "@/framework/entitlement/upgrade-reason";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { capabilityReportedByEndpoint } from "@/modules/subscription/capability-catalog";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./ConnectorTypePicker.module.css";

/** 认证连接器的门槛档,与能力登记表一致(`connector_certified` 属 Professional)。 */
const CERTIFIED_MIN_EDITION: Edition = "professional";

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
  const { loading, snapshot } = useEntitlementContext();

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
                后端关掉认证连接器,原因分两种,得看这套部署的授权实况:

                - **没买 / 镜像里没有** → 画档位徽标 + 点击给升级引导,客户看得见才知道
                  有东西可买。
                - **买了也装了** → 那就不是授权的事。Vega 的 `enabled` 是运维开关
                  (`POST /connector-types/:type/enable`),`available` 才是「这个二进制
                  里有没有这段实现」,两者都不由证书推导。这时照普通连接器画「暂不可用」:
                  对一个已经买了企业版的客户说「请升级镜像」,是拿授权去解释一个跟授权
                  无关的开关。

                判据用 capabilities[]:vega 的 ee 构建已经把 `connector_certified` 登记进
                装配表(2026-08-08 实测端点报得出),所以这里不再需要退到档位。

                普通连接器的 enabled: false 一直是真不可用,照旧禁用。

                快照没到时不当作「没买」:那段窗口里企业集群会先闪一下专业版徽标,点开正是
                本轮要修掉的那句话。窗口长短取决于 Vega 与 bkn-safe 两个后端的相对延迟,
                连接器列表先回来就看得见。
              */
              const locked =
                certified &&
                !item.enabled &&
                !loading &&
                !capabilitySatisfied(
                  CAPABILITIES.CONNECTOR_CERTIFIED,
                  snapshot,
                  CERTIFIED_MIN_EDITION,
                  capabilityReportedByEndpoint(CAPABILITIES.CONNECTOR_CERTIFIED),
                );
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
