/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Drawer, Form, Input, InputNumber, Select, Switch, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import type {
  ObjectTypeDataProperty,
  ObjectTypeMaskRule,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  createDefaultMaskRule,
  defaultMaskPreviewInput,
  isMaskRuleValid,
  maskGranularitiesForPropertyType,
  maskRuleKindsForPropertyType,
  previewMaskRule,
  type ObjectTypeMaskRuleKind,
} from "@/modules/knowledge-network/utils/mask-rule";

import {
  canBeDisplayKey,
  canBePrimaryKey,
  DATA_PROPERTY_COMMENT_MAX_LENGTH,
  DATA_PROPERTY_NAME_PATTERN,
  DATA_PROPERTY_TYPES,
} from "./constants";
import styles from "./ObjectTypeDataAttributeFormDrawer.module.css";

type ObjectTypeDataAttributeFormDrawerProps = {
  mode?: "attribute" | "mask-rule";
  onClose: () => void;
  onSubmit: (value: ObjectTypeDataProperty) => Promise<void> | void;
  open: boolean;
  property?: ObjectTypeDataProperty;
};

export function ObjectTypeDataAttributeFormDrawer({
  mode = "attribute",
  onClose,
  onSubmit,
  open,
  property,
}: ObjectTypeDataAttributeFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ObjectTypeDataProperty>();
  const propertyType = Form.useWatch("type", { form, preserve: true });
  const maskRule = Form.useWatch("maskRule", { form, preserve: true });
  const propertyMaskingAvailable = useCapability(CAPABILITIES.PERM_OBJECT_LEVEL) === "available";
  const isMaskRuleMode = mode === "mask-rule";
  const maskRulePropertyType = isMaskRuleMode ? property?.type : propertyType;
  const isDisplayNameManuallyEdited = useRef(false);
  const [previewInput, setPreviewInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitting(false);

    isDisplayNameManuallyEdited.current = Boolean(property);

    if (property) {
      form.resetFields();
      form.setFieldsValue(property);
      setPreviewInput(defaultMaskPreviewInput(property.type, property.maskRule?.kind));
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      displayKey: false,
      displayName: "",
      incrementalKey: false,
      name: "",
      primaryKey: false,
      type: "string",
    });
    setPreviewInput(defaultMaskPreviewInput("string"));
  }, [form, open, property]);

  const supportedMaskKinds = useMemo(
    () => maskRuleKindsForPropertyType(maskRulePropertyType),
    [maskRulePropertyType],
  );
  const maskRuleCompatible = !maskRule || supportedMaskKinds.includes(maskRule.kind);
  const maskPreview = previewMaskRule(maskRulePropertyType, maskRule, previewInput);

  const handleTypeChange = (nextType: string) => {
    if (!canBePrimaryKey(nextType)) {
      form.setFieldValue("primaryKey", false);
    }
    if (!canBeDisplayKey(nextType)) {
      form.setFieldValue("displayKey", false);
    }
    setPreviewInput(defaultMaskPreviewInput(nextType));
  };

  const handleMaskKindChange = (kind: "none" | ObjectTypeMaskRuleKind) => {
    if (kind === "none") {
      form.setFieldValue("maskRule", undefined);
      return;
    }

    const nextRule = createDefaultMaskRule(kind);
    if (nextRule.kind === "date_granularity") {
      nextRule.granularity = maskGranularitiesForPropertyType(maskRulePropertyType)[0] ?? "year";
    }
    form.setFieldValue("maskRule", nextRule);
    setPreviewInput(defaultMaskPreviewInput(maskRulePropertyType, kind));
  };

  const maskKindOptions = [
    { label: t("knowledgeNetwork.objectTypeMaskRuleNone"), value: "none" },
    ...supportedMaskKinds.map((kind) => ({
      label: t(`knowledgeNetwork.objectTypeMaskRuleKind.${kind}`),
      value: kind,
    })),
  ];

  const replacementRules = [
    { required: true, message: t("knowledgeNetwork.objectTypeMaskRuleReplacementRequired") },
    {
      validator: (_rule: unknown, value?: string) => {
        const codePoints = Array.from(value ?? "");
        const valid =
          codePoints.length >= 1 &&
          codePoints.length <= 8 &&
          codePoints.every(
            (character) => !/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u.test(character),
          );
        return valid
          ? Promise.resolve()
          : Promise.reject(new Error(t("knowledgeNetwork.objectTypeMaskRuleReplacementInvalid")));
      },
    },
  ];

  const renderMaskRuleFields = (rule: ObjectTypeMaskRule) => {
    switch (rule.kind) {
      case "fixed":
        return (
          <Form.Item
            label={t("knowledgeNetwork.objectTypeMaskRuleReplacement")}
            name={["maskRule", "replacement"]}
            rules={replacementRules}
          >
            <Input maxLength={8} />
          </Form.Item>
        );
      case "partial":
        return (
          <>
            <div className={styles.maskRuleGrid}>
              <Form.Item
                label={t("knowledgeNetwork.objectTypeMaskRuleKeepStart")}
                name={["maskRule", "keepStart"]}
                rules={[{ required: true }]}
              >
                <InputNumber max={64} min={0} precision={0} />
              </Form.Item>
              <Form.Item
                label={t("knowledgeNetwork.objectTypeMaskRuleKeepEnd")}
                name={["maskRule", "keepEnd"]}
                rules={[{ required: true }]}
              >
                <InputNumber max={64} min={0} precision={0} />
              </Form.Item>
            </div>
            <Form.Item
              label={t("knowledgeNetwork.objectTypeMaskRuleReplacement")}
              name={["maskRule", "replacement"]}
              rules={replacementRules}
            >
              <Input maxLength={8} />
            </Form.Item>
          </>
        );
      case "email":
        return (
          <>
            <div className={`${styles.maskRuleGrid} ${styles.emailMaskRuleGrid}`}>
              <Form.Item
                className={styles.maskRuleInlineField}
                label={t("knowledgeNetwork.objectTypeMaskRuleLocalKeepStart")}
                name={["maskRule", "localKeepStart"]}
                rules={[{ required: true }]}
              >
                <InputNumber max={64} min={0} precision={0} />
              </Form.Item>
              <Form.Item
                className={styles.maskRuleInlineField}
                label={t("knowledgeNetwork.objectTypeMaskRulePreserveDomain")}
                name={["maskRule", "preserveDomain"]}
                valuePropName="checked"
              >
                <Switch size="small" />
              </Form.Item>
            </div>
            <Form.Item
              className={styles.maskRuleInlineField}
              label={t("knowledgeNetwork.objectTypeMaskRuleReplacement")}
              name={["maskRule", "replacement"]}
              rules={replacementRules}
            >
              <Input maxLength={8} />
            </Form.Item>
          </>
        );
      case "round":
        return (
          <Form.Item
            label={t("knowledgeNetwork.objectTypeMaskRuleStep")}
            name={["maskRule", "step"]}
            rules={[
              { required: true },
              {
                validator: (_rule, value?: number) =>
                  Number.isFinite(value) && Number(value) > 0
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t("knowledgeNetwork.objectTypeMaskRuleStepInvalid")),
                      ),
              },
            ]}
          >
            <InputNumber min={0} step="0.01" stringMode={false} />
          </Form.Item>
        );
      case "date_granularity":
        return (
          <Form.Item
            label={t("knowledgeNetwork.objectTypeMaskRuleGranularity")}
            name={["maskRule", "granularity"]}
            rules={[{ required: true }]}
          >
            <Select
              options={maskGranularitiesForPropertyType(maskRulePropertyType).map((granularity) => ({
                label: t(`knowledgeNetwork.objectTypeMaskRuleGranularityValue.${granularity}`),
                value: granularity,
              }))}
            />
          </Form.Item>
        );
    }
  };

  const renderSwitchLabel = (label: string, tipKey: string) => (
    <div className={styles.switchLabelRow}>
      <span className={styles.switchLabelText}>{label}</span>
      <Tooltip title={t(tipKey)}>
        <QuestionCircleOutlined className={styles.switchHelpIcon} />
      </Tooltip>
      <span className={styles.switchLabelColon}>:</span>
    </div>
  );

  const handleSubmit = async () => {
    let values: ObjectTypeDataProperty;
    try {
      await form.validateFields();
      const completeValues: unknown = form.getFieldsValue(true);
      values = completeValues as ObjectTypeDataProperty;
    } catch (error) {
      const errorFields =
        typeof error === "object" && error !== null && "errorFields" in error
          ? (error as { errorFields?: Array<{ name?: Array<number | string> }> }).errorFields
          : undefined;
      const firstInvalidField = errorFields?.[0]?.name;
      if (firstInvalidField) {
        form.scrollToField(firstInvalidField, { block: "center" });
        return;
      }
      void message.error(extractRequestErrorMessage(error));
      return;
    }

    if (
      isMaskRuleMode &&
      propertyMaskingAvailable &&
      values.maskRule &&
      !isMaskRuleValid(values.type, values.maskRule)
    ) {
      void message.error(t("knowledgeNetwork.objectTypeMaskRuleIncomplete"));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...values, incrementalKey: false });
      onClose();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      footer={
        <div className={styles.footer}>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={isMaskRuleMode && Boolean(maskRule && !maskRuleCompatible)}
            loading={submitting}
            onClick={() => void handleSubmit()}
            type="primary"
          >
            {t("common.ok")}
          </AppButton>
        </div>
      }
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={
        isMaskRuleMode
          ? t("knowledgeNetwork.objectTypeMaskRuleDrawerTitle", {
              name: property?.displayName || property?.name || "",
            })
          : property
          ? t("knowledgeNetwork.objectTypeEditDataProperty")
          : t("knowledgeNetwork.objectTypeAddDataProperty")
      }
      width={560}
    >
      <Form colon={false} form={form} layout="vertical">
        {!isMaskRuleMode ? (
          <>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyName")}
              name="name"
              rules={[
                { message: t("knowledgeNetwork.objectTypePropertyNameRequired"), required: true },
                {
                  message: t("knowledgeNetwork.objectTypeDataPropertyNamePattern"),
                  pattern: DATA_PROPERTY_NAME_PATTERN,
                },
              ]}
            >
              <Input
                disabled={Boolean(property)}
                onChange={(event) => {
                  if (!isDisplayNameManuallyEdited.current) {
                    form.setFieldValue("displayName", event.target.value);
                  }
                }}
                placeholder={t("knowledgeNetwork.pleaseInput")}
              />
            </Form.Item>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyDisplayName")}
              name="displayName"
              rules={[
                {
                  message: t("knowledgeNetwork.objectTypePropertyDisplayNameRequired"),
                  required: true,
                },
              ]}
            >
              <Input
                onChange={() => {
                  isDisplayNameManuallyEdited.current = true;
                }}
                placeholder={t("knowledgeNetwork.pleaseInput")}
              />
            </Form.Item>
            <Form.Item
              label={t("knowledgeNetwork.objectTypePropertyType")}
              name="type"
              rules={[{ required: true }]}
            >
              <Select
                onChange={handleTypeChange}
                options={DATA_PROPERTY_TYPES.map((item) => ({ label: item, value: item }))}
                placeholder={t("knowledgeNetwork.pleaseSelect")}
              />
            </Form.Item>
            <Form.Item label={t("common.description")} name="comment">
              <Input.TextArea
                autoSize={{ maxRows: 7, minRows: 3 }}
                maxLength={DATA_PROPERTY_COMMENT_MAX_LENGTH}
                placeholder={t("knowledgeNetwork.pleaseInput")}
                showCount
              />
            </Form.Item>
          </>
        ) : null}
        {isMaskRuleMode && propertyMaskingAvailable ? (
          <section className={styles.maskRuleSection}>
            <div className={styles.maskRuleHeading}>
              <div>
                <h3>{t("knowledgeNetwork.objectTypeMaskRuleTitle")}</h3>
                <p>{t("knowledgeNetwork.objectTypeMaskRuleDescription")}</p>
              </div>
              <EditionBadge
                alwaysShow
                capability={CAPABILITIES.PERM_OBJECT_LEVEL}
                edition="enterprise"
              />
            </div>

            <Form.Item
              className={styles.maskRuleTypeField}
              label={t("knowledgeNetwork.objectTypeMaskRuleType")}
            >
              <Select
                onChange={handleMaskKindChange}
                options={maskKindOptions}
                value={maskRule?.kind ?? "none"}
              />
            </Form.Item>

            {!supportedMaskKinds.length ? (
              <Alert
                message={t("knowledgeNetwork.objectTypeMaskRuleUnsupported")}
                showIcon
                type="info"
              />
            ) : null}

            {!maskRuleCompatible ? (
              <Alert
                message={t("knowledgeNetwork.objectTypeMaskRuleTypeChanged")}
                showIcon
                type="error"
              />
            ) : null}

            {maskRule && maskRuleCompatible ? (
              <div className={styles.maskRuleFields}>{renderMaskRuleFields(maskRule)}</div>
            ) : null}

            {maskRule ? (
              <div className={styles.maskPreview}>
                <div className={styles.maskPreviewHeading}>
                  <span>{t("knowledgeNetwork.objectTypeMaskRulePreview")}</span>
                  <span
                    className={
                      isMaskRuleValid(maskRulePropertyType, maskRule)
                        ? styles.maskPreviewReady
                        : styles.maskPreviewPending
                    }
                  >
                    {isMaskRuleValid(maskRulePropertyType, maskRule)
                      ? t("knowledgeNetwork.objectTypeMaskRuleValid")
                      : t("knowledgeNetwork.objectTypeMaskRuleIncomplete")}
                  </span>
                </div>
                <label className={styles.maskPreviewRow}>
                  <span>{t("knowledgeNetwork.objectTypeMaskRuleExampleInput")}</span>
                  <Input
                    onChange={(event) => setPreviewInput(event.target.value)}
                    value={previewInput}
                  />
                </label>
                <div className={styles.maskPreviewRow}>
                  <span>{t("knowledgeNetwork.objectTypeMaskRuleExampleOutput")}</span>
                  <strong>{maskPreview}</strong>
                </div>
                <p>{t("knowledgeNetwork.objectTypeMaskRulePreviewSafety")}</p>
              </div>
            ) : null}
          </section>
        ) : null}
        {!isMaskRuleMode ? (
          <div className={styles.switchGroup}>
            <div className={styles.switchRow}>
              {renderSwitchLabel(
                t("knowledgeNetwork.objectTypePrimaryKey"),
                "knowledgeNetwork.objectTypePrimaryKeyTip",
              )}
              <Form.Item name="primaryKey" noStyle valuePropName="checked">
                <Switch disabled={!canBePrimaryKey(propertyType)} size="small" />
              </Form.Item>
            </div>
            <div className={styles.switchRow}>
              {renderSwitchLabel(
                t("knowledgeNetwork.objectTypeDisplayKeyShort"),
                "knowledgeNetwork.objectTypeDisplayKeyTip",
              )}
              <Form.Item name="displayKey" noStyle valuePropName="checked">
                <Switch disabled={!canBeDisplayKey(propertyType)} size="small" />
              </Form.Item>
            </div>
          </div>
        ) : null}
      </Form>
    </Drawer>
  );
}
