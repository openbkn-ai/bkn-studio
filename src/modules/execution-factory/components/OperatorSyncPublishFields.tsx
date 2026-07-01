/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Checkbox, Form, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { OperatorExecuteControlFields } from "@/modules/execution-factory/components/OperatorExecuteControlFields";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";

import styles from "./create-menu/create-menu.module.css";

type OperatorSyncPublishFieldsProps = {
  defaultOperatorName?: string;
  namePrefix?: string;
};

export function OperatorSyncPublishFields({
  defaultOperatorName,
  namePrefix = "operatorSync",
}: OperatorSyncPublishFieldsProps) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const enabled = Form.useWatch([namePrefix, "enabled"], form) === true;
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    void (async () => {
      const items = await listOperatorCategories();
      setCategories(
        items.map((item) => ({
          value: item.categoryType,
          label: item.name,
        })),
      );
    })();
  }, []);

  useEffect(() => {
    if (!enabled || !defaultOperatorName) {
      return;
    }

    const currentName = form.getFieldValue([namePrefix, "name"]) as string | undefined;
    if (!currentName?.trim()) {
      form.setFieldValue([namePrefix, "name"], defaultOperatorName);
    }
  }, [defaultOperatorName, enabled, form, namePrefix]);

  return (
    <div className={styles.operatorSyncSection}>
      <Form.Item name={[namePrefix, "enabled"]} valuePropName="checked">
        <Checkbox>{t("executionFactory.operatorSyncPublishLabel")}</Checkbox>
      </Form.Item>
      <p className={styles.sectionIntro}>{t("executionFactory.operatorSyncPublishHint")}</p>
      {enabled ? (
        <div className={styles.operatorSyncPanel}>
          <Form.Item
            label={t("executionFactory.operatorName")}
            name={[namePrefix, "name"]}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t("executionFactory.category")}
            name={[namePrefix, "category"]}
            initialValue="other_category"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Select options={categories} />
          </Form.Item>
          <OperatorExecuteControlFields namePrefix={[namePrefix, "executeControl"]} />
          <Form.Item name={[namePrefix, "directPublish"]} valuePropName="checked">
            <Checkbox>{t("executionFactory.operatorSyncDirectPublish")}</Checkbox>
          </Form.Item>
        </div>
      ) : null}
    </div>
  );
}
