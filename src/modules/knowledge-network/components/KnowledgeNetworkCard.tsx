import {
  DeploymentUnitOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  NodeIndexOutlined,
} from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkCard.module.css";

type KnowledgeNetworkCardProps = {
  onDelete: (record: KnowledgeNetworkRecord) => void;
  onEdit: (record: KnowledgeNetworkRecord) => void;
  onOpen: (record: KnowledgeNetworkRecord) => void;
  onPreview: (record: KnowledgeNetworkRecord) => void;
  record: KnowledgeNetworkRecord;
};

export function KnowledgeNetworkCard({
  onDelete,
  onEdit,
  onOpen,
  onPreview,
  record,
}: KnowledgeNetworkCardProps) {
  const { t } = useTranslation();
  const dropdownItems: MenuProps["items"] = [
    {
      key: "open",
      icon: <EyeOutlined />,
      label: t("knowledgeNetwork.enterWorkspace"),
    },
    {
      key: "preview",
      icon: <NodeIndexOutlined />,
      label: t("knowledgeNetwork.preview"),
    },
    {
      key: "edit",
      icon: <EditOutlined />,
      label: t("common.edit"),
    },
    {
      key: "delete",
      danger: true,
      icon: <DeleteOutlined />,
      label: t("common.delete"),
    },
  ];

  return (
    <article
      className={styles.card}
      onClick={() => onOpen(record)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(record);
        }
      }}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span
            className={styles.iconBox}
            style={{ backgroundColor: record.color }}
          >
            <DeploymentUnitOutlined />
          </span>
          <div className={styles.titleContent}>
            <div className={styles.titleText}>{record.name}</div>
            <div className={styles.description}>
              {record.description || t("knowledgeNetwork.noDescription")}
            </div>
          </div>
        </div>
        <Dropdown
          menu={{
            items: dropdownItems,
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();

              if (key === "edit") {
                onEdit(record);
                return;
              }

              if (key === "preview") {
                onPreview(record);
                return;
              }

              if (key === "delete") {
                onDelete(record);
                return;
              }

              onOpen(record);
            },
          }}
          trigger={["click"]}
        >
          <button
            className={styles.moreButton}
            onClick={(event) => {
              event.stopPropagation();
            }}
            type="button"
          >
            <EllipsisOutlined />
          </button>
        </Dropdown>
      </div>
      <div className={styles.footer}>
        <span>{t("knowledgeNetwork.updatedBy", { name: record.updaterName })}</span>
        <span>{record.updateTime}</span>
      </div>
    </article>
  );
}
