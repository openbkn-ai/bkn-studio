/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { formatBounds } from "@/modules/knowledge-network/components/value-type/value-type-text";
import type {
  PropertyDeclarations,
  ValueType,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./PropertyDeclarationTags.module.css";

const PREFIX = "knowledgeNetwork.propertyDeclarations";
const SHOWN_ALIASES = 2;

/**
 * A data property's declarations as a row of tags: the semantic in green, a value type in blue by
 * its name, the rest as short phrases. A property without declarations shows a dash.
 */
export function PropertyDeclarationTags({
  declarations,
  valueTypes,
}: {
  declarations?: PropertyDeclarations;
  valueTypes: readonly ValueType[];
}) {
  const { t } = useTranslation();
  if (!declarations) {
    return <span>—</span>;
  }

  const separator = t("knowledgeNetwork.declarations.listSeparator");
  const { aliases = [], constraints, required, semantic } = declarations;
  const valueType = constraints?.valueType
    ? valueTypes.find((item) => item.id === constraints.valueType)
    : undefined;
  const shownAliases = aliases.slice(0, SHOWN_ALIASES).join(separator);
  const hiddenAliases = aliases.length - SHOWN_ALIASES;

  return (
    <span className={styles.tags}>
      {semantic ? <Tag color="green">{t(`${PREFIX}.semanticValue.${semantic}`)}</Tag> : null}
      {required ? <Tag>{t(`${PREFIX}.tag.required`)}</Tag> : null}
      {aliases.length ? (
        <Tooltip title={hiddenAliases > 0 ? aliases.join(separator) : undefined}>
          <Tag>
            {t(`${PREFIX}.tag.aliases`, { aliases: shownAliases })}
            {hiddenAliases > 0
              ? ` ${t(`${PREFIX}.tag.moreAliases`, { count: aliases.length })}`
              : null}
          </Tag>
        </Tooltip>
      ) : null}
      {constraints?.valueType ? (
        <Tag color="blue">
          {t(`${PREFIX}.tag.valueType`, { name: valueType?.name ?? constraints.valueType })}
        </Tag>
      ) : null}
      {constraints?.range ? (
        <Tag>{t(`${PREFIX}.tag.range`, { range: formatBounds(constraints.range) })}</Tag>
      ) : null}
      {constraints?.length ? (
        <Tag>{t(`${PREFIX}.tag.length`, { range: formatBounds(constraints.length) })}</Tag>
      ) : null}
      {constraints?.pattern ? (
        <Tooltip title={constraints.pattern}>
          <Tag>{t(`${PREFIX}.tag.pattern`)}</Tag>
        </Tooltip>
      ) : null}
      {constraints?.unit ? <Tag>{t(`${PREFIX}.tag.unit`, { unit: constraints.unit })}</Tag> : null}
      {constraints?.unique ? <Tag>{t(`${PREFIX}.tag.unique`)}</Tag> : null}
      {constraints?.crs ? <Tag>{t(`${PREFIX}.tag.crs`, { crs: constraints.crs })}</Tag> : null}
      {constraints?.timezone ? (
        <Tag>{t(`${PREFIX}.tag.timezone`, { timezone: constraints.timezone })}</Tag>
      ) : null}
      {Object.keys(constraints?.passthrough ?? {}).map((key) => (
        <Tooltip key={key} title={JSON.stringify(constraints?.passthrough?.[key])}>
          <Tag>{t(`${PREFIX}.tag.other`, { key })}</Tag>
        </Tooltip>
      ))}
    </span>
  );
}
