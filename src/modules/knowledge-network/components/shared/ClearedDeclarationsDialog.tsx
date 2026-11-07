/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { ClearedDeclaration } from "@/modules/knowledge-network/types/knowledge-network";
import {
  declarationFieldKey,
  declarationKindKey,
  definitionKey,
  groupClearedDeclarations,
} from "@/modules/knowledge-network/utils/declaration-labels";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import styles from "./ClearedDeclarationsDialog.module.css";

/** Properties listed per definition before the rest folds under "show more". */
const VISIBLE_PROPERTIES = 5;

type ClearedDeclarationsDialogProps = {
  cleared: ClearedDeclaration[];
  /** Definition names from the imported file, keyed by `definitionKey`; a BKN package has none. */
  names?: ReadonlyMap<string, string>;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
};

/**
 * Lists what an overwrite import would clear, by definition, before the user lets it. Confirming
 * resends the same import with `confirm_clear_declarations=true`; cancelling leaves the import
 * settings as they were.
 */
export function ClearedDeclarationsDialog({
  cleared,
  names,
  onCancel,
  onConfirm,
  open,
}: ClearedDeclarationsDialogProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const definitions = useMemo(() => groupClearedDeclarations(cleared), [cleared]);

  const fieldList = (fields: string[]) =>
    fields
      .map((field) => {
        const key = declarationFieldKey(field);
        return key ? t(key) : field;
      })
      .join(t("knowledgeNetwork.declarations.listSeparator"));

  return (
    <Modal
      destroyOnHidden
      footer={[
        <AppButton key="cancel" onClick={onCancel}>
          {t("common.cancel")}
        </AppButton>,
        <AppButton danger key="confirm" onClick={onConfirm} type="primary">
          {t("knowledgeNetwork.declarations.cleared.confirm")}
        </AppButton>,
      ]}
      onCancel={onCancel}
      open={open}
      rootClassName={`${modalStyles.businessModal} ${styles.dialog}`}
      title={t("knowledgeNetwork.declarations.cleared.title")}
    >
      <Typography.Paragraph className={styles.description}>
        {t("knowledgeNetwork.declarations.cleared.description")}
      </Typography.Paragraph>
      {definitions.length ? (
        <div className={styles.definitions}>
          {definitions.map((definition) => {
            const key = definitionKey(definition.kind, definition.id);
            const kind = t(declarationKindKey(definition.kind));
            const name = names?.get(key);
            const showAll = expanded.has(key);
            const visibleProperties = showAll
              ? definition.properties
              : definition.properties.slice(0, VISIBLE_PROPERTIES);
            const hiddenCount = definition.properties.length - visibleProperties.length;

            return (
              <section aria-label={name ?? definition.id} className={styles.definition} key={key}>
                <div className={styles.definitionTitle}>
                  <Typography.Text strong>
                    {t("knowledgeNetwork.declarations.cleared.definition", {
                      kind,
                      name: name ?? definition.id,
                    })}
                  </Typography.Text>
                  {name ? <span className={styles.definitionId}>{definition.id}</span> : null}
                </div>
                <ul className={styles.fieldList}>
                  {definition.ownFields.length ? (
                    <li>
                      {definition.properties.length
                        ? t("knowledgeNetwork.declarations.cleared.ownFields", {
                            fields: fieldList(definition.ownFields),
                            kind,
                          })
                        : fieldList(definition.ownFields)}
                    </li>
                  ) : null}
                  {visibleProperties.map((property) => (
                    <li key={property.name}>
                      {t("knowledgeNetwork.declarations.cleared.propertyFields", {
                        fields: fieldList(property.fields),
                        property: property.name,
                      })}
                    </li>
                  ))}
                  {hiddenCount > 0 ? (
                    <li>
                      <AppButton
                        className={styles.moreButton}
                        onClick={() => setExpanded((current) => new Set(current).add(key))}
                        type="link"
                      >
                        {t("knowledgeNetwork.declarations.cleared.moreProperties", {
                          count: hiddenCount,
                        })}
                      </AppButton>
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Typography.Paragraph type="secondary">
          {t("knowledgeNetwork.declarations.cleared.empty")}
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
