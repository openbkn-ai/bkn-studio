import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Spin,
  Table,
} from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import {
  getMcpDetail,
  parseMcpSse,
  registerMcp,
  updateMcp,
} from "@/modules/execution-factory/services/mcp.service";
import type {
  McpCreationType,
  McpMode,
  McpParseSseTool,
  McpToolConfigInput,
} from "@/modules/execution-factory/types/mcp";

import styles from "./create-menu.module.css";
import { McpToolImportedSection } from "./McpToolImportedSection";

type CreateMcpDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (mcpId: string) => void;
  onUpdated?: () => void;
  mcpId?: string | null;
};

type FormValues = {
  name: string;
  description?: string;
  creationType: McpCreationType;
  category: string;
  mode: McpMode;
  url?: string;
  headers?: Array<{ key: string; value: string }>;
};

function mapHeadersToFormList(headers?: Record<string, string>) {
  return Object.entries(headers ?? {}).map(([key, value]) => ({ key, value }));
}

export function CreateMcpDrawer({
  open,
  onClose,
  onCreated,
  onUpdated,
  mcpId = null,
}: CreateMcpDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [tools, setTools] = useState<McpParseSseTool[]>([]);
  const [importedTools, setImportedTools] = useState<McpToolConfigInput[]>([]);
  const creationType = Form.useWatch("creationType", form);
  const isEditMode = Boolean(mcpId);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      setLoading(true);

      try {
        const items = await listOperatorCategories();
        const options = items.map((item) => ({
          value: item.categoryType,
          label: item.name,
        }));
        setCategories(options);

        if (mcpId) {
          const detail = await getMcpDetail(mcpId);
          const creation = detail.creationType ?? "custom";

          form.setFieldsValue({
            name: detail.name,
            description: detail.description,
            creationType: creation,
            category: detail.category ?? options[0]?.value ?? "other_category",
            mode: detail.mode ?? "sse",
            url: detail.url,
            headers: mapHeadersToFormList(detail.headers),
          });

          if (creation === "tool_imported") {
            setImportedTools(detail.toolConfigs ?? []);
            setTools([]);
          } else {
            setTools(
              (detail.toolConfigs ?? []).map((tool) => ({
                name: tool.toolName ?? "unknown",
                description: tool.description,
              })),
            );
            setImportedTools([]);
          }

          return;
        }

        form.setFieldsValue({
          category: options[0]?.value ?? "other_category",
          creationType: "custom",
          mode: "sse",
          headers: [],
        });
        setTools([]);
        setImportedTools([]);
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [form, mcpId, message, onClose, open]);

  const handleParse = async () => {
    const values = await form.validateFields(["url", "mode", "headers"]);
    setParsing(true);

    try {
      const headers = (values.headers ?? []).reduce<Record<string, string>>(
        (acc, item) => {
          if (item.key) {
            acc[item.key] = item.value ?? "";
          }
          return acc;
        },
        {},
      );
      const result = await parseMcpSse({
        url: values.url ?? "",
        mode: values.mode,
        headers,
      });
      setTools(result.tools);
      void message.success(t("executionFactory.parseSseSuccess", { count: result.tools.length }));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      if (values.creationType === "tool_imported") {
        if (importedTools.length === 0) {
          void message.info(t("executionFactory.mcpToolImportedRequired"));
          return;
        }

        const payload = {
          name: values.name,
          description: values.description,
          creationType: values.creationType,
          category: values.category,
          mode: "stream" as const,
          toolConfigs: importedTools,
        };

        if (isEditMode && mcpId) {
          await updateMcp(mcpId, payload);
          void message.success(t("common.success"));
          onClose();
          onUpdated?.();
          return;
        }

        const createdId = await registerMcp(payload);
        void message.success(t("common.success"));
        onClose();
        onCreated?.(createdId);
        return;
      }

      const headers = (values.headers ?? []).reduce<Record<string, string>>(
        (acc, item) => {
          if (item.key) {
            acc[item.key] = item.value ?? "";
          }
          return acc;
        },
        {},
      );

      const payload = {
        name: values.name,
        description: values.description,
        creationType: values.creationType,
        category: values.category,
        mode: values.mode,
        url: values.url,
        headers,
        toolConfigs: tools.map((tool) => ({
          toolName: tool.name,
          description: tool.description,
        })),
      };

      if (isEditMode && mcpId) {
        await updateMcp(mcpId, payload);
        void message.success(t("common.success"));
        onClose();
        onUpdated?.();
        return;
      }

      const createdId = await registerMcp(payload);
      void message.success(t("common.success"));
      onClose();
      onCreated?.(createdId);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      extra={
        <Space>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
            {t("common.confirm")}
          </AppButton>
        </Space>
      }
      onClose={onClose}
      open={open}
      title={
        isEditMode
          ? t("executionFactory.editMcpDrawerTitle")
          : t("executionFactory.createMcpDrawerTitle")
      }
      width={800}
    >
      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed) => {
            if (changed.creationType && !isEditMode) {
              setTools([]);
              setImportedTools([]);
            }
          }}
        >
          <Form.Item
            label={t("executionFactory.mcpName")}
            name="name"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t("common.description")} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={t("executionFactory.mcpCreationType")}
            name="creationType"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Radio.Group disabled={isEditMode}>
              <Radio value="custom">{t("executionFactory.mcpCreationTypes.custom")}</Radio>
              <Radio value="tool_imported">
                {t("executionFactory.mcpCreationTypes.tool_imported")}
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label={t("executionFactory.category")}
            name="category"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Select options={categories} />
          </Form.Item>

          {creationType === "custom" ? (
            <>
              <Form.Item label={t("executionFactory.mcpMode")} name="mode">
                <Select
                  options={(["sse", "stream"] as const).map((value) => ({
                    label: t(`executionFactory.mcpModes.${value}`),
                    value,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label={t("executionFactory.serviceUrl")}
                name="url"
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input placeholder="http://127.0.0.1:8080/mcp/sse" />
              </Form.Item>
              <Form.List name="headers">
                {(fields, { add, remove }) => (
                  <>
                    <div className={styles.modalHint}>{t("executionFactory.mcpHeadersLabel")}</div>
                    {fields.map((field) => (
                      <div className={styles.headerRow} key={field.key}>
                        <Form.Item {...field} name={[field.name, "key"]} style={{ flex: 1 }}>
                          <Input placeholder="Header" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, "value"]} style={{ flex: 1 }}>
                          <Input placeholder="Value" />
                        </Form.Item>
                        <Button icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                      </div>
                    ))}
                    <Button icon={<PlusOutlined />} onClick={() => add()} type="dashed">
                      {t("executionFactory.addHeader")}
                    </Button>
                  </>
                )}
              </Form.List>
              <div style={{ margin: "16px 0" }}>
                <AppButton loading={parsing} onClick={() => void handleParse()}>
                  {t("executionFactory.parseSse")}
                </AppButton>
              </div>
              <Table
                columns={[
                  { dataIndex: "name", key: "name", title: t("executionFactory.toolName") },
                  {
                    dataIndex: "description",
                    key: "description",
                    title: t("common.description"),
                  },
                ]}
                dataSource={tools.map((tool, index) => ({
                  ...tool,
                  key: `${tool.name}-${index}`,
                }))}
                locale={{
                  emptyText: (
                    <Empty
                      description={t("executionFactory.mcpToolsEmptyHint")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
                pagination={false}
                size="small"
              />
            </>
          ) : (
            <McpToolImportedSection onChange={setImportedTools} value={importedTools} />
          )}
        </Form>
      )}
    </Drawer>
  );
}
