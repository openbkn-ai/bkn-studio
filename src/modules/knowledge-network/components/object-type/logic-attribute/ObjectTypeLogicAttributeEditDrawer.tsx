/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Col, Drawer, Form, Input, Row, Select, Table, type TableColumnProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CypherEditor } from "@/modules/knowledge-network/components/cypher/CypherEditor";
import type { CypherCompletionSchema } from "@/modules/knowledge-network/cypher/cypher-completion";
import { errorMarkFrom, type CypherErrorMark } from "@/modules/knowledge-network/cypher/error-mark";
import {
  isPropertyDisplayNameWithinLimit,
  PROPERTY_DISPLAY_NAME_COUNT,
  PROPERTY_DISPLAY_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
import {
  coerceSampleValue,
  logicValueFrom,
} from "@/modules/knowledge-network/lib/logic-statement-trial";
import { runCypherQuery } from "@/modules/knowledge-network/cypher/cypher-query.service";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/network.service";
import {
  IDENTIFIER_PATTERN,
  VALUE_FROM_OPTIONS,
  buildDefaultLogicStatement,
  isEmptyExceptZero,
  localStatementProblem,
  syncLogicParameters,
} from "./constants";
import type {
  ObjectTypeDataProperty,
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
  networkId?: string;
  objectTypeId?: string;
  onClose: () => void;
  onOk: (data: ObjectTypeLogicProperty) => void;
  open: boolean;
  title?: string;
};

type LogicAttributeFormValues = {
  comment?: string;
  displayName?: string;
  name?: string;
};

type TrialState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; value: unknown }
  | { message: string; status: "error" };

