/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Input, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listDependencyVersions } from "@/modules/execution-factory/services/function.service";

import styles from "../function-workbench.module.css";

export type FunctionDependency = { name?: string; version?: string };

/** PEP 508：字母数字开头结尾，中间可带 - _ .。后端也按这个校验，非法名直接 400。 */
const PACKAGE_NAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/;

type FunctionDependencyPanelProps = {
  onChange: (next: FunctionDependency[]) => void;
  value: FunctionDependency[];
};

export function FunctionDependencyPanel({ onChange, value }: FunctionDependencyPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [draftName, setDraftName] = useState("");
  const [adding, setAdding] = useState(false);
  const [versionsByName, setVersionsByName] = useState<Record<string, string[]>>({});

  const handleAdd = async () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }

    if (!PACKAGE_NAME_PATTERN.test(name)) {
      void message.warning(t("executionFactory.workbenchDependencyInvalidName"));
      return;
    }

    if (value.some((item) => item.name === name)) {
      void message.warning(t("executionFactory.workbenchDependencyDuplicate"));
      return;
    }

    setAdding(true);
    let versions: string[] = [];

    try {
      versions = await listDependencyVersions(name);
    } catch (error) {
      // 查不到版本不该挡住声明依赖，留空让用户手填。
      void message.warning(extractRequestErrorMessage(error));
    } finally {
      setAdding(false);
    }

    setVersionsByName((current) => ({ ...current, [name]: versions }));
    onChange([...value, { name, version: versions[0] }]);
    setDraftName("");
  };

  return (
    <>
      {value.length === 0 ? (
        <div className={styles.consoleCaption}>
          {t("executionFactory.workbenchDependencyEmpty")}
        </div>
      ) : null}
      {value.map((item, index) => (
        <div className={styles.depRow} key={`${item.name}-${index}`}>
          <span className={styles.depName}>{item.name}</span>
          <Select
            className={styles.depVersion}
            onChange={(version) =>
              onChange(value.map((entry, at) => (at === index ? { ...entry, version } : entry)))
            }
            options={(versionsByName[item.name ?? ""] ?? [item.version ?? ""])
              .filter(Boolean)
              .map((version) => ({ label: version, value: version }))}
            placeholder={t("executionFactory.workbenchDependencyVersion")}
            size="small"
            value={item.version}
          />
          <button
            aria-label={t("common.delete")}
            className={styles.depRemove}
            onClick={() => onChange(value.filter((_, at) => at !== index))}
            type="button"
          >
            <CloseOutlined />
          </button>
        </div>
      ))}
      <div className={styles.depAdd}>
        <Input
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(keyEvent) => {
            // 中文输入法选词也会敲回车，组合期间不能当提交
            if (keyEvent.key === "Enter" && !keyEvent.nativeEvent.isComposing) {
              void handleAdd();
            }
          }}
          placeholder={t("executionFactory.workbenchDependencyPlaceholder")}
          size="small"
          value={draftName}
        />
        <AppButton icon={<PlusOutlined />} loading={adding} onClick={() => void handleAdd()} size="small">
          {t("common.add")}
        </AppButton>
      </div>
      <div className={styles.dockHint}>{t("executionFactory.workbenchDependencyHint")}</div>
    </>
  );
}
