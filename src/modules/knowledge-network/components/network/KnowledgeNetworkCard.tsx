import { EllipsisOutlined } from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkCard.module.css";

type KnowledgeNetworkCardProps = {
  onDelete: (record: KnowledgeNetworkRecord) => void;
  onEdit: (record: KnowledgeNetworkRecord) => void;
  onExport: (record: KnowledgeNetworkRecord) => void;
  onOpen: (record: KnowledgeNetworkRecord) => void;
  record: KnowledgeNetworkRecord;
};

export function KnowledgeNetworkCard({
  onDelete,
  onEdit,
  onExport,
  onOpen,
  record,
}: KnowledgeNetworkCardProps) {
  const { t } = useTranslation();
  const placeholderText =
    (record.name || "?").trim().charAt(0).toUpperCase() || "?";
  const dropdownItems: MenuProps["items"] = [
    {
      key: "view",
      label: t("common.detail"),
    },
    {
      key: "edit",
      label: t("common.edit"),
    },
    {
      key: "export",
      label: t("knowledgeNetwork.export"),
    },
    {
      key: "delete",
      danger: true,
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
          {record.icon ? (
            <span
              className={styles.iconBox}
              style={{ backgroundColor: record.color }}
            >
              {placeholderText}
            </span>
          ) : (
            <span className={styles.placeholderIcon}>{placeholderText}</span>
          )}
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

              if (key === "export") {
                onExport(record);
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
        <span className={styles.footerLeft}>
          {t("common.updatedBy")}：{record.updaterName || "--"}
        </span>
        <span>
          {t("common.updateTime")}：{record.updateTime || "--"}
        </span>
      </div>
    </article>
  );
}
