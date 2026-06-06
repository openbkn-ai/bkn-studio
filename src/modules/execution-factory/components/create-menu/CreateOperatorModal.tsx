import { ApiOutlined, DeploymentUnitOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Modal, Radio } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";

import styles from "./create-menu.module.css";

type CreateOperatorModalProps = {
  open: boolean;
  onClose: () => void;
};

type CreateMode = "openapi" | "function" | "flow";

export function CreateOperatorModal({ open, onClose }: CreateOperatorModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreateMode | undefined>();

  const options = useMemo(
    () => [
      {
        key: "openapi" as const,
        icon: ApiOutlined,
        title: t("executionFactory.metadataTypes.openapi"),
        desc: t("executionFactory.createOperatorOpenApiDesc"),
      },
      {
        key: "function" as const,
        icon: ThunderboltOutlined,
        title: t("executionFactory.createOperatorFunctionTitle"),
        desc: t("executionFactory.createOperatorFunctionDesc"),
      },
      {
        key: "flow" as const,
        icon: DeploymentUnitOutlined,
        title: t("executionFactory.createOperatorFlowTitle"),
        desc: t("executionFactory.createOperatorFlowDesc"),
      },
    ],
    [t],
  );

  const handleConfirm = () => {
    if (!mode) {
      return;
    }

    onClose();

    if (mode === "flow") {
      void message.info(t("executionFactory.flowEditorComingSoon"));
      return;
    }

    void navigate(`/execution-factory/units/new?metadataType=${mode}`);
  };

  return (
    <Modal
      destroyOnClose
      okButtonProps={{ disabled: !mode }}
      okText={t("common.save")}
      onCancel={onClose}
      onOk={handleConfirm}
      open={open}
      title={t("executionFactory.createOperatorModalTitle")}
      width={720}
    >
      <p className={styles.modalHint}>{t("executionFactory.createOperatorModalHint")}</p>
      <p className={styles.modalHint}>{t("executionFactory.createOperatorModalHintLocked")}</p>
      <Radio.Group
        onChange={(event) => setMode(event.target.value as CreateMode)}
        value={mode}
      >
        <div className={styles.optionGrid}>
          {options.map(({ key, title, desc, icon: Icon }) => (
            <label
              className={`${styles.optionCard} ${mode === key ? styles.optionCardActive : ""}`}
              key={key}
            >
              <Radio value={key} />
              <Icon style={{ fontSize: 22, color: "#1677ff" }} />
              <div className={styles.optionTitle}>{title}</div>
              <div className={styles.optionDesc}>{desc}</div>
            </label>
          ))}
        </div>
      </Radio.Group>
    </Modal>
  );
}
