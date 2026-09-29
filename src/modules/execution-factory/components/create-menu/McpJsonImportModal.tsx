/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Modal, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { registerMcp } from "@/modules/execution-factory/services/mcp.service";
import type { McpMode } from "@/modules/execution-factory/types/mcp";
import { CAPABILITY_NAME_PATTERN } from "@/modules/execution-factory/utils/capability-name";
import {
  maskHeaders,
  parseMcpServersConfig,
  redactHeaderValues,
  type McpServerConfigEntry,
  type McpServerEntryError,
  type McpServersConfigError,
} from "@/modules/execution-factory/utils/mcp-servers-config";

import { discoverMcpTools } from "./mcp-tool-discovery";

export type McpJsonImportFill = {
  name: string;
  mode: McpMode;
  url: string;
  headers: Record<string, string>;
};

type McpJsonImportModalProps = {
  open: boolean;
  /** Category given to servers registered straight from the modal. */
  category: string;
  onClose: (registeredIds: string[]) => void;
  onFill: (value: McpJsonImportFill) => void;
};

type RowStatus = "idle" | "registering" | "registered" | "failed";

type Row = {
  entry: McpServerConfigEntry;
  name: string;
  status: RowStatus;
  message?: string;
};

const NO_TRANSPORT_ERRORS = new Set<McpServerEntryError>([
  "not_object",
  "stdio_unsupported",
  "unknown_type",
]);

function rowErrors(row: Row, rows: Row[]) {
  // The parser's duplicate check ran on default names; renames in the table supersede it.
  const errors: string[] = row.entry.errors.filter((error) => error !== "duplicate_name");

  if (!CAPABILITY_NAME_PATTERN.test(row.name)) {
    errors.push("name_invalid");
  } else if (rows.some((other) => other !== row && other.name === row.name)) {
    errors.push("duplicate_name");
  }

  return errors;
}

