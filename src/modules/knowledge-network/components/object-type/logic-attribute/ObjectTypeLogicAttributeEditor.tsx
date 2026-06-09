import { EllipsisOutlined, PlusOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { Dropdown, Empty, Input, Table, Tooltip, type TableProps } from "antd";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  DEFAULT_RESOURCE_COLOR,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  renderResourceIcon,
} from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { deduplicateByName } from "./constants";
import { ObjectTypeLogicAttributeEditDrawer } from "./ObjectTypeLogicAttributeEditDrawer";
import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeLogicAttributeEditor.module.css";

type ObjectTypeBasicInfo = {
  color: string;
  icon?: string;
  name: string;
};

export type ObjectTypeLogicAttributeEditorHandle = {
  validateFields: () => Promise<{ logicProperties: ObjectTypeLogicProperty[] }>;
};

type ObjectTypeLogicAttributeEditorProps = {
  basicValue: ObjectTypeBasicInfo;
  dataProperties: ObjectTypeDataProperty[];
  logicProperties: ObjectTypeLogicProperty[];
  onChange: (logicProperties: ObjectTypeLogicProperty[]) => void;
};

export const ObjectTypeLogicAttributeEditor = forwardRef<
  ObjectTypeLogicAttributeEditorHandle,
  ObjectTypeLogicAttributeEditorProps
