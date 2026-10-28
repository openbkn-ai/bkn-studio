/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { identityCandidates } from "@/modules/bkn-project/components/draft/edit";
import { propertyTypeKey } from "@/modules/bkn-project/components/draft/evidence";
import type { DraftObjectType } from "@/modules/bkn-project/types/draft";

import styles from "./DraftTables.module.css";

/**
 * Chooses the properties that identify an object type's records. A single property is counted
 * over the whole table, which can take a while; several properties are not counted.
 */
export function IdentityDialog({
  objectType,
  onCancel,
  onSave,
}: {
  objectType: DraftObjectType;
  onCancel: () => void;
  onSave: (properties: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const candidates = identityCandidates(objectType);
  const [selected, setSelected] = useState<string[]>(() =>
    objectType.primaryKeys.filter((name) => candidates.some((property) => property.name === name)),
  );
  const [saving, setSaving] = useState(false);
  const unchanged =
    selected.length === objectType.primaryKeys.length &&
    selected.every((name) => objectType.primaryKeys.includes(name));
  // A pending object type takes its proposed identity as a choice too.
  const canSave = selected.length > 0 && (objectType.needsIdentity || !unchanged);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: !canSave }}
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => void save()}
      open
      title={t("bknProject.model.identity.title", { name: objectType.name })}
    >
      <div className={styles.stack}>
        <p className={styles.muted}>{t("bknProject.model.identity.intro")}</p>
        {candidates.length ? (
          <Checkbox.Group
            className={styles.choices}
            onChange={(values) => setSelected(values)}
            options={candidates.map((property) => ({
              label: (
                <span>
                  <code className={styles.mono}>{property.name}</code>{" "}
                  <span className={styles.muted}>{t(propertyTypeKey(property.type))}</span>
                </span>
              ),
              value: property.name,
            }))}
            value={selected}
          />
        ) : (
          <Alert message={t("bknProject.model.identity.none")} showIcon type="info" />
        )}
        {selected.length > 1 ? (
          <span className={styles.warning}>{t("bknProject.model.identity.composite")}</span>
        ) : null}
        {saving && selected.length === 1 ? (
          <span className={styles.muted}>{t("bknProject.model.identity.counting")}</span>
        ) : null}
      </div>
    </Modal>
  );
}