export function McpJsonImportModal({ open, category, onClose, onFill }: McpJsonImportModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [text, setText] = useState("");
  const [configError, setConfigError] = useState<McpServersConfigError | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  // Kept outside `rows` so parsing another config does not forget servers already created.
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const selectableKeys = new Set(
    rows
      .filter((row) => row.status !== "registered" && rowErrors(row, rows).length === 0)
      .map((row) => row.entry.key),
  );
  const selectedRows = rows.filter(
    (row) => selectedKeys.includes(row.entry.key) && selectableKeys.has(row.entry.key),
  );

  const handleParse = () => {
    const result = parseMcpServersConfig(text);

    if (!result.ok) {
      setConfigError(result.error);
      setRows([]);
      setSelectedKeys([]);
      return;
    }

    const nextRows = result.entries.map<Row>((entry) => ({
      entry,
      name: entry.name,
      status: "idle",
    }));

    setConfigError(null);
    setRows(nextRows);
    setSelectedKeys(
      nextRows.filter((row) => rowErrors(row, nextRows).length === 0).map((row) => row.entry.key),
    );
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((current) =>
      current.map((row) => (row.entry.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handleRegister = async () => {
    setRegistering(true);
    let succeeded = 0;
    let failed = 0;

    // One at a time: a batch of connection tests against third-party servers is slow enough
    // already, and sequential results keep the status column readable while it runs.
    for (const row of selectedRows) {
      const { entry, name } = row;
      updateRow(entry.key, { status: "registering", message: undefined });

      try {
        const discovery = await discoverMcpTools({
          url: entry.url,
          mode: entry.mode,
          headers: entry.headers,
        });
        const mcpId = await registerMcp({
          name,
          creationType: "custom",
          category,
          mode: discovery.mode,
          url: entry.url,
          headers: entry.headers,
          toolConfigs: discovery.tools.map((tool) => ({
            toolName: tool.name,
            description: tool.description,
          })),
        });
        updateRow(entry.key, { status: "registered" });
        setRegisteredIds((current) => [...current, mcpId]);
        succeeded += 1;
      } catch (error) {
        updateRow(entry.key, {
          status: "failed",
          message: redactHeaderValues(extractRequestErrorMessage(error), entry.headers),
        });
        failed += 1;
      }
    }

    setSelectedKeys([]);
    setRegistering(false);

    const summary = t("executionFactory.mcpJsonImport.summary", { succeeded, failed });
    void (failed > 0 ? message.warning(summary) : message.success(summary));
  };

  const handleFill = () => {
    const [row] = selectedRows;

    if (!row) {
      return;
    }

    onFill({
      name: row.name,
      mode: row.entry.mode,
      url: row.entry.url,
      headers: row.entry.headers,
    });
  };

  const renderStatus = (row: Row) => {
    const errors = rowErrors(row, rows);
    const { entry } = row;

    return (
      <Space direction="vertical" size={2}>
        {row.status === "registering" ? (
          <Tag color="processing">{t("executionFactory.mcpJsonImport.statuses.registering")}</Tag>
        ) : null}
        {row.status === "registered" ? (
          <Tag color="success">{t("executionFactory.mcpJsonImport.statuses.registered")}</Tag>
        ) : null}
        {row.status === "failed" ? (
          <>
            <Tag color="error">{t("executionFactory.mcpJsonImport.statuses.failed")}</Tag>
            <Typography.Text type="danger">{row.message}</Typography.Text>
          </>
        ) : null}
        {errors.map((error) => (
          <Typography.Text key={error} type="danger">
            {t(`executionFactory.mcpJsonImport.entryErrors.${error}`, { type: entry.type })}
          </Typography.Text>
        ))}
        {entry.warnings
          .filter((warning) => warning !== "name_adjusted" || row.name === entry.name)
          .map((warning) => (
            <Typography.Text key={warning} type="secondary">
              {t(`executionFactory.mcpJsonImport.warnings.${warning}`, {
                key: entry.key,
                fields: entry.ignoredFields.join(", "),
              })}
            </Typography.Text>
          ))}
      </Space>
    );
  };

  return (
    <Modal
      destroyOnClose
      footer={
        <Space>
          <AppButton disabled={registering} onClick={() => onClose(registeredIds)}>
            {registeredIds.length > 0
              ? t("executionFactory.mcpJsonImport.done")
              : t("common.cancel")}
          </AppButton>
          <AppButton
            disabled={registering || selectedRows.length !== 1}
            onClick={handleFill}
            title={t("executionFactory.mcpJsonImport.fillFormHint")}
          >
            {t("executionFactory.mcpJsonImport.fillForm")}
          </AppButton>
          <AppButton
            disabled={selectedRows.length === 0}
            loading={registering}
            onClick={() => void handleRegister()}
            type="primary"
          >
            {t("executionFactory.mcpJsonImport.registerSelected", { total: selectedRows.length })}
          </AppButton>
        </Space>
      }
      maskClosable={false}
      onCancel={() => {
        if (!registering) {
          onClose(registeredIds);
        }
      }}
      open={open}
      title={t("executionFactory.mcpJsonImport.title")}
      width={960}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          {t("executionFactory.mcpJsonImport.hint")}
        </Typography.Text>
        <Input.TextArea
          aria-label="mcpServers JSON"
          autoSize={{ minRows: 6, maxRows: 14 }}
          disabled={registering}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            '{\n  "mcpServers": {\n    "my_mcp": {\n      "type": "streamable_http",\n      "url": "https://mcp.example.com/mcp"\n    }\n  }\n}'
          }
          spellCheck={false}
          style={{ fontFamily: "var(--font-family-code, monospace)" }}
          value={text}
        />
        <div>
          <AppButton disabled={registering || text.trim() === ""} onClick={handleParse}>
            {t("executionFactory.mcpJsonImport.parse")}
          </AppButton>
        </div>
        {configError ? (
          <Alert
            showIcon
            type="error"
            message={t(`executionFactory.mcpJsonImport.configErrors.${configError}`)}
          />
        ) : null}
        {rows.length > 0 ? (
          <Table<Row>
            columns={[
              {
                key: "name",
                title: t("executionFactory.mcpJsonImport.columns.name"),
                width: 200,
                render: (_, row) => (
                  <Input
                    aria-label={t("executionFactory.mcpJsonImport.columns.name")}
                    disabled={registering || row.status === "registered"}
                    onChange={(event) => updateRow(row.entry.key, { name: event.target.value })}
                    size="small"
                    value={row.name}
                  />
                ),
              },
              {
                key: "mode",
                title: t("executionFactory.mcpJsonImport.columns.mode"),
                width: 100,
                render: (_, row) =>
                  // Entries without a usable transport have no mode to show; the fallback
                  // mode is not something the config asked for.
                  row.entry.errors.some((error) => NO_TRANSPORT_ERRORS.has(error))
                    ? "-"
                    : t(`executionFactory.mcpModeShort.${row.entry.mode}`),
              },
              {
                key: "url",
                title: t("executionFactory.mcpJsonImport.columns.url"),
                render: (_, row) => (
                  <Typography.Text style={{ wordBreak: "break-all" }}>
                    {row.entry.url}
                  </Typography.Text>
                ),
              },
              {
                key: "headers",
                title: t("executionFactory.mcpJsonImport.columns.headers"),
                width: 180,
                render: (_, row) =>
                  Object.entries(maskHeaders(row.entry.headers)).map(([name, value]) => (
                    <div key={name} style={{ wordBreak: "break-all" }}>
                      <Typography.Text code>{`${name}: ${value}`}</Typography.Text>
                    </div>
                  )),
              },
              {
                key: "status",
                title: t("executionFactory.mcpJsonImport.columns.status"),
                width: 260,
                render: (_, row) => renderStatus(row),
              },
            ]}
            dataSource={rows}
            pagination={false}
            rowKey={(row) => row.entry.key}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
              getCheckboxProps: (row) => ({
                disabled: registering || !selectableKeys.has(row.entry.key),
              }),
            }}
            size="small"
          />
        ) : null}
      </Space>
    </Modal>
  );
}
