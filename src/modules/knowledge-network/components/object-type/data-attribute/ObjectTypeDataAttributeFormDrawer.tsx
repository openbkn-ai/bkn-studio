/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Drawer, Form, Input, Select, Switch, Tooltip } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

import {
  canBeDisplayKey,
  canBeIncrementalKey,
  canBePrimaryKey,
  DATA_PROPERTY_NAME_PATTERN,
  DATA_PROPERTY_TYPES,
} from "./constants";
import styles from "./ObjectTypeDataAttributeFormDrawer.module.css";

type ObjectTypeDataAttributeFormDrawerProps = {
  onClose: () => void;
  onSubmit: (value: ObjectTypeDataProperty) => void;
  open: boolean;
  property?: ObjectTypeDataProperty;
};

export function ObjectTypeDataAttributeFormDrawer({
  onClose,
  onSubmit,
  open,
  property,
}: ObjectTypeDataAttributeFormDrawerProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ObjectTypeDataProperty>();
  const propertyType = Form.useWatch("type", form);
  const isDisplayNameManuallyEdited = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    isDisplayNameManuallyEdited.current = Boolean(property);

    if (property) {
      form.setFieldsValue(property);
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
  }, [form, open, property]);

  const handleTypeChange = (nextType: string) => {
    if (!canBePrimaryKey(nextType)) {
      form.setFieldValue("primaryKey", false);
    }
    if (!canBeDisplayKey(nextType)) {
      form.setFieldValue("displayKey", false);
    }
    if (!canBeIncrementalKey(nextType)) {
      form.setFieldValue("incrementalKey", false);
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

  return (
    <Drawer
      destroyOnClose
      footer={
        <div className={styles.footer}>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton
            onClick={() => {
              void form.validateFields().then((values) => {
                onSubmit(values);
                onClose();
              });
            }}
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
        property
          ? t("knowledgeNetwork.objectTypeEditDataProperty")
          : t("knowledgeNetwork.objectTypeAddDataProperty")
      }
      width={400}
    >
      <Form colon={false} form={form} layout="vertical">
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
            maxLength={1000}
            placeholder={t("knowledgeNetwork.pleaseInput")}
            showCount
          />
        </Form.Item>
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
          <div className={styles.switchRow}>
            {renderSwitchLabel(
              t("knowledgeNetwork.objectTypeIncrementalKeyShort"),
              "knowledgeNetwork.objectTypeIncrementalKeyTip",
            )}
            <Form.Item name="incrementalKey" noStyle valuePropName="checked">
              <Switch disabled={!canBeIncrementalKey(propertyType)} size="small" />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Drawer>
  );
}
