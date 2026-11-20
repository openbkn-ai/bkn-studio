/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Empty, Input, Select, Tabs } from "antd";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ApiSchemaEditor } from "./ApiSchemaEditor";
import { ObjectMemberName } from "./ApiValueEditor";
import { useTranslation } from "react-i18next";
import { EditorValidity } from "./EditorValidity";
import { objectValue } from "./model";
import { useObjectEditorItems } from "./use-editor-items";
import type { ApiDefinitionEditorProps } from "./types";
import styles from "./editor.module.css";

export function ApiResponseEditor({
  value = {},
  onChange,
  disabled,
  onValidityChange,
  renderResponseFields,
  enableOneOf = false,
}: ApiDefinitionEditorProps & {
  enableOneOf?: boolean;
  renderResponseFields?: (
    value: Record<string, unknown>,
    onChange: (value: Record<string, unknown>) => void,
  ) => ReactNode;
}) {
  const { t } = useTranslation();
  const mediaTypeId = useId();
  const response = objectValue(value.statuses);
  const updateStatuses = (statuses: typeof response) => onChange({ ...value, statuses });
  const entries = useObjectEditorItems(response);
  const statuses = Object.keys(response);
  const [activeStatus, setActiveStatus] = useState<string>();
  const selectedStatus =
    activeStatus && Object.hasOwn(response, activeStatus) ? activeStatus : statuses[0];
  const nextStatus = [
    ...Array.from({ length: 400 }, (_, i) => String(200 + i)),
    ...Array.from({ length: 100 }, (_, i) => String(100 + i)),
    "default",
  ].find((status) => !Object.hasOwn(response, status));
  const addResponse = (
    <Button
      disabled={disabled || !nextStatus}
      onClick={() => {
        if (!nextStatus) return;
        setActiveStatus(nextStatus);
        updateStatuses(
          entries.replace(nextStatus, {
            description: "",
            schema: { type: "object", properties: {} },
          }),
        );
      }}
    >
      {t("dataConnect.apiEditor.addResponse")}
    </Button>
  );
  return (
    <EditorValidity onValidityChange={onValidityChange}>
      <div
        className={`${styles.member} ${styles.sectionCard}`}
        role="group"
        aria-label={t("dataConnect.apiEditor.response")}
      >
        <div className={styles.inlineField}>
          <label className={styles.fieldTitle} htmlFor={mediaTypeId}>
            {t("dataConnect.apiEditor.mediaType")}
          </label>
          <Select
            id={mediaTypeId}
            value={typeof value.content_type === "string" ? value.content_type : undefined}
            disabled={disabled}
            options={[{ value: "application/json", label: "application/json" }]}
            onChange={(content_type) => onChange({ ...value, content_type })}
          />
        </div>
        {statuses.length === 0 ? (
          <>
            <div className={styles.responseEmptyActions}>{addResponse}</div>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("dataConnect.apiEditor.noResponses")}
            />
          </>
        ) : (
          <Tabs
            activeKey={entries.keys.get(selectedStatus)}
            onChange={(key) =>
              setActiveStatus(statuses.find((status) => entries.keys.get(status) === key))
            }
            renderTabBar={(props, DefaultTabBar) => (
              <div
                className={styles.responseTabBar}
                ref={(node) => {
                  // rc-tabs does not forward naming attributes to its tablist.
                  node
                    ?.querySelector('[role="tablist"]')
                    ?.setAttribute("aria-label", t("dataConnect.apiEditor.response"));
                }}
              >
                <DefaultTabBar {...props} />
                {addResponse}
              </div>
            )}
            items={statuses.map((status) => {
              const entry = response[status];
              const r = objectValue(entry);
              const next = (value: unknown) => updateStatuses(entries.replace(status, value));
              return {
                key: entries.keys.get(status) ?? status,
                label: status,
                // Hidden responses retain local drafts and remain in validity reporting.
                forceRender: true,
                children: (
                  <div
                    className={styles.member}
                    role="group"
                    aria-label={`${t("dataConnect.apiEditor.responseStatus")} ${status}`}
                  >
                    <div className={styles.responseFields}>
                      <div className={`${styles.memberHeader} ${styles.responseStatusHeader}`}>
                        <ObjectMemberName
                          name={status}
                          entries={response}
                          disabled={disabled}
                          visibleLabel={t("dataConnect.apiEditor.responseStatus")}
                          label={`${t("dataConnect.apiEditor.responseStatus")} ${t("dataConnect.apiEditor.name")} ${status}`}
                          onRename={(name) => {
                            if (status === selectedStatus) setActiveStatus(name);
                            updateStatuses(entries.rename(status, name));
                          }}
                        />
                        <Button
                          disabled={disabled}
                          type="text"
                          danger
                          aria-label={`${t("dataConnect.apiEditor.remove")} ${status}`}
                          onClick={() => {
                            if (status === selectedStatus) {
                              const index = statuses.indexOf(status);
                              setActiveStatus(statuses[index + 1] ?? statuses[index - 1]);
                            }
                            updateStatuses(entries.replace(status, undefined));
                          }}
                        >
                          {t("dataConnect.apiEditor.remove")}
                        </Button>
                      </div>
                      <label
                        className={`${styles.inlineField} ${styles.responseField}`}
                        htmlFor={`${entries.keys.get(status)}-description`}
                      >
                        <span className={styles.fieldTitle}>
                          {t("dataConnect.apiEditor.description")}
                        </span>
                        <Input
                          id={`${entries.keys.get(status)}-description`}
                          aria-label={`${status} ${t("dataConnect.apiEditor.description")}`}
                          value={typeof r.description === "string" ? r.description : ""}
                          disabled={disabled}
                          onChange={(event) => next({ ...r, description: event.target.value })}
                        />
                      </label>
                    </div>
                    <div className={styles.member}>
                      <ApiSchemaEditor
                        value={r.schema}
                        disabled={disabled}
                        label={`${status} ${t("dataConnect.apiEditor.response")}`}
                        enableOneOf={enableOneOf}
                        onChange={(schema) => next({ ...r, schema })}
                      />
                    </div>
                    {renderResponseFields?.(r, next)}
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </EditorValidity>
  );
}
