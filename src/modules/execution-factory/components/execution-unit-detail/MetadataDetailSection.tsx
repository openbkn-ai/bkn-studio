/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Input } from "antd";
import { useTranslation } from "react-i18next";

import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type { OperatorMetadataType } from "@/modules/execution-factory/types/operator";
import { parseOpenApiEndpointDetail } from "@/modules/execution-factory/utils/openapi-detail";

import styles from "../ToolboxDetailDrawer.module.css";

type MetadataDetailSectionProps = {
  functionInput?: FunctionInputPayload;
  metadataType?: OperatorMetadataType | string;
  openapiSpec?: string;
};

export function MetadataDetailSection({
  functionInput,
  metadataType,
  openapiSpec,
}: MetadataDetailSectionProps) {
  const { t } = useTranslation();

  if (metadataType === "function") {
    return (
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>
          {t("executionFactory.metadataSectionTitle")}
        </h3>
        {functionInput?.code ? (
          <>
            <h4 className={styles.sectionTitle}>{t("executionFactory.functionCode")}</h4>
            <Input.TextArea readOnly rows={12} value={functionInput.code} />
          </>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <ToolIoPanel functionInput={functionInput} />
        </div>
      </section>
    );
  }

  if (metadataType === "openapi") {
    const endpoint = parseOpenApiEndpointDetail(openapiSpec);

    return (
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>
          {t("executionFactory.metadataSectionTitle")}
        </h3>
        {endpoint ? (
          <Descriptions
            bordered
            column={1}
            items={[
              {
                key: "serverUrl",
                label: t("executionFactory.toolboxServerUrlLabel"),
                children: endpoint.serverUrl ?? "-",
              },
              {
                key: "method",
                label: t("executionFactory.apiMethodLabel"),
                children: endpoint.method ?? "-",
              },
              {
                key: "path",
                label: t("executionFactory.apiPathLabel"),
                children: endpoint.path ?? "-",
              },
            ]}
            size="small"
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <ToolIoPanel ioSpec={endpoint?.ioSpec} />
        {openapiSpec ? (
          <>
            <h4 className={styles.sectionTitle} style={{ marginTop: 16 }}>
              {t("executionFactory.openapiSpec")}
            </h4>
            <Input.TextArea readOnly rows={10} value={openapiSpec} />
          </>
        ) : null}
      </section>
    );
  }

  return null;
}
