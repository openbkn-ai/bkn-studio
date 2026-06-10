import { Drawer } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { SmallModel } from "@/modules/model-resources/types/small-model";
import {
  buildSmallModelCurlExample,
  getModelApiBaseUrl,
  getModelApiHost,
  resolveModelApiName,
} from "@/modules/model-resources/utils/model-api-guide";

import { ModelApiGuideCodeBlock } from "./ModelApiGuideCodeBlock";
import styles from "./ModelApiGuideDrawer.module.css";
import { ModelApiGuideTable } from "./ModelApiGuideTable";

type SmallModelApiGuideDrawerProps = {
  onClose: () => void;
  open: boolean;
  record: SmallModel | null;
};

export function SmallModelApiGuideDrawer({ onClose, open, record }: SmallModelApiGuideDrawerProps) {
  const { t } = useTranslation();

  const host = getModelApiHost();
  const modelName = record
    ? resolveModelApiName(record.modelName, record.modelConfig?.apiModel)
    : "";

  const tableRows = useMemo(
    () => [
      {
        id: "base_url",
        arguments: "base_url",
        required: true,
        value: getModelApiBaseUrl(host),
      },
    ],
    [host],
  );

  const curlExample = useMemo(
    () =>
      record && modelName
        ? buildSmallModelCurlExample({
            host,
            modelName,
            modelType: record.modelType,
          })
        : "",
    [host, modelName, record],
  );

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={t("modelResources.models.apiGuide.title")}
      width={800}
    >
      {record ? (
        <>
          <p className={styles.description}>{t("modelResources.models.apiGuide.apiTitle")}</p>

          <ModelApiGuideTable dataSource={tableRows} />

          <h4 className={styles.sectionTitle}>{t("modelResources.models.apiGuide.initiateRequest")}</h4>

          <h5 className={styles.subsectionTitle}>{t("modelResources.models.apiGuide.method1_2")}</h5>
          <ModelApiGuideCodeBlock
            height={record.modelType === "reranker" ? 236 : 146}
            language="json"
            value={curlExample}
          />
        </>
      ) : null}
    </Drawer>
  );
}