function createParameterId() {
  return `param-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTrialValue(value: unknown) {
  if (value === null || value === undefined) return "null";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function ObjectTypeLogicAttributeEditDrawer({
  allData,
  attrInfo,
  logicFields,
  networkId = "",
  objectTypeId = "",
  onClose,
  onOk,
  open,
  title,
}: ObjectTypeLogicAttributeEditDrawerProps) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const [form] = Form.useForm<LogicAttributeFormValues>();
  const [settingList, setSettingList] = useState<SettingItem[]>([]);
  const [statement, setStatement] = useState("");
  const [statementError, setStatementError] = useState<string | null>(null);
  const [errorMark, setErrorMark] = useState<CypherErrorMark | null>(null);
  const [checking, setChecking] = useState(false);
  const [knId, setKnId] = useState("");
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [trial, setTrial] = useState<TrialState>({ status: "idle" });
  const isDisplayNameManuallyEdited = useRef(false);
  const isAddMode = !attrInfo?.name;
  // A saved `tool` source is retired: it is shown, not edited.
  const isRetiredTool = attrInfo?.dataSource?.type === "tool";

  const dataProperties = useMemo(
    () => allData.filter((item) => !logicFields.some((logic) => logic.name === item.name)),
    [allData, logicFields],
  );
  const primaryKeys = useMemo(
    () => dataProperties.filter((item) => item.primaryKey).map((item) => item.name),
    [dataProperties],
  );
  const canRun = Boolean(objectTypeId && networkId);

  const valueFromOptions = useMemo(
    () =>
      VALUE_FROM_OPTIONS.map((item) => ({
        label: t(`knowledgeNetwork.${item.labelKey}`),
        value: item.value,
      })),
    [t],
  );

  const objectTypePropertyNameSet = useMemo(
    () => new Set(dataProperties.map((item) => item.name)),
    [dataProperties],
  );

  const propertyOptions = useMemo(
    () =>
      dataProperties.map((item) => ({
        label: item.displayName || item.name,
        value: item.name,
      })),
    [dataProperties],
  );

  const completionSchema = useMemo<CypherCompletionSchema>(
    () => ({
      objectTypes: objectTypeId ? [{ id: objectTypeId, name: objectTypeId }] : [],
      properties: objectTypeId
        ? {
            [objectTypeId]: dataProperties.map((item) => ({
              displayName: item.displayName,
              name: item.name,
            })),
          }
        : {},
      relationTypes: [],
    }),
    [dataProperties, objectTypeId],
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSettingList([]);
      setStatement("");
      setStatementError(null);
      setErrorMark(null);
      setSamples({});
      setTrial({ status: "idle" });
      return;
    }
    isDisplayNameManuallyEdited.current = false;

    if (attrInfo?.dataSource?.type === "cypher") {
      form.setFieldsValue({
        comment: attrInfo.comment,
        displayName: attrInfo.displayName,
        name: attrInfo.name,
      });
      setStatement(attrInfo.dataSource.statement ?? "");
      setSettingList(attrInfo.parameters ?? []);
    } else if (attrInfo?.name) {
      // A retired `tool` source: shown as it was saved.
      form.setFieldsValue({
        comment: attrInfo.comment,
        displayName: attrInfo.displayName,
        name: attrInfo.name,
      });
      setSettingList(attrInfo.parameters ?? []);
    } else {
      form.resetFields();
      const initial = buildDefaultLogicStatement({ objectTypeId, primaryKeys });
      setStatement(initial);
      setSettingList(
        syncLogicParameters({
          createId: createParameterId,
          current: [],
          primaryKeys,
          statement: initial,
        }),
      );
    }
    // The statement and bindings start once per opening; later changes come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrInfo, form, open]);

  useEffect(() => {
    if (!open || !networkId || isRetiredTool) return;
    let cancelled = false;
    void getKnowledgeNetwork(networkId, { skipErrorToast: true })
      .then((network) => {
        if (!cancelled && network) setKnId(network.identifier || network.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isRetiredTool, networkId, open]);

  const handleStatementChange = (value: string) => {
    setStatement(value);
    setStatementError(null);
    setErrorMark(null);
    setTrial({ status: "idle" });
    setSettingList((current) =>
      syncLogicParameters({
        createId: createParameterId,
        current,
        primaryKeys,
        statement: value,
      }),
    );
  };

  const updateSettingData = (id: string, updateValue: Partial<SettingItem>) => {
    setSettingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updateValue, error: {} } : item)),
    );
  };

  const validateParams = () => {
    let hasError = false;
    const next = settingList.map((item) => {
      const valueError =
        item.valueFrom === "property"
          ? typeof item.value !== "string" || !item.value
            ? t("knowledgeNetwork.objectTypeLogicValueRequired")
            : !objectTypePropertyNameSet.has(item.value)
              ? t("knowledgeNetwork.objectTypeLogicAttributeMatchedPropertyMissing")
              : ""
          : item.valueFrom === "const" && isEmptyExceptZero(item.value)
            ? t("knowledgeNetwork.objectTypeLogicValueRequired")
            : "";
      if (valueError) hasError = true;
      return { ...item, error: { value: valueError } };
    });
    setSettingList(next);
    return hasError;
  };

  const sampleFor = (item: SettingItem): unknown => {
    const propertyType =
      item.valueFrom === "property"
        ? dataProperties.find((property) => property.name === item.value)?.type
        : item.type;
    const raw = item.valueFrom === "const" ? String(item.value ?? "") : (samples[item.name] ?? "");
    return coerceSampleValue(raw, propertyType);
  };

  const tokenProvider = useMemo(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );

  /** Plans the statement (`explain`) or runs it with the sample values; null when it passes. */
  const runStatement = async (explain: boolean): Promise<TrialState | null> => {
    const local = localStatementProblem(statement);
    if (local) return { message: t(`knowledgeNetwork.${local}`), status: "error" };
    if (!canRun || !knId) return null;
    const parameters = Object.fromEntries(settingList.map((item) => [item.name, sampleFor(item)]));
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const run = await runCypherQuery({
        auth: tokenProvider,
        env: { base, knId, token: tokenProvider.getToken() },
        explain,
        parameters,
        query: statement,
      });
      if (!run.ok) {
        setErrorMark(errorMarkFrom(run.error.message, statement));
        return { message: run.error.message, status: "error" };
      }
      if (explain) return null;
      const outcome = logicValueFrom(run.result);
      if (!outcome.ok) {
        return {
          message: t(
            outcome.reason === "columns"
              ? "knowledgeNetwork.objectTypeLogicStatementOneColumn"
              : "knowledgeNetwork.objectTypeLogicStatementOneRow",
          ),
          status: "error",
        };
      }
      return { status: "done", value: outcome.value };
    } catch (error) {
      return { message: error instanceof Error ? error.message : String(error), status: "error" };
    }
  };

  const handleTrial = async () => {
    setErrorMark(null);
    setTrial({ status: "running" });
    setTrial((await runStatement(false)) ?? { status: "idle" });
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    const local = localStatementProblem(statement);
    if (local) {
      setStatementError(t(`knowledgeNetwork.${local}`));
      return;
    }
    if (settingList.length > 0 && validateParams()) {
      void message.error(t("knowledgeNetwork.objectTypeLogicAttributeFillParameters"));
      return;
    }
    if (canRun && knId) {
      setChecking(true);
      const problem = await runStatement(true);
      setChecking(false);
      if (problem?.status === "error") {
        setStatementError(problem.message);
        return;
      }
    }

    const formValues = form.getFieldsValue(true) as LogicAttributeFormValues;
    onOk({
      comment: formValues.comment,
      dataSource: { statement, type: "cypher" },
      displayName: formValues.displayName ?? "",
      name: formValues.name ?? "",
      parameters: settingList.map((item) => {
        const { error, children, source, ...parameter } = item;
        void error;
        void children;
        void source;
        return parameter;
      }),
      type: "cypher",
    });
  };

  const parameterColumns: TableColumnProps<SettingItem>[] = [
    {
      dataIndex: "name",
      key: "name",
      render: (value: string) => <code>{`$${value}`}</code>,
      title: t("common.name"),
      width: 180,
    },
    {
      dataIndex: "valueFrom",
      key: "valueFrom",
      render: (_, record) => (
        <Select
          aria-label={t("knowledgeNetwork.objectTypeLogicValueFrom")}
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
        if (record.valueFrom === "input") {
          return <Input disabled style={{ width: "100%" }} />;
        }
        if (record.valueFrom === "const") {
          return (
            <Input
              aria-label={t("knowledgeNetwork.objectTypeLogicValue")}
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
            aria-label={t("knowledgeNetwork.objectTypeLogicValue")}
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
      width: 260,
    },
    {
      key: "sample",
      render: (_, record) =>
        record.valueFrom === "const" ? null : (
          <Input
            aria-label={t("knowledgeNetwork.objectTypeLogicTrialSample")}
            disabled={!canRun}
            onChange={(event) =>
              setSamples((current) => ({ ...current, [record.name]: event.target.value }))
            }
            placeholder={t("knowledgeNetwork.objectTypeLogicTrialSamplePlaceholder")}
            value={samples[record.name] ?? ""}
          />
        ),
      title: t("knowledgeNetwork.objectTypeLogicTrialSample"),
    },
  ];

  const retiredColumns: TableColumnProps<SettingItem>[] = [
    { dataIndex: "name", key: "name", title: t("common.name") },
    {
      dataIndex: "valueFrom",
      key: "valueFrom",
      title: t("knowledgeNetwork.objectTypeLogicValueFrom"),
    },
    {
      dataIndex: "value",
      key: "value",
      render: (value?: string | number | boolean) =>
        isEmptyExceptZero(value) ? "--" : String(value),
      title: t("knowledgeNetwork.objectTypeLogicValue"),
    },
  ];

  return (
    <Drawer
      className={styles.drawer}
      destroyOnHidden
      footer={
        <div className={styles.footer}>
          <AppButton onClick={onClose}>
            {isRetiredTool ? t("common.close") : t("common.cancel")}
          </AppButton>
          {isRetiredTool ? null : (
            <AppButton loading={checking} onClick={() => void handleSubmit()} type="primary">
              {t("common.ok")}
            </AppButton>
          )}
        </div>
      }
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={title}
      width={1000}
    >
      {isRetiredTool ? (
        <Alert
          className={styles.notice}
          message={t("knowledgeNetwork.objectTypeLogicToolRetired")}
          showIcon
          type="warning"
        />
      ) : null}
      <Form disabled={isRetiredTool} form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
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
          <Col span={8}>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyDisplayName")}
              name="displayName"
              rules={[
                { message: t("knowledgeNetwork.pleaseInput"), required: true },
                {
                  validator: (_rule, value?: string) =>
                    isPropertyDisplayNameWithinLimit(value ?? "")
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            t("knowledgeNetwork.objectTypePropertyDisplayNameMaxLength", {
                              max: PROPERTY_DISPLAY_NAME_MAX_LENGTH,
                            }),
                          ),
                        ),
                },
              ]}
            >
              <Input
                count={PROPERTY_DISPLAY_NAME_COUNT}
                disabled={!isAddMode}
                onChange={() => {
                  isDisplayNameManuallyEdited.current = true;
                }}
                placeholder={t("knowledgeNetwork.pleaseInput")}
                showCount
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t("knowledgeNetwork.objectTypePropertyType")}>
              <Input
                disabled
                value={t(
                  isRetiredTool
                    ? "knowledgeNetwork.objectTypeLogicAttributeTypeTool"
                    : "knowledgeNetwork.objectTypeLogicAttributeTypeCypher",
                )}
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

      {isRetiredTool ? (
        <>
          <div className={styles.settingTitle}>
            {t("knowledgeNetwork.objectTypeLogicAttributeResource")}
          </div>
          <p className={styles.settingHint}>
            {[
              attrInfo.dataSource?.name,
              attrInfo.dataSource?.toolId,
              attrInfo.dataSource?.resultPath,
            ]
              .filter(Boolean)
              .join(" · ") || "--"}
          </p>
          <Table
            columns={retiredColumns}
            dataSource={settingList}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </>
      ) : (
        <>
          <div className={styles.settingTitle}>
            {t("knowledgeNetwork.objectTypeLogicStatement")}
          </div>
          <p className={styles.settingHint}>{t("knowledgeNetwork.objectTypeLogicStatementHint")}</p>
          <CypherEditor
            ariaLabel={t("knowledgeNetwork.objectTypeLogicStatement")}
            errorMark={errorMark}
            maxHeight={320}
            minHeight={140}
            onChange={handleStatementChange}
            onHistory={() => undefined}
            onRun={() => void handleTrial()}
            schema={completionSchema}
            value={statement}
          />
          {statementError ? (
            <div className={styles.fieldError} role="alert">
              {statementError}
            </div>
          ) : null}

          <div className={styles.settingTitle} style={{ marginTop: 16 }}>
            {t("knowledgeNetwork.objectTypeLogicAttributeSetting")}
          </div>
          <Table
            columns={parameterColumns}
            dataSource={settingList}
            locale={{ emptyText: t("knowledgeNetwork.objectTypeLogicNoParameters") }}
            pagination={false}
            rowKey="id"
            size="small"
          />

          <div className={styles.trial}>
            <AppButton
              disabled={!canRun || !knId}
              loading={trial.status === "running"}
              onClick={() => void handleTrial()}
            >
              {t("knowledgeNetwork.objectTypeLogicTrialRun")}
            </AppButton>
            {!canRun ? (
              <span className={styles.settingHint}>
                {t("knowledgeNetwork.objectTypeLogicTrialUnavailable")}
              </span>
            ) : null}
            {trial.status === "done" ? (
              <span className={styles.trialResult}>
                {t("knowledgeNetwork.objectTypeLogicTrialResult")}
                <code data-testid="logic-trial-value">{formatTrialValue(trial.value)}</code>
              </span>
            ) : null}
            {trial.status === "error" ? (
              <div className={styles.fieldError} role="alert">
                {trial.message}
              </div>
            ) : null}
          </div>
        </>
      )}
    </Drawer>
  );
}
