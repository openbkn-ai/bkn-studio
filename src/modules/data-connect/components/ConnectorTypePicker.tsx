/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Empty, Input, Select, Tabs } from "antd";
import { useMemo, useState } from "react";
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
import { atLeast, type Edition } from "@/framework/entitlement/edition";
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
                Server availability and administrator enablement remain required for selection.
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
              const selectable = item.available && item.enabled && upgradeEdition === undefined;
              const active = selectable && item.type === value;
              const templateMeta = getConnectorTemplateMeta(item);

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
                    aria-pressed={active}
                    className={styles.cardSelect}
                    disabled={!selectable}
                    onClick={() => onChange(item.type)}
                    type="button"
                  >
                    <div className={styles.cardHeader}>
                      <strong className={styles.cardName}>{item.name}</strong>
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
                    <p className={styles.cardDescription}>
                      {templateMeta.description || item.description || "-"}
                    </p>
                  </button>
                  {upgradeEdition ? (
                    <button
                      aria-haspopup="dialog"
                      className={styles.editionAction}
                      onClick={() => setUpgradeDialogEdition(upgradeEdition)}
                      type="button"
                    >
                      {t("dataConnect.connectorTypeEditionRequired", {
                        edition: t(`common.entitlement.editions.${upgradeEdition}`),
                      })}
                    </button>
                  ) : null}
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
