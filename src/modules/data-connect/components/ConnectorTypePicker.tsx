/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Empty, Input, Select, Tabs } from "antd";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataSourceFamilyKey } from "@/modules/data-connect/lib/connector-template";
import {
  filterConnectorTypes,
  getConnectorRequiredEdition,
  getConnectorTemplateMeta,
  getConnectorTypeTags,
  getPrimaryDataSourceFamilies,
} from "@/modules/data-connect/lib/connector-template";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { CapabilityUpgradeDialog } from "@/framework/entitlement/CapabilityUpgradeDialog";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { atLeast, type Edition } from "@/framework/entitlement/edition";
import { useEntitlementContext } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import dorisLogo from "@/modules/data-connect/assets/connectors/doris.svg";
import hanaLogo from "@/modules/data-connect/assets/connectors/hana.png";
import mariadbLogo from "@/modules/data-connect/assets/connectors/mariadb.png";
import mysqlLogo from "@/modules/data-connect/assets/connectors/mysql.png";
import opensearchLogo from "@/modules/data-connect/assets/connectors/opensearch.png";
import oracleLogo from "@/modules/data-connect/assets/connectors/oracle.png";
import postgresqlLogo from "@/modules/data-connect/assets/connectors/postgresql.png";
import sqlserverLogo from "@/modules/data-connect/assets/connectors/sqlserver.png";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./ConnectorTypePicker.module.css";

// Assets are copied from a pinned DBeaver revision; unknown types keep the generic icon.
const CONNECTOR_LOGOS = new Map([
  ["doris", dorisLogo],
  ["hana", hanaLogo],
  ["mariadb", mariadbLogo],
  ["mysql", mysqlLogo],
  ["opensearch", opensearchLogo],
  ["oracle", oracleLogo],
  ["postgresql", postgresqlLogo],
  ["sqlserver", sqlserverLogo],
]);

type ConnectorTypePickerProps = {
  onChange: (value: string) => void;
  value?: string;
  options: DataConnectConnectorType[];
};

export function ConnectorTypePicker({ onChange, value, options }: ConnectorTypePickerProps) {
  const { t } = useTranslation();
  const descriptionIdPrefix = useId();
  const [nameKeyword, setNameKeyword] = useState("");
  const [tag, setTag] = useState<string>();
  const [family, setFamily] = useState<DataSourceFamilyKey>("structured");
  const [upgradeDialogEdition, setUpgradeDialogEdition] = useState<Edition>();
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
                Server availability and administrator enablement determine selection.
                Product edition metadata only explains the requirement; an unknown snapshot
                must not be treated as confirmed edition insufficiency.
              */
              const requiredEdition = getConnectorRequiredEdition(item);
              const upgradeEdition =
                requiredEdition !== undefined &&
                snapshot !== null &&
                !atLeast(snapshot.edition, requiredEdition)
                  ? requiredEdition
                  : undefined;
              const selectable = item.available && item.enabled;
              const active = selectable && item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);
              const description = templateMeta.description || item.description || "-";
              const logo = CONNECTOR_LOGOS.get(item.type);
              const descriptionId = `${descriptionIdPrefix}-${item.type}`;

              return (
                <div
                  className={[
                    styles.card,
                    active ? styles.cardActive : "",
                    selectable ? "" : styles.cardDisabled,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.type}
                >
                  <button
                    aria-describedby={descriptionId}
                    aria-pressed={active}
                    className={styles.cardSelect}
                    disabled={!selectable}
                    onClick={() => onChange(item.type)}
                    title={`${item.name}\n${description}`}
                    type="button"
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.identity}>
                        <span aria-hidden className={styles.logo}>
                          {logo ? <img alt="" src={logo} /> : <DatabaseOutlined />}
                        </span>
                        <strong className={styles.cardName}>{item.name}</strong>
                      </div>
                      <span className={styles.badgeGroup}>
                        {!item.isPlaceholder && !item.enabled ? (
                          <span className={styles.disabledBadge}>
                            {t("dataConnect.connectorTypeDisabled")}
                          </span>
                        ) : !item.available ? (
                          <span className={styles.disabledBadge}>
                            {t("dataConnect.connectorTypeUnavailable")}
                          </span>
                        ) : null}
                        <span className={styles.badge}>{templateMeta.label}</span>
                      </span>
                    </div>
                  </button>
                  <div className={styles.cardFooter}>
                    <p className={styles.cardDescription} id={descriptionId}>
                      {description}
                    </p>
                    {upgradeEdition ? (
                      <AppButton
                        aria-haspopup="dialog"
                        aria-label={`${t("dataConnect.connectorTypeUnlock")} ${t(`common.entitlement.editionsShort.${upgradeEdition}`)}`}
                        className={styles.editionAction}
                        onClick={() => setUpgradeDialogEdition(upgradeEdition)}
                        type="primary"
                      >
                        {t("dataConnect.connectorTypeUnlock")}
                        <EditionBadge alwaysShow edition={upgradeEdition} />
                      </AppButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <Empty description={t("dataConnect.connectorTypeEmpty")} />
          </div>
        )}
      </div>
      {upgradeDialogEdition &&
      snapshot !== null &&
      !atLeast(snapshot.edition, upgradeDialogEdition) ? (
        <CapabilityUpgradeDialog
          capability={CAPABILITIES.CONNECTOR_CERTIFIED}
          minEdition={upgradeDialogEdition}
          onClose={() => setUpgradeDialogEdition(undefined)}
          open
        />
      ) : null}
    </div>
  );
}
