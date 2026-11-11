/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import type { CypherResultShape } from "@/modules/execution-factory/types/function-input";
import type { CypherFunctionNotice } from "@/modules/execution-factory/utils/cypher-function";
import { NetworkSelect } from "@/modules/knowledge-network/scenes/NetworkSelect";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/network";

import styles from "./CypherFunctionSettings.module.css";

/**
 * What a Cypher function needs besides its statement: the network the statement queries and
 * the shape it returns. Shown above the editor in place of the Python templates.
 */
export function CypherFunctionSettings({
  network,
  knId,
  onNetworkChange,
  resultShape,
  onResultShapeChange,
  notices,
  readOnly,
}: {
  network: KnowledgeNetworkRecord | null;
  /** The stored network id, shown while its record loads or when it cannot be read. */
  knId: string;
  onNetworkChange: (network: KnowledgeNetworkRecord | null) => void;
  resultShape: CypherResultShape;
  onResultShapeChange: (shape: CypherResultShape) => void;
  /** What the statement's parameters and rows call for before the save. */
  notices: readonly CypherFunctionNotice[];
  readOnly: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.settings}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>{t("executionFactory.cypherFunction.network")}</span>
          {readOnly ? (
            <span className={styles.readOnlyValue}>{network?.name ?? knId}</span>
          ) : (
            <NetworkSelect
              ariaLabel={t("executionFactory.cypherFunction.network")}
              className={styles.networkSelect}
              onChange={onNetworkChange}
              value={network}
            />
          )}
        </label>
        <div className={styles.field}>
          <span className={styles.label}>
            {t("executionFactory.cypherFunction.shape")}
            <Tooltip
              title={
                <>
                  <p>{t("executionFactory.cypherFunction.shapeValueHint")}</p>
                  <p>{t("executionFactory.cypherFunction.shapeTableHint")}</p>
                </>
              }
            >
              <QuestionCircleOutlined className={styles.hintIcon} />
            </Tooltip>
          </span>
          <Segmented<CypherResultShape>
            disabled={readOnly}
            onChange={onResultShapeChange}
            options={[
              { label: t("executionFactory.cypherFunction.shapeValue"), value: "value" },
              { label: t("executionFactory.cypherFunction.shapeTable"), value: "table" },
            ]}
            size="small"
            value={resultShape}
          />
        </div>
      </div>
      {!knId && !readOnly ? (
        <Alert
          banner
          message={t("executionFactory.cypherFunction.networkRequired")}
          showIcon
          type="info"
        />
      ) : null}
      {notices.map((notice) => (
        <Alert
          banner
          key={notice.kind}
          message={t(`executionFactory.cypherFunction.notices.${notice.kind}`, {
            max: "max" in notice ? notice.max : undefined,
            rows: "rows" in notice ? notice.rows : undefined,
          })}
          showIcon
          type={notice.level}
        />
      ))}
    </div>
  );
}
