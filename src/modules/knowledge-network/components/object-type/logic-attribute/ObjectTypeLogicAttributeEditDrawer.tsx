/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Table,
  type TableColumnProps,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeToolSelectModal } from "@/modules/knowledge-network/components/action-type/ActionTypeToolSelectModal";
import {
  resolveActionTypeToolInputSchema,
  type ActionTypeCatalogSelection,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import {
  IDENTIFIER_PATTERN,
  LOGIC_ATTRIBUTE_TYPE_OPTIONS,
  PARAMETER_SOURCE_OPTIONS,
  VALUE_FROM_OPTIONS,
  buildToolLogicParameterSettings,
  extractLeafParams,
  isEmptyExceptZero,
} from "./constants";
import {
  listObjectTypeLogicMetricModels,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicAttributeType,
  ObjectTypeLogicMetricModelRecord,
  ObjectTypeLogicParameter,
  ObjectTypeLogicParameterValueFrom,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeLogicAttributeEditDrawer.module.css";

type SettingItem = ObjectTypeLogicParameter & {
  error?: Record<string, string>;
};

type ObjectTypeLogicAttributeEditDrawerProps = {
  allData: ObjectTypeDataProperty[];
  attrInfo: ObjectTypeLogicProperty;
  logicFields: ObjectTypeLogicProperty[];
  networkId: string;
  objectTypeId: string;
  onClose: () => void;
  onOk: (data: ObjectTypeLogicProperty) => void;
  open: boolean;
  title?: string;
};

type NameOption =
  | {
      label: string;
      options: Array<{
        analysisDimensions?: ObjectTypeLogicMetricModelRecord["analysisDimensions"];
        label: string;
        value: string;
      }>;
    };

type LogicAttributeFormValues = {
  boxId?: string;
  comment?: string;
  displayName?: string;
  name?: string;
  resultPath?: string;
  resourceId?: string;
  resourceName?: string;
  toolId?: string;
  type?: ObjectTypeLogicAttributeType;
};

function createParameterId() {
  return `param-${Math.random().toString(36).slice(2, 10)}`;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function ObjectTypeLogicAttributeEditDrawer({
  allData,
  attrInfo,
  logicFields,
  networkId,
  objectTypeId,
  onClose,
  onOk,
  open,
  title,
}: ObjectTypeLogicAttributeEditDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<LogicAttributeFormValues>();
  const [nameOptions, setNameOptions] = useState<NameOption[]>([]);
  const [settingList, setSettingList] = useState<SettingItem[]>([]);
  const [metricModelList, setMetricModelList] = useState<ObjectTypeLogicMetricModelRecord[]>([]);
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);
  const type = Form.useWatch("type", form);
  const resourceId = Form.useWatch("resourceId", form);
  const optionsRequestIdRef = useRef(0);
  const isDisplayNameManuallyEdited = useRef(false);
  const isAddMode = !attrInfo?.name;
  const getStringFieldValue = (name: keyof LogicAttributeFormValues) =>
    asOptionalString(form.getFieldValue(name));

  const logicAttributeTypeOptions = useMemo(
    () =>
      LOGIC_ATTRIBUTE_TYPE_OPTIONS.map((item) => ({
        label: t(`knowledgeNetwork.${item.labelKey}`),
        value: item.value,
      })),
    [t],
  );

  const valueFromOptions = useMemo(
    () =>
      VALUE_FROM_OPTIONS.map((item) => ({
        label: t(`knowledgeNetwork.${item.labelKey}`),
        value: item.value,
      })),
    [t],
  );

  const parameterSourceOptions = useMemo(
    () =>
      PARAMETER_SOURCE_OPTIONS.map((item) => ({
        label: t(`knowledgeNetwork.${item.labelKey}`),
        value: item.value,
      })),
    [t],
  );

  const objectTypePropertyOptions = useMemo(
    () =>
      allData.map((item) => ({
        comment: item.comment,
        displayName: item.displayName || item.name,
        label: item.displayName || item.name,
        name: item.name,
        type: item.type,
        value: item.name,
      })),
    [allData],
  );

  const propertyOptions = useMemo(
    () => {
      const propertyNames = logicFields.map((item) => item.name);
      return objectTypePropertyOptions.map((item) => ({
        disabled:
          propertyNames.includes(item.name) || (!isAddMode && item.name === attrInfo.name),
        label: item.label,
        type: item.type,
        value: item.value,
      }));
    },
    [attrInfo.name, isAddMode, logicFields, objectTypePropertyOptions],
  );

  const objectTypePropertyNameSet = useMemo(
    () => new Set(allData.map((item) => item.name)),
    [allData],
  );

  const selectedMetric = useMemo(
    () => metricModelList.find((item) => item.id === resourceId),
    [metricModelList, resourceId],
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSettingList([]);
      return;
    }

    let cancelled = false;
    isDisplayNameManuallyEdited.current = false;

    if (attrInfo?.dataSource?.type === "tool") {
      form.setFieldsValue({
        boxId: attrInfo.dataSource.boxId,
        comment: attrInfo.comment,
        displayName: attrInfo.displayName,
        name: attrInfo.name,
        resultPath: attrInfo.dataSource.resultPath,
        resourceName: attrInfo.dataSource.name,
        toolId: attrInfo.dataSource.toolId,
        type: attrInfo.dataSource.type,
      });
      setSettingList([]);

      if (attrInfo.dataSource.boxId && attrInfo.dataSource.toolId) {
        const source = {
          boxId: attrInfo.dataSource.boxId,
          toolId: attrInfo.dataSource.toolId,
          toolName: attrInfo.dataSource.name ?? "",
          type: "tool" as const,
        };
        void resolveActionTypeToolInputSchema(source).then((inputParams) => {
          if (cancelled) {
            return;
          }
          setSettingList(
            buildToolLogicParameterSettings(
              inputParams,
              attrInfo.parameters ?? [],
              createParameterId,
            ),
          );
        });
      } else {
        setSettingList(attrInfo.parameters ?? []);
      }
    } else if (attrInfo?.dataSource?.id) {
      form.setFieldsValue({
        comment: attrInfo.comment,
        displayName: attrInfo.displayName,
        name: attrInfo.name,
        resourceId: attrInfo.dataSource.id,
        type: attrInfo.dataSource.type,
      });
    } else if (attrInfo?.name) {
      form.setFieldsValue({
        comment: attrInfo.comment,
        displayName: attrInfo.displayName,
        name: attrInfo.name,
      });
    } else {
      form.resetFields();
      form.setFieldValue("type", "metric");
    }

    if (attrInfo?.dataSource?.type === "metric") {
      setSettingList([]);
    }

    return () => {
      cancelled = true;
    };
  }, [attrInfo, form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestId = ++optionsRequestIdRef.current;
    setNameOptions([]);

    void (async () => {
      if (type === "metric") {
        if (!networkId || !objectTypeId) {
          setMetricModelList([]);
          setNameOptions([]);
          return;
        }

        const models = await listObjectTypeLogicMetricModels(networkId, objectTypeId);
        if (requestId !== optionsRequestIdRef.current) {
          return;
        }
        setMetricModelList(models);
        const grouped = models.reduce<Record<string, ObjectTypeLogicMetricModelRecord[]>>(
          (acc, item) => {
            const key = item.groupName || t("knowledgeNetwork.objectTypeLogicAttributeUngrouped");
            acc[key] = [...(acc[key] ?? []), item];
            return acc;
          },
          {},
        );
        setNameOptions(
          Object.entries(grouped).map(([groupName, entries]) => ({
            label: groupName,
            options: entries.map((item) => ({
              analysisDimensions: item.analysisDimensions,
              label: item.name,
              value: item.id,
            })),
          })),
        );
        return;
      }

    })();
  }, [networkId, objectTypeId, open, t, type]);

  const updateSettingData = (id: string, updateValue: Partial<SettingItem>) => {
    const processNode = (item: SettingItem): SettingItem => {
      if (item.id === id) {
        return { ...item, ...updateValue, error: {} };
      }
      if (item.children?.length) {
        return {
          ...item,
          children: item.children.map(processNode),
        };
      }
      return item;
    };
    setSettingList((prev) => prev.map(processNode));
  };

  const handleResourceChange = () => {
    setSettingList([]);
  };

  const addToolParameter = () => {
    setSettingList((prev) => [
      ...prev,
      {
        id: createParameterId(),
        name: "",
        source: "body",
        type: "string",
        valueFrom: "input",
      },
    ]);
  };

  const handleToolSelect = async (selection: ActionTypeCatalogSelection) => {
    if (selection.kind !== "tool") {
      return;
    }

    const source = {
      boxId: selection.boxId,
      toolId: selection.tool.toolId,
      toolName: selection.tool.toolName,
      type: "tool" as const,
    };
    const inputParams = await resolveActionTypeToolInputSchema(source);
    setSettingList(
      buildToolLogicParameterSettings(inputParams, [], createParameterId),
    );
    form.setFieldsValue({
      boxId: selection.boxId,
      resourceName: selection.tool.toolName,
      toolId: selection.tool.toolId,
    });
    setToolSelectorOpen(false);
  };

  const validateParams = () => {
    let hasError = false;
    if (settingList.length === 0) {
      hasError = true;
    }

    const validateNode = (node: SettingItem): SettingItem => {
      const nextNode = node.children?.length
        ? { ...node, children: node.children.map(validateNode) }
        : node;

      if (!nextNode.children?.length) {
        const nameError = !nextNode.name ? t("knowledgeNetwork.objectTypeLogicValueRequired") : "";
        const valueError =
          nextNode.valueFrom === "property"
            ? typeof nextNode.value !== "string" || !nextNode.value
              ? t("knowledgeNetwork.objectTypeLogicValueRequired")
              : !objectTypePropertyNameSet.has(nextNode.value)
                ? t("knowledgeNetwork.objectTypeLogicAttributeMatchedPropertyMissing")
                : ""
            : nextNode.valueFrom !== "input" && isEmptyExceptZero(nextNode.value)
              ? t("knowledgeNetwork.objectTypeLogicValueRequired")
              : ""
        if (nameError || valueError) {
          hasError = true;
        }
        return {
          ...nextNode,
          error: {
            name: nameError,
            value: valueError,
          },
        };
      }

      return nextNode;
    };

    setSettingList((prev) => prev.map(validateNode));
    return hasError;
  };

  const handleSubmit = async () => {
    await form.validateFields();
    if (!type) {
      return;
    }
    const formValues = form.getFieldsValue();
    if (
      (type !== "tool" && !resourceId) ||
      (type === "tool" && (!formValues.boxId || !formValues.toolId))
    ) {
      return;
    }
    if (type === "tool" && settingList.length > 0 && validateParams()) {
      void message.error(t("knowledgeNetwork.objectTypeLogicAttributeFillParameters"));
      return;
    }

    const resourceName =
      type === "metric"
        ? metricModelList.find((item) => item.id === resourceId)?.name
        : formValues.resourceName;

    onOk({
      comment: formValues.comment,
      dataSource: {
        boxId: formValues.boxId,
        id: type === "tool" ? undefined : resourceId,
        name: resourceName ?? "",
        resultPath: formValues.resultPath,
        toolId: formValues.toolId,
        type,
      },
      displayName: formValues.displayName ?? "",
      name: formValues.name ?? "",
      parameters:
        type === "metric"
          ? []
          : extractLeafParams(settingList).map((item) => {
              const { error, children, ...parameter } = item;
              void error;
              void children;
              return parameter;
            }),
      type,
    });
  };

  const toolParameterColumns: TableColumnProps<SettingItem>[] = [
    {
      dataIndex: "name",
      ellipsis: true,
      key: "name",
      render: (value: string, record: SettingItem) => (
        <div>
          {type === "tool" && !record.children?.length ? (
            <Input
              onChange={(event) => updateSettingData(record.id, { name: event.target.value })}
              status={record.error?.name ? "error" : undefined}
              value={value}
            />
          ) : (
            <div title={value}>{value}</div>
          )}
          <div className={styles.description} title={record.description}>
            {record.description}
          </div>
        </div>
      ),
      title: t("common.name"),
      width: 240,
    },
    {
      dataIndex: "type",
      key: "type",
      render: (value: string, record: SettingItem) =>
        type === "tool" && !record.children?.length ? (
          <Input
            onChange={(event) => updateSettingData(record.id, { type: event.target.value })}
            value={value}
          />
        ) : (
          value
        ),
      title: t("knowledgeNetwork.objectTypePropertyType"),
      width: 100,
    },
    {
      dataIndex: "source",
      key: "source",
      render: (value: string, record: SettingItem) =>
        type === "tool" && !record.children?.length ? (
          <Select
            onChange={(source: string) => updateSettingData(record.id, { source })}
            options={parameterSourceOptions}
            value={value}
          />
        ) : (
          value
        ),
      title: t("knowledgeNetwork.objectTypeParameterSource"),
      width: 100,
    },
    {
      dataIndex: "valueFrom",
      key: "valueFrom",
      render: (_, record) =>
        record.children?.length ? null : (
          <Select
            onChange={(valueFrom: ObjectTypeLogicParameterValueFrom) => {
              updateSettingData(record.id, { value: undefined, valueFrom });
            }}
            options={valueFromOptions}
            placeholder={t("knowledgeNetwork.pleaseSelect")}
            style={{ width: "100%" }}
            value={record.valueFrom}
          />
        ),
      title: t("knowledgeNetwork.objectTypeLogicValueFrom"),
      width: 156,
    },
    {
      dataIndex: "value",
      key: "value",
      render: (_, record) => {
        if (record.children?.length) {
          return null;
        }

        if (record.valueFrom === "input") {
          return <Input disabled style={{ width: "100%" }} />;
        }

        if (record.valueFrom === "const") {
          return (
            <Input
              onChange={(event) => updateSettingData(record.id, { value: event.target.value })}
              placeholder={t("knowledgeNetwork.pleaseInput")}
              status={record.error?.value ? "error" : undefined}
              style={{ width: "100%" }}
              value={record.value as string | undefined}
            />
          );
        }

        return (
          <Select
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onChange={(value) => updateSettingData(record.id, { value })}
            options={propertyOptions}
            placeholder={t("knowledgeNetwork.pleaseSelect")}
            showSearch
            status={record.error?.value ? "error" : undefined}
            style={{ width: "100%" }}
            value={(record.value as string | undefined) || undefined}
          />
        );
      },
      title: t("knowledgeNetwork.objectTypeLogicValue"),
      width: 278,
    },
  ];

  return (
    <Drawer
      className={styles.drawer}
      destroyOnClose
      footer={
        <div className={styles.footer}>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton onClick={() => void handleSubmit()} type="primary">
            {t("common.ok")}
          </AppButton>
        </div>
      }
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={title}
      width={1000}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyName")}
              name="name"
              rules={[
                { message: t("knowledgeNetwork.pleaseInput"), required: true },
                {
                  message: t("knowledgeNetwork.objectTypeIdPattern"),
                  pattern: IDENTIFIER_PATTERN,
                },
              ]}
            >
              <Input
                disabled={!isAddMode}
                onChange={(event) => {
                  if (!isDisplayNameManuallyEdited.current) {
                    form.setFieldValue("displayName", event.target.value);
                  }
                }}
                placeholder={t("knowledgeNetwork.pleaseInput")}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyDisplayName")}
              name="displayName"
              rules={[{ message: t("knowledgeNetwork.pleaseInput"), required: true }]}
            >
              <Input
                disabled={!isAddMode}
                onChange={() => {
                  isDisplayNameManuallyEdited.current = true;
                }}
                placeholder={t("knowledgeNetwork.pleaseInput")}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyType")}
              name="type"
              rules={[{ required: true }]}
            >
              <Select
                onChange={() => {
                  setSettingList([]);
                  form.setFieldsValue({
                    boxId: undefined,
                    resourceName: undefined,
                    resultPath: undefined,
                    toolId: undefined,
                  });
                  form.setFieldValue("resourceId", undefined);
                }}
                options={logicAttributeTypeOptions}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            {type === "tool" ? (
              <Form.Item label={t("knowledgeNetwork.objectTypeLogicAttributeResource")}>
                <Input
                  onClick={() => setToolSelectorOpen(true)}
                  placeholder={t("knowledgeNetwork.objectTypeLogicToolSelect")}
                  readOnly
                  value={getStringFieldValue("resourceName")}
                />
              </Form.Item>
            ) : (
              <Form.Item
                label={t("knowledgeNetwork.objectTypeLogicAttributeResource")}
                name="resourceId"
                rules={[{ message: t("knowledgeNetwork.pleaseSelect"), required: true }]}
              >
                <Select
                  allowClear
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={handleResourceChange}
                  options={nameOptions}
                  placeholder={t("knowledgeNetwork.pleaseSelect")}
                  showSearch
                />
              </Form.Item>
            )}
          </Col>
        </Row>
        {type === "tool" ? (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                extra={t("knowledgeNetwork.objectTypeLogicResultPathHint")}
                label={t("knowledgeNetwork.objectTypeLogicResultPath")}
                name="resultPath"
              >
                <Input placeholder="$.data.result" />
              </Form.Item>
            </Col>
          </Row>
        ) : null}
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label={t("common.description")} name="comment">
              <Input.TextArea
                autoSize={{ maxRows: 7, minRows: 3 }}
                maxLength={1000}
                placeholder={t("knowledgeNetwork.pleaseInput")}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {type === "tool" ? (
        <>
          <div className={styles.settingTitle}>
            {t("knowledgeNetwork.objectTypeLogicAttributeSetting")}
            {type === "tool" ? (
              <AppButton onClick={addToolParameter} style={{ marginLeft: 8 }} type="link">
                {t("common.create")}
              </AppButton>
            ) : null}
          </div>
        </>
      ) : null}

      {type === "tool" ? (
        <Table
          columns={toolParameterColumns}
          dataSource={settingList}
          expandable={{ defaultExpandAllRows: true }}
          pagination={false}
          rowKey="id"
        />
      ) : null}

      {type === "metric" ? (
        <div className={styles.metricSummary}>
          <div className={styles.metricSummaryTitle}>
            {t("knowledgeNetwork.objectTypeLogicMetricBindingTitle")}
          </div>
          <div className={styles.metricSummaryHint}>
            {t("knowledgeNetwork.objectTypeLogicMetricBindingHint")}
          </div>
          {selectedMetric?.analysisDimensions.length ? (
            <div className={styles.metricSummaryRow}>
              <span>{t("knowledgeNetwork.objectTypeLogicMetricAnalysisDimensions")}</span>
              <div className={styles.metricDimensionList}>
                {selectedMetric.analysisDimensions.map((item) => (
                  <span className={styles.metricDimensionTag} key={item.name}>
                    {item.displayName || item.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <ActionTypeToolSelectModal
        allowedKinds={["tool"]}
        onCancel={() => setToolSelectorOpen(false)}
        onConfirm={(_source, selection) => void handleToolSelect(selection)}
        open={toolSelectorOpen}
        value={
          type === "tool" && getStringFieldValue("toolId")
            ? {
                boxId: getStringFieldValue("boxId"),
                toolId: getStringFieldValue("toolId") ?? "",
                toolName: getStringFieldValue("resourceName"),
                type: "tool",
              }
            : undefined
        }
      />
    </Drawer>
  );
}
