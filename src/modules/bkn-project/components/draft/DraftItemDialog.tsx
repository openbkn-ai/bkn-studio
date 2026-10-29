/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  DESCRIPTION_MAX,
  type EditableItem,
  NAME_MAX,
  nameEdit,
} from "@/modules/bkn-project/components/draft/edit";
import type { DraftItemEdit, DraftObjectType } from "@/modules/bkn-project/types/draft";

/**
 * Property types a table's local index can be refreshed by, as bkn-project accepts them for an
 * update field. bkn-project still reads the table's own field and may refuse it; the page then
 * shows its reason.
 */
const UPDATE_FIELD_TYPES = new Set([
  "date",
  "datetime",
  "integer",
  "string",
  "time",
  "timestamp",
  "unsigned integer",
]);

/**
 * Types whose values grow with time, as an update time does: recommended. Numbers and text are
 * accepted too, but an identifier or a code does not grow when a record changes, so a refresh
 * by it would miss changes.
 */
const TIME_TYPES = new Set(["date", "datetime", "time", "timestamp"]);

const isObjectType = (item: EditableItem): item is DraftObjectType => "incrementalKey" in item;

/**
 * Renames or describes one draft item, and chooses an object type's update field. Saving is
 * offered only when something changed; the page sends the edit and closes the dialog once
 * bkn-project accepts it.
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
  const objectType = isObjectType(item) ? item : null;
  const [updateField, setUpdateField] = useState(objectType?.incrementalKey ?? "");
  const [saving, setSaving] = useState(false);
  const updateFieldEdit: DraftItemEdit | null =
    objectType && updateField !== objectType.incrementalKey
      ? { incrementalKey: updateField }
      : null;
  const named = nameEdit(item, values);
  const edit = named || updateFieldEdit ? { ...named, ...updateFieldEdit } : null;
  const nameMissing = !values.name.trim();
  const candidates = (objectType?.properties ?? []).filter((property) =>
    UPDATE_FIELD_TYPES.has(property.type),
  );
  const updateFieldOptions = [
    ...candidates.filter((property) => TIME_TYPES.has(property.type)),
    ...candidates.filter((property) => !TIME_TYPES.has(property.type)),
  ].map((property) => ({
    label: (
      <span>
        {property.displayName && property.displayName !== property.name ? (
          <>
            {property.displayName} <code>{property.name}</code>
          </>
        ) : (
          property.name
        )}
        {TIME_TYPES.has(property.type) ? (
          <>
            {" "}
            <LightStatusTag tone="success">
              {t("bknProject.model.edit.updateFieldRecommended")}
            </LightStatusTag>
          </>
        ) : null}
      </span>
    ),
    value: property.name,
  }));
  const chosen = candidates.find((property) => property.name === updateField);
  const notGrowing = Boolean(chosen && !TIME_TYPES.has(chosen.type));

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
        {objectType ? (
          <Form.Item
            extra={t(
              !updateFieldOptions.length
                ? "bknProject.model.edit.updateFieldUnavailable"
                : notGrowing
                  ? "bknProject.model.edit.updateFieldNotGrowing"
                  : "bknProject.model.edit.updateFieldHelp",
            )}
            validateStatus={notGrowing ? "warning" : undefined}
            htmlFor="draft-item-update-field"
            label={t("bknProject.model.edit.updateField")}
          >
            <Select
              allowClear
              disabled={!updateFieldOptions.length}
              id="draft-item-update-field"
              onChange={(value?: string) => setUpdateField(value ?? "")}
              options={updateFieldOptions}
              placeholder={t("bknProject.model.edit.updateFieldNone")}
              value={updateField || undefined}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
