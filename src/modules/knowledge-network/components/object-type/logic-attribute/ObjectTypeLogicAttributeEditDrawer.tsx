/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { MinusCircleOutlined } from "@ant-design/icons";
import {
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
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
  FIELD_TYPE_INPUT,
  IDENTIFIER_PATTERN,
  LOGIC_ATTRIBUTE_TYPE_OPTIONS,
  OPERATOR_TYPE_OPTIONS,
  VALUE_FROM_OPTIONS,
  extractLeafParams,
  isEmptyExceptZero,
} from "./constants";
import {
  listObjectTypeLogicMetricModelFields,
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
  const [dimensionFields, setDimensionFields] = useState<
    Array<{ label: string; type: string; value: string }>
  >([]);
  const [metricModelList, setMetricModelList] = useState<ObjectTypeLogicMetricModelRecord[]>([]);
  const type = Form.useWatch("type", form);
  const resourceId = Form.useWatch("resourceId", form);
  const optionsRequestIdRef = useRef(0);
  const metricFieldsRequestIdRef = useRef(0);
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

  const propertyOptions = useMemo(
    () => {
      const propertyNames = logicFields.map((item) => item.name);
      return allData.map((item) => ({
        disabled:
          propertyNames.includes(item.name) || (!isAddMode && item.name === attrInfo.name),
        label: item.name,
        type: item.type,
        value: item.name,
      }));
    },
    [allData, attrInfo.name, isAddMode, logicFields],
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
      form.setFieldValue("type", "operator");
    }

    if (attrInfo?.parameters?.length && attrInfo.dataSource?.type === "metric") {
      setSettingList(
        attrInfo.parameters.map((item) => ({
          ...item,
          id: item.id || createParameterId(),
        })),
      );
    }
  }, [attrInfo, form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestId = ++optionsRequestIdRef.current;
    setNameOptions([]);
    setFlatNameOptions([]);
    setDimensionFields([]);

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

  useEffect(() => {
    if (!open || type !== "metric" || !resourceId) {
      return;
    }

    const requestId = ++metricFieldsRequestIdRef.current;
    void (async () => {
      const selectedMetric = metricModelList.find((item) => item.id === resourceId);
      if (selectedMetric?.analysisDimensions.length) {
        setDimensionFields(
          selectedMetric.analysisDimensions.map((item) => ({
            label: item.displayName,
            type: item.type,
            value: item.name,
          })),
        );
        return;
      }

      const fields = await listObjectTypeLogicMetricModelFields(networkId, resourceId);
      if (requestId !== metricFieldsRequestIdRef.current) {
        return;
      }
      setDimensionFields(
        fields.map((item) => ({
          label: item.displayName,
          type: item.type,
          value: item.name,
        })),
      );
    })();
  }, [metricModelList, networkId, open, resourceId, type]);

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

  const handleAddMetricRow = () => {
    setSettingList((prev) => [
      ...prev,
      {
        id: createParameterId(),
        name: "",
        operation: "==",
        valueFrom: "property",
      },
    ]);
  };

  const handleDeleteMetricRow = (id: string) => {
    setSettingList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResourceChange = (value?: string) => {
    if (type === "metric" && value) {
      setSettingList([
        {
          id: createParameterId(),
          name: "",
          operation: "==",
          valueFrom: "property",
        },
      ]);
      return;
    }
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
          nextNode.valueFrom !== "input" && isEmptyExceptZero(nextNode.value)
            ? t("knowledgeNetwork.objectTypeLogicValueRequired")
            : "";
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
    if (validateParams()) {
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
      parameters: extractLeafParams(settingList).map((item) => {
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
                onChange={(value) =>
                  handleResourceChange(typeof value === "string" ? value : undefined)
                }
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

      {settingList.length > 0 ? (
        <div className={styles.settingTitle}>{t("knowledgeNetwork.objectTypeLogicAttributeSetting")}</div>
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
        <>
          {settingList.map((item) => (
            <div className={styles.metricRow} key={item.id}>
              <div style={{ width: 24 }}>
                {!item.ifSystemGenerate ? (
                  <MinusCircleOutlined
                    onClick={() => handleDeleteMetricRow(item.id)}
                    style={{ color: "rgba(0, 0, 0, 0.25)", cursor: "pointer" }}
                  />
                ) : null}
              </div>
              <Select
                disabled={item.ifSystemGenerate}
                onChange={(value) => {
                  const fieldType = dimensionFields.find((field) => field.value === value)?.type;
                  updateSettingData(item.id, { name: value, type: fieldType, value: undefined });
                }}
                options={dimensionFields}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
                status={item.error?.name ? "error" : undefined}
                style={{ width: 256 }}
                value={item.name || undefined}
              />
              <Select
                disabled={item.ifSystemGenerate}
                onChange={(value) => updateSettingData(item.id, { operation: value })}
                options={OPERATOR_TYPE_OPTIONS}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
                style={{ width: 120 }}
                value={item.operation}
              />
              <Select
                disabled={item.ifSystemGenerate}
                onChange={(value: ObjectTypeLogicParameterValueFrom) =>
                  updateSettingData(item.id, { value: undefined, valueFrom: value })
                }
                options={valueFromOptions}
                style={{ width: 120 }}
                value={item.valueFrom || undefined}
              />
              {item.valueFrom === "property" ? (
                <Select
                  onChange={(value) => {
                    const fieldType = propertyOptions.find((option) => option.value === value)?.type;
                    updateSettingData(item.id, { type: fieldType, value });
                  }}
                  options={propertyOptions}
                  placeholder={t("knowledgeNetwork.pleaseSelect")}
                  status={item.error?.value ? "error" : undefined}
                  style={{ width: 400 }}
                  value={(item.value as string | undefined) || undefined}
                />
              ) : null}
              {item.valueFrom === "const" ? (
                FIELD_TYPE_INPUT.number.includes(item.type ?? "") ? (
                  <InputNumber
                    onChange={(value) => updateSettingData(item.id, { value: value ?? undefined })}
                    placeholder={t("knowledgeNetwork.pleaseInput")}
                    status={item.error?.value ? "error" : undefined}
                    style={{ width: 400 }}
                    value={item.value as number | undefined}
                  />
                ) : FIELD_TYPE_INPUT.boolean.includes(item.type ?? "") ? (
                  <Select
                    onChange={(value) => updateSettingData(item.id, { value })}
                    options={[
                      { label: t("knowledgeNetwork.objectTypeLogicYes"), value: true },
                      { label: t("knowledgeNetwork.objectTypeLogicNo"), value: false },
                    ]}
                    placeholder={t("knowledgeNetwork.pleaseSelect")}
                    status={item.error?.value ? "error" : undefined}
                    style={{ width: 400 }}
                    value={item.value as boolean | undefined}
                  />
                ) : (
                  <Input
                    onChange={(event) => updateSettingData(item.id, { value: event.target.value })}
                    placeholder={t("knowledgeNetwork.pleaseInput")}
                    status={item.error?.value ? "error" : undefined}
                    style={{ width: 400 }}
                    value={item.value as string | undefined}
                  />
                )
              ) : null}
              {item.valueFrom === "input" ? <Input disabled style={{ width: 400 }} /> : null}
            </div>
          ))}

          {dimensionFields.length > 0 && settingList.length > 0 ? (
            <div className={styles.addRow} onClick={handleAddMetricRow}>
              <PlusOutlinedLabel />
              <span>{t("common.add")}</span>
            </div>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}

function PlusOutlinedLabel() {
  return <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>;
}