>(function ObjectTypeLogicAttributeEditor(
  { basicValue, dataProperties, logicProperties, onChange },
  ref,
) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [localLogicProperties, setLocalLogicProperties] =
    useState<ObjectTypeLogicProperty[]>(logicProperties);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [attrInfo, setAttrInfo] = useState<ObjectTypeLogicProperty>({
    displayName: "",
    name: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      validateFields: () => Promise.resolve({ logicProperties: localLogicProperties }),
    }),
    [localLogicProperties],
  );

  useEffect(() => {
    if (!drawerOpen) {
      setLocalLogicProperties(logicProperties);
      setSelectedRowKeys([]);
    }
  }, [drawerOpen, logicProperties]);

  const filteredDataSource = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    if (!keyword) {
      return localLogicProperties;
    }

    return localLogicProperties.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.displayName.toLowerCase().includes(keyword),
    );
  }, [localLogicProperties, searchInput]);

  const syncProperties = (nextProperties: ObjectTypeLogicProperty[]) => {
    setLocalLogicProperties(nextProperties);
    onChange(nextProperties);
  };

  const handleAdd = () => {
    setAttrInfo({ displayName: "", name: "" });
    setDrawerOpen(true);
  };

  const handleEdit = (record: ObjectTypeLogicProperty) => {
    setAttrInfo(record);
    setDrawerOpen(true);
  };

  const handleDelete = (record?: ObjectTypeLogicProperty) => {
    void modal.confirm({
      title: t("common.delete"),
      content: record
        ? t("knowledgeNetwork.objectTypeLogicAttributeDeleteConfirm", { name: record.name })
        : t("knowledgeNetwork.objectTypeLogicAttributeDeleteConfirmMultiple", {
            count: selectedRowKeys.length,
          }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: () => {
        const nextProperties = record
          ? localLogicProperties.filter((item) => item.name !== record.name)
          : localLogicProperties.filter((item) => !selectedRowKeys.includes(item.name));
        syncProperties(nextProperties);
        setSelectedRowKeys([]);
        void message.success(t("common.success"));
      },
    });
  };

  const handleOk = (data: ObjectTypeLogicProperty) => {
    const isAddMode = !attrInfo?.name;

    if (isAddMode) {
      const nameExistsInDataProperties = dataProperties.some((item) => item.name === data.name);
      if (nameExistsInDataProperties) {
        void message.error(
          t("knowledgeNetwork.objectTypeLogicAttributeNameExists", { name: data.name }),
        );
        return;
      }
    }

    const nextProperties = isAddMode
      ? deduplicateByName([data, ...localLogicProperties])
      : deduplicateByName(
          localLogicProperties.map((item) => (item.name === attrInfo.name ? data : item)),
        );
    syncProperties(nextProperties);
    setDrawerOpen(false);
  };

  const columns: TableProps<ObjectTypeLogicProperty>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      render: (value: string) => <span className={styles.dataName}>{value}</span>,
      title: t("knowledgeNetwork.objectTypePropertyName"),
      width: 260,
    },
    {
      align: "center",
      key: "actions",
      render: (_value, record) => (
        <Dropdown
          menu={{
            items: [
              { key: "edit", label: t("common.edit") },
              { key: "delete", label: t("common.delete") },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "edit") {
                handleEdit(record);
              }
              if (key === "delete") {
                handleDelete(record);
              }
            },
          }}
          trigger={["click"]}
        >
          <AppButton
            aria-label={t("common.actions")}
            icon={<EllipsisOutlined style={{ fontSize: 20 }} />}
            onClick={(event) => event.stopPropagation()}
            type="text"
          />
        </Dropdown>
      ),
      title: t("common.actions"),
      width: 100,
    },
    {
      dataIndex: "displayName",
      key: "displayName",
      render: (value: string) => <span className={styles.dataName}>{value}</span>,
      title: t("knowledgeNetwork.objectTypePropertyDisplayName"),
      width: 260,
    },
    {
      dataIndex: "comment",
      ellipsis: true,
      key: "comment",
      render: (value?: string) => (
        <Tooltip title={value}>
          <span>{value || "--"}</span>
        </Tooltip>
      ),
      title: t("common.description"),
      width: 200,
    },
    {
      dataIndex: "dataSource",
      key: "bindResource",
      render: (_value, record) => {
        if (!record.parameters?.length || !record.dataSource) {
          return null;
        }

        return (
          <div className={styles.bindResourceCell}>
            <div className={styles.dataResource}>
              {record.dataSource.type === "metric" ? (
                <span className={styles.resourceIconMetric}>M</span>
              ) : (
                <span className={styles.resourceIconOperator}>O</span>
              )}
              <span className={styles.resourceName}>{record.dataSource.name || ""}</span>
            </div>
          </div>
        );
      },
      title: t("knowledgeNetwork.objectTypeBindResource"),
      width: 350,
    },
  ];

  return (
    <>
      <div className={styles.root}>
        <div className={styles.infoBar}>
          <span
            className={styles.infoIcon}
            style={{ backgroundColor: basicValue.color ?? DEFAULT_RESOURCE_COLOR }}
          >
            {renderResourceIcon(basicValue.icon)}
          </span>
          <span className={styles.infoName}>{basicValue.name}</span>
        </div>

        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.titleBox}>
              <div className={styles.title}>{t("knowledgeNetwork.objectTypeLogicProperty")}</div>
              <Tooltip title={t("knowledgeNetwork.objectTypeLogicPropertyTip")}>
                <QuestionCircleOutlined className={styles.helpIcon} />
              </Tooltip>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarActions}>
                <AppButton icon={<PlusOutlined />} onClick={handleAdd} type="primary">
                  {t("common.create")}
                </AppButton>
                <AppButton
                  danger
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => handleDelete()}
                >
                  {t("common.delete")}
                </AppButton>
              </div>
              <Input
                allowClear
                className={styles.searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("common.search")}
                value={searchInput}
              />
            </div>
            <Table<ObjectTypeLogicProperty>
              className={styles.propertyTable}
              columns={columns}
              dataSource={filteredDataSource}
              locale={{
                emptyText: searchInput ? (
                  <Empty description={t("knowledgeNetwork.objectTypePropertySearchEmpty")} />
                ) : (
                  <Empty
                    description={
                      <div>
                        <span>
                          {t("knowledgeNetwork.objectTypeLogicEmptyPrefix")}
                          <AppButton onClick={handleAdd} style={{ padding: 0 }} type="link">
                            {t("common.create")}
                          </AppButton>
                          {t("knowledgeNetwork.objectTypeLogicEmptySuffix")}
                        </span>
                        <div className={styles.emptyTip}>
                          {t("knowledgeNetwork.objectTypeSkipLogicPropertyTip")}
                        </div>
                      </div>
                    }
                  />
                ),
              }}
              onRow={(record) => ({
                onClick: () => handleEdit(record),
              })}
              pagination={false}
              rowKey="name"
              rowSelection={{
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
                selectedRowKeys,
              }}
              scroll={{ x: 1100, y: "calc(100vh - 280px)" }}
              size="middle"
            />
          </div>
        </div>
      </div>

      <ObjectTypeLogicAttributeEditDrawer
        allData={[
          ...dataProperties,
          ...localLogicProperties.map((item) => ({
            displayKey: false,
            displayName: item.displayName,
            incrementalKey: false,
            name: item.name,
            primaryKey: false,
            type: item.type ?? "string",
          })),
        ]}
        attrInfo={attrInfo}
        logicFields={localLogicProperties}
        onClose={() => setDrawerOpen(false)}
        onOk={handleOk}
        open={drawerOpen}
        title={
          attrInfo?.name
            ? t("knowledgeNetwork.objectTypeLogicAttributeMapping")
            : t("knowledgeNetwork.objectTypeLogicAttributeCreateTitle")
        }
      />
    </>
  );
});
