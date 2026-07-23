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
import {
  IDENTIFIER_PATTERN,
  LOGIC_ATTRIBUTE_TYPE_OPTIONS,
  VALUE_FROM_OPTIONS,
  extractLeafParams,
  isEmptyExceptZero,
} from "./constants";
import {
  listObjectTypeLogicMetricModels,
  listObjectTypeLogicOperators,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicAttributeType,
  ObjectTypeLogicMetricModelRecord,
  ObjectTypeLogicOperatorRecord,
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
    }
  | {
      apiSpec?: unknown;
      inputParameters?: ObjectTypeLogicOperatorRecord["inputParameters"];
      label: string;
      value: string;
    };

type LogicAttributeFormValues = {
  comment?: string;
  displayName?: string;
  name?: string;
  resourceId?: string;
  type?: ObjectTypeLogicAttributeType;
};

function createParameterId() {
  return `param-${Math.random().toString(36).slice(2, 10)}`;
}

function processOperatorNode(
  item: NonNullable<ObjectTypeLogicOperatorRecord["inputParameters"]>[number],
  existingParams: ObjectTypeLogicParameter[],
): SettingItem {
  const matchedParam = existingParams.find((param) => param.name === item.key);
  return {
    description: item.description,
    id: createParameterId(),
    name: item.key,
    source: item.source,
    type: item.type,
    value: matchedParam?.value,
    valueFrom: matchedParam?.valueFrom ?? "input",
    children: item.children?.map((child) => processOperatorNode(child, existingParams)),
  };
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
  const [flatNameOptions, setFlatNameOptions] = useState<
    Array<{ label: string; value: string; apiSpec?: unknown; inputParameters?: ObjectTypeLogicOperatorRecord["inputParameters"] }>
  >([]);
  const [settingList, setSettingList] = useState<SettingItem[]>([]);
  const [metricModelList, setMetricModelList] = useState<ObjectTypeLogicMetricModelRecord[]>([]);
  const type = Form.useWatch("type", form);
  const resourceId = Form.useWatch("resourceId", form);
  const optionsRequestIdRef = useRef(0);
  const isDisplayNameManuallyEdited = useRef(false);
  const isAddMode = !attrInfo?.name;

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

    isDisplayNameManuallyEdited.current = false;

    if (attrInfo?.dataSource?.id) {
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
  }, [attrInfo, form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestId = ++optionsRequestIdRef.current;
    setNameOptions([]);
    setFlatNameOptions([]);

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

      if (type === "operator") {
        const operators = await listObjectTypeLogicOperators();
        if (requestId !== optionsRequestIdRef.current) {
          return;
        }
        const flat = operators.map((item) => ({
          apiSpec: item.apiSpec,
          inputParameters: item.inputParameters,
          label: item.name,
          value: item.id,
        }));
        setFlatNameOptions(flat);
        setNameOptions(flat);
      }
    })();
  }, [networkId, objectTypeId, open, t, type]);

  useEffect(() => {
    if (!open || type !== "operator" || !resourceId || flatNameOptions.length === 0) {
      return;
    }

    const operator = flatNameOptions.find((item) => item.value === resourceId);
    if (!operator?.inputParameters?.length) {
      setSettingList([]);
      return;
    }

    const existingParams = attrInfo.parameters ?? [];
    setSettingList(operator.inputParameters.map((item) => processOperatorNode(item, existingParams)));
  }, [attrInfo.parameters, flatNameOptions, open, resourceId, type]);

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
    if (!resourceId || !type) {
      return;
    }
    if (type === "operator" && validateParams()) {
      void message.error(t("knowledgeNetwork.objectTypeLogicAttributeFillParameters"));
      return;
    }

    const formValues = form.getFieldsValue();
    const resourceName =
      type === "metric"
        ? metricModelList.find((item) => item.id === resourceId)?.name
        : flatNameOptions.find((item) => item.value === resourceId)?.label;

    onOk({
      comment: formValues.comment,
      dataSource: {
        id: resourceId,
        name: resourceName ?? "",
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

  const operatorColumns: TableColumnProps<SettingItem>[] = [
    {
      dataIndex: "name",
      ellipsis: true,
      key: "name",
      render: (value: string, record: SettingItem) => (
        <div>
          <div title={value}>{value}</div>
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
      title: t("knowledgeNetwork.objectTypePropertyType"),
      width: 100,
    },
    {
      dataIndex: "source",
      key: "source",
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
                  form.setFieldValue("resourceId", undefined);
                }}
                options={logicAttributeTypeOptions}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
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
          </Col>
        </Row>
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

      {type === "operator" && settingList.length > 0 ? (
        <>
          <div className={styles.settingTitle}>
            {t("knowledgeNetwork.objectTypeLogicAttributeSetting")}
          </div>
        </>
      ) : null}

      {type === "operator" ? (
        <Table
          columns={operatorColumns}
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
    </Drawer>
  );
}
