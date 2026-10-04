/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import type { RecordIntegrity } from "./business-provenance.service";
import styles from "./BusinessProvenanceScene.module.css";

export function RecordMissingDetails({ items }: { items?: RecordIntegrity["missing"] }) {
  if (!items?.length) return null;
  return (
    <ul className={styles.recordMissingDetails}>
      {items.map((item, index) => (
        <li key={`${item.operation_id}:${item.attempt}:${item.field}:${index}`}>
          <strong>
            {i18n.t(`bknTrace.businessProvenance.workspace.integrity.${item.reason}`)}
          </strong>
          <span>
            {i18n.t(
              `bknTrace.businessProvenance.workspace.integrity.fields.${item.field.split(":")[0]}`,
              {
                defaultValue: i18n.t(
                  "bknTrace.businessProvenance.workspace.integrity.requiredRecord",
                ),
              },
            )}
          </span>
          {item.tool_name ? <code>{item.tool_name}</code> : null}
          {item.operation_id ? (
            <code>
              {item.operation_id}
              {item.attempt > 0 ? ` / ${item.attempt}` : ""}
            </code>
          ) : item.field.startsWith("request_id:") && item.field.slice("request_id:".length) ? (
            <code>{item.field.slice("request_id:".length)}</code>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
