import { Drawer } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  buildLlmCurlExample,
  buildLlmSdkExample,
  getModelApiBaseUrl,
  getModelApiHost,
  resolveModelApiName,
} from "@/modules/model-resources/utils/model-api-guide";

import { ModelApiGuideCodeBlock } from "./ModelApiGuideCodeBlock";
import styles from "./ModelApiGuideDrawer.module.css";
import { ModelApiGuideCopyButton } from "./ModelApiGuideCopyButton";
import { ModelApiGuideTable } from "./ModelApiGuideTable";

type LlmApiGuideDrawerProps = {
  onClose: () => void;
  open: boolean;
  record: LlmModel | null;
};

export function LlmApiGuideDrawer({ onClose, open, record }: LlmApiGuideDrawerProps) {
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
    () => (modelName ? buildLlmCurlExample({ host, modelName }) : ""),
    [host, modelName],
  );

  const sdkExample = useMemo(
    () => (modelName ? buildLlmSdkExample({ host, modelName }) : ""),
    [host, modelName],
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

          <h5 className={styles.subsectionTitle}>{t("modelResources.models.apiGuide.method1")}</h5>
          <ModelApiGuideCodeBlock height={165} language="json" value={curlExample} />

          <h5 className={styles.subsectionTitle}>{t("modelResources.models.apiGuide.method2")}</h5>
          <p className={styles.sdkDescription}>{t("modelResources.models.apiGuide.sdkDescribe1")}</p>
          <p className={styles.sdkDescription}>{t("modelResources.models.apiGuide.sdkDescribe2")}</p>

          <div className={styles.installCommand}>
            <ModelApiGuideCopyButton className={styles.copyButton} text="pip install openai" />
            pip install openai
          </div>

          <h5 className={styles.subsectionTitle}>{t("modelResources.models.apiGuide.codeExample")}</h5>
          <ModelApiGuideCodeBlock height={255} language="python" value={sdkExample} />
        </>
      ) : null}
    </Drawer>
  );
}
