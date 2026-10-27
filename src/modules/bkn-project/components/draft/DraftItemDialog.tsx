/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DESCRIPTION_MAX,
  type EditableItem,
  NAME_MAX,
  nameEdit,
} from "@/modules/bkn-project/components/draft/edit";
import type { DraftItemEdit } from "@/modules/bkn-project/types/draft";

/**
 * Renames or describes one draft item. Saving is offered only when something changed; the
 * page sends the edit and closes the dialog once bkn-project accepts it.
 */
export function DraftItemDialog({
  item,
  onCancel,
  onSave,
}: {
  item: EditableItem;
  onCancel: () => void;
  onSave: (edit: DraftItemEdit) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState({ description: item.description, name: item.name });
  const [saving, setSaving] = useState(false);
  const edit = nameEdit(item, values);
  const nameMissing = !values.name.trim();

  const save = async () => {
    if (!edit || nameMissing) {
      return;
    }
    setSaving(true);
    try {
      await onSave(edit);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      destroyOnHidden
      okButtonProps={{ disabled: !edit || nameMissing }}
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => void save()}
      confirmLoading={saving}
      open
      title={t("bknProject.model.edit.title", { name: item.name })}
    >
      <Form layout="vertical">
        <Form.Item
          help={nameMissing ? t("bknProject.model.edit.nameRequired") : undefined}
          htmlFor="draft-item-name"
          label={t("bknProject.model.edit.name")}
          required
          validateStatus={nameMissing ? "error" : undefined}
        >
          <Input
            id="draft-item-name"
            maxLength={NAME_MAX}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            showCount
            value={values.name}
          />
        </Form.Item>
        <Form.Item htmlFor="draft-item-description" label={t("bknProject.model.edit.description")}>
          <Input.TextArea
            autoSize={{ maxRows: 8, minRows: 3 }}
            id="draft-item-description"
            maxLength={DESCRIPTION_MAX}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
            showCount
            value={values.description}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
