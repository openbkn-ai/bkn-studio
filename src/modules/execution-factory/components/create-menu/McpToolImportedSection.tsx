/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Select, Spin, Table } from "antd";
import type { Key } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import { listTools } from "@/modules/execution-factory/services/tool.service";
import type { McpToolConfigInput } from "@/modules/execution-factory/types/mcp";
import type { ToolRecord } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";

type McpToolImportedSectionProps = {
  value?: McpToolConfigInput[];
  onChange?: (value: McpToolConfigInput[]) => void;
};

export function McpToolImportedSection({ value = [], onChange }: McpToolImportedSectionProps) {
  const { t } = useTranslation();
  const [toolboxes, setToolboxes] = useState<ToolboxRecord[]>([]);
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [boxId, setBoxId] = useState<string>();
  const [loadingToolboxes, setLoadingToolboxes] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingToolboxes(true);
    setLoadError(null);

    void (async () => {
      try {
        const result = await listToolboxes({
          page: 1,
          pageSize: 100,
        });
        setToolboxes(result.items);
        setBoxId((current) => current ?? result.items[0]?.boxId);
      } catch (error) {
        setToolboxes([]);
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoadingToolboxes(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!boxId) {
      setTools([]);
      return;
    }

    setLoadingTools(true);
    setLoadError(null);

    void (async () => {
      try {
        const result = await listTools(boxId, {
          page: 1,
          pageSize: 200,
        });
        setTools(result.items);
      } catch (error) {
        setTools([]);
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoadingTools(false);
      }
    })();
  }, [boxId]);

  const selectedRowKeys = useMemo(
    () =>
      value
        .filter((item) => item.boxId === boxId && item.toolId)
        .map((item) => item.toolId as string),
    [boxId, value],
  );

  const toolboxOptions = useMemo(
    () =>
      toolboxes.map((item) => ({
        label: item.name,
        value: item.boxId,
      })),
    [toolboxes],
  );

  const handleSelectionChange = (nextKeys: Key[]) => {
    if (!boxId) {
      return;
    }

    const selectedTools = tools.filter((tool) => nextKeys.includes(tool.toolId));
    const otherSelections = value.filter((item) => item.boxId !== boxId);
    const nextValue = [
      ...otherSelections,
      ...selectedTools.map((tool) => ({
        boxId,
        toolId: tool.toolId,
        toolName: tool.name,
        description: tool.description,
      })),
    ];

    onChange?.(nextValue);
  };

  return (
    <>
      <Alert
        message={t("executionFactory.mcpToolImportedHint")}
        showIcon
        style={{ marginBottom: 12 }}
        type="info"
      />
      {loadError ? (
        <Alert message={loadError} showIcon style={{ marginBottom: 12 }} type="error" />
      ) : null}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>{t("executionFactory.mcpToolImportedToolboxLabel")}</div>
        <Select
          loading={loadingToolboxes}
          onChange={(nextBoxId) => setBoxId(nextBoxId)}
          options={toolboxOptions}
          placeholder={t("executionFactory.mcpToolImportedToolboxPlaceholder")}
          style={{ width: "100%" }}
          value={boxId}
        />
      </div>
      <Spin spinning={loadingTools}>
        <Table
          columns={[
            { dataIndex: "name", key: "name", title: t("executionFactory.toolName") },
            {
              dataIndex: "description",
              key: "description",
              title: t("common.description"),
            },
            {
              dataIndex: "status",
              key: "status",
              render: (status: ToolRecord["status"]) =>
                t(`executionFactory.toolStatuses.${status}`),
              title: t("executionFactory.toolboxToolStatusLabel"),
            },
          ]}
          dataSource={tools.map((tool) => ({ ...tool, key: tool.toolId }))}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: handleSelectionChange,
          }}
          size="small"
        />
      </Spin>
      <div style={{ color: "rgba(0,0,0,0.45)", fontSize: 13, marginTop: 8 }}>
        {t("executionFactory.mcpToolImportedSelectedCount", { count: value.length })}
      </div>
    </>
  );
}
